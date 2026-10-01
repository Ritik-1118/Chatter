import { useState } from "react";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { toUserInfo } from "@/lib/session";
import AvatarPicker from "./AvatarPicker";
import Input from "./Input";
import Modal from "./Modal";

export default function ProfileModal({ onClose }) {
    const [{ userInfo }, dispatch] = useStateProvider();
    const toast = useToast();
    const [name, setName] = useState(userInfo?.name || "");
    const [about, setAbout] = useState(userInfo?.about || "");
    const [image, setImage] = useState(userInfo?.profilePicture);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    if (!userInfo) return null;

    const dirty = name !== userInfo.name || about !== userInfo.about || image !== userInfo.profilePicture;
    const save = async (e) => {
        e.preventDefault();
        setError("");
        if (name.trim().length < 3) return setError("Display name must be at least 3 characters.");
        setSaving(true);
        try {
            const body = { name: name.trim(), about: about.trim() };
            if (image !== userInfo.profilePicture) body.image = image;
            const { user } = await api.updateProfile(body);
            dispatch({ type: reducerCases.SET_USER_INFO, userInfo: toUserInfo(user) });
            toast("Profile updated");
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal title="Profile" onClose={onClose} closeLabel="Close profile modal">
            <form onSubmit={save} className="flex flex-col items-center gap-4">
                <AvatarPicker image={image} setImage={setImage} onError={setError} />
                <p className="break-all text-sm text-light-secondary-text dark:text-dark-secondary-text">{userInfo.email}</p>
                {error && (
                    <p role="alert" className="w-full rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-900 dark:text-red-100">
                        {error}
                    </p>
                )}
                <Input name="Display Name" state={name} setState={setName} label required maxLength={50} />
                <Input name="About" state={about} setState={setAbout} label maxLength={140} />
                <button
                    type="submit"
                    disabled={!dirty || saving}
                    className="w-full rounded-xl bg-light-accent py-2 font-semibold text-white disabled:opacity-50 dark:bg-dark-accent dark:text-dark-surface"
                >
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </form>
        </Modal>
    );
}
