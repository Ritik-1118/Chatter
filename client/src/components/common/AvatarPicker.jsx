import { useRef, useState } from "react";
import { FaCamera } from "react-icons/fa";
import { IMAGE_TYPES, LIMITS, resizeImage } from "@/lib/media";
import Avatar from "./Avatar";
import CapturePhoto from "./CapturePhoto";
import ContextMenu from "./ContextMenu";
import PhotoLibrary from "./PhotoLibrary";

// Editable avatar: take a photo, pick a preset, upload (resized client-side) or remove.
export default function AvatarPicker({ image, setImage, onError, size = "xl" }) {
    const buttonRef = useRef(null);
    const fileRef = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [library, setLibrary] = useState(false);
    const [camera, setCamera] = useState(false);

    const onFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        if (!IMAGE_TYPES.includes(file.type)) return onError?.("Please choose a PNG, JPEG, WebP or GIF image.");
        if (file.size > LIMITS.image * 4) return onError?.("That image is too large.");
        try {
            setImage(await resizeImage(file, 512));
        } catch (err) {
            onError?.(err.message);
        }
    };

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Change profile photo"
                className="group relative rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-light-accent dark:focus-visible:ring-dark-accent"
            >
                <Avatar type={size} image={image} />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-full bg-black/50 text-center text-sm text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <FaCamera className="text-2xl" aria-hidden="true" />
                    Change profile photo
                </span>
            </button>
            <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={onFile} data-testid="avatar-file-input" />
            {menuOpen && (
                <ContextMenu
                    label="Profile photo options"
                    anchorRef={buttonRef}
                    align="left"
                    onClose={() => setMenuOpen(false)}
                    options={[
                        { name: "Take photo", callback: () => setCamera(true) },
                        { name: "Choose from library", callback: () => setLibrary(true) },
                        { name: "Upload photo", callback: () => fileRef.current?.click() },
                        { name: "Remove photo", callback: () => setImage("/default_avatar.png") },
                    ]}
                />
            )}
            {library && <PhotoLibrary setImage={setImage} onClose={() => setLibrary(false)} />}
            {camera && <CapturePhoto setImage={setImage} onClose={() => setCamera(false)} />}
        </>
    );
}
