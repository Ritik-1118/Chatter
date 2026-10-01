import { useEffect, useRef, useState } from "react";
import { FaPause, FaPlay, FaStop, FaTrash } from "react-icons/fa";
import { MdSend } from "react-icons/md";
import { formatDuration, pickRecordingFormat } from "@/lib/media";
import IconButton from "../common/IconButton";

const MAX_SECONDS = 300;

// Records a voice note. The microphone is released as soon as recording stops.
export default function CaptureAudio({ onClose, onSend }) {
    const [phase, setPhase] = useState("starting"); // starting | recording | recorded | error
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState("");
    const [playing, setPlaying] = useState(false);
    const recorder = useRef(null);
    const stream = useRef(null);
    const chunks = useRef([]);
    const result = useRef(null);
    const audio = useRef(null);
    const format = useRef(pickRecordingFormat());

    const releaseMic = () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
    };

    useEffect(() => {
        let cancelled = false;
        if (!format.current || !navigator.mediaDevices?.getUserMedia) {
            setPhase("error");
            setError("Voice recording isn't supported in this browser.");
            return undefined;
        }
        navigator.mediaDevices
            .getUserMedia({ audio: true })
            .then((s) => {
                if (cancelled) return s.getTracks().forEach((t) => t.stop());
                stream.current = s;
                const r = new MediaRecorder(s, format.current.mimeType ? { mimeType: format.current.mimeType } : undefined);
                recorder.current = r;
                r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
                r.onstop = () => {
                    releaseMic();
                    const type = (r.mimeType || format.current.type).split(";")[0];
                    const blob = new Blob(chunks.current, { type });
                    result.current = new File([blob], `voice-note.${format.current.ext}`, { type });
                    audio.current = new Audio(URL.createObjectURL(blob));
                    audio.current.onended = () => setPlaying(false);
                    setPhase("recorded");
                };
                r.start(250);
                setPhase("recording");
            })
            .catch(() => {
                setPhase("error");
                setError("Microphone access was denied.");
            });
        return () => {
            cancelled = true;
            if (recorder.current?.state === "recording") recorder.current.stop();
            releaseMic();
            audio.current?.pause();
        };
    }, []);

    useEffect(() => {
        if (phase !== "recording") return undefined;
        const t = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [phase]);

    useEffect(() => {
        if (phase === "recording" && seconds >= MAX_SECONDS) recorder.current?.stop();
    }, [phase, seconds]);

    const stop = () => recorder.current?.state === "recording" && recorder.current.stop();
    const togglePlay = () => {
        if (!audio.current) return;
        if (playing) audio.current.pause();
        else audio.current.play();
        setPlaying(!playing);
    };
    const send = () => {
        if (!result.current) return;
        onSend(result.current);
        onClose();
    };

    return (
        <div className="flex items-center justify-end gap-3 text-xl text-light-secondary-text dark:text-dark-secondary-text">
            <IconButton label="Cancel recording" onClick={onClose}>
                <FaTrash aria-hidden="true" />
            </IconButton>
            <div className="flex min-w-[200px] items-center justify-center gap-3 rounded-full bg-light-surface px-4 py-2 text-base dark:bg-dark-surface" role="status">
                {phase === "error" && <span className="text-sm text-light-error dark:text-dark-error">{error}</span>}
                {phase === "starting" && <span className="text-sm">Starting microphone…</span>}
                {phase === "recording" && <span className="animate-pulse text-red-500">Recording {formatDuration(seconds)}</span>}
                {phase === "recorded" && (
                    <>
                        <IconButton label={playing ? "Pause recording" : "Play recording"} className="!p-1 text-base" onClick={togglePlay}>
                            {playing ? <FaPause aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
                        </IconButton>
                        <span>{formatDuration(seconds)}</span>
                    </>
                )}
            </div>
            {phase === "recording" && (
                <IconButton label="Stop recording" className="text-red-500" onClick={stop}>
                    <FaStop aria-hidden="true" />
                </IconButton>
            )}
            <IconButton label="Send voice message" className="text-light-accent dark:text-dark-accent" disabled={phase !== "recorded"} onClick={send}>
                <MdSend aria-hidden="true" />
            </IconButton>
        </div>
    );
}
