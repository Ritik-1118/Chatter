import { useState } from "react";
import { assetUrl } from "@/lib/media";
import Modal from "../common/Modal";

export default function ImageMessage({ message }) {
    const [open, setOpen] = useState(false);
    const [failed, setFailed] = useState(false);
    const src = assetUrl(message.mediaUrl);
    if (failed) return <span className="block p-4 text-xs italic opacity-70">Image unavailable</span>;
    return (
        <>
            <button type="button" onClick={() => setOpen(true)} aria-label="Open image" className="block">
                <img src={src} alt={message.file?.name || "Photo"} loading="lazy" onError={() => setFailed(true)} className="max-h-80 max-w-[260px] rounded-md object-contain sm:max-w-xs" />
            </button>
            {open && (
                <Modal title={message.file?.name || "Photo"} onClose={() => setOpen(false)} className="max-w-4xl">
                    <img src={src} alt={message.file?.name || "Photo"} className="mx-auto max-h-[75vh] object-contain" />
                    <a href={src} download={message.file?.name} className="mt-3 inline-block text-sm text-light-link underline dark:text-dark-link">
                        Download
                    </a>
                </Modal>
            )}
        </>
    );
}
