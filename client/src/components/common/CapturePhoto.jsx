import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";

export default function CapturePhoto({ setImage, onClose }) {
    const videoRef = useRef(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let stream;
        let cancelled = false;
        navigator.mediaDevices
            ?.getUserMedia({ video: true, audio: false })
            .then((s) => {
                if (cancelled) return s.getTracks().forEach((t) => t.stop());
                stream = s;
                if (videoRef.current) videoRef.current.srcObject = s;
            })
            .catch(() => setError("Camera access was denied or no camera is available."));
        return () => {
            cancelled = true;
            stream?.getTracks().forEach((t) => t.stop());
        };
    }, []);

    const capture = () => {
        const video = videoRef.current;
        if (!video?.videoWidth) return;
        const size = Math.min(video.videoWidth, video.videoHeight);
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        canvas.getContext("2d").drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 512, 512);
        setImage(canvas.toDataURL("image/jpeg", 0.85));
        onClose();
    };

    return (
        <Modal title="Take a photo" onClose={onClose}>
            {error ? (
                <p role="alert">{error}</p>
            ) : (
                <div className="flex flex-col items-center gap-4">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black" />
                    <button
                        type="button"
                        onClick={capture}
                        className="rounded-full bg-light-accent px-6 py-2 font-semibold text-white dark:bg-dark-accent dark:text-dark-surface"
                    >
                        Capture
                    </button>
                </div>
            )}
        </Modal>
    );
}
