import { useEffect, useRef, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa";
import WaveSurfer from "wavesurfer.js";
import { assetUrl, formatDuration } from "@/lib/media";

// One playback source: WaveSurfer drives (and renders) a single <audio> element.
export default function VoiceMessage({ message }) {
    const container = useRef(null);
    const ws = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [duration, setDuration] = useState(0);
    const [failed, setFailed] = useState(false);
    const url = assetUrl(message.mediaUrl);

    useEffect(() => {
        if (!container.current || !url) return undefined;
        const media = new Audio();
        media.crossOrigin = "anonymous";
        media.preload = "metadata";
        media.src = url;
        const instance = WaveSurfer.create({
            container: container.current,
            media,
            height: 30,
            barWidth: 2,
            barGap: 1,
            cursorWidth: 0,
            waveColor: "#9ca3af",
            progressColor: "#4a9eff",
        });
        ws.current = instance;
        const subs = [
            instance.on("ready", (d) => setDuration(d)),
            instance.on("timeupdate", (t) => setCurrent(t)),
            instance.on("play", () => setPlaying(true)),
            instance.on("pause", () => setPlaying(false)),
            instance.on("finish", () => setPlaying(false)),
            instance.on("error", () => setFailed(true)),
        ];
        media.addEventListener("loadedmetadata", () => Number.isFinite(media.duration) && setDuration(media.duration));
        return () => {
            subs.forEach((off) => off());
            instance.destroy();
            media.removeAttribute("src");
            ws.current = null;
        };
    }, [url]);

    return (
        <div className="flex min-w-[220px] items-center gap-3 pr-6">
            <button
                type="button"
                onClick={() => ws.current?.playPause()}
                disabled={failed}
                aria-label={playing ? "Pause voice message" : "Play voice message"}
                className="rounded-full p-2 text-lg hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
            >
                {playing ? <FaPause aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
            </button>
            <div className="flex flex-1 flex-col">
                <div ref={container} className="w-full" />
                <span className="text-xs opacity-70">{failed ? "Audio unavailable" : formatDuration(playing || current ? current : duration)}</span>
            </div>
        </div>
    );
}
