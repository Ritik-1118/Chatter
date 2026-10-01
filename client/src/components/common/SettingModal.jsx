import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useStateProvider } from "@/context/StateContext";
import { useTheme } from "@/context/ThemeContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { notificationsSupported } from "@/lib/notifications";
import { endSession } from "@/lib/session";
import Modal from "./Modal";
import Toggle from "./Toggle";

function usePermission(name) {
    const [state, setState] = useState("unknown");
    useEffect(() => {
        let status;
        navigator.permissions
            ?.query({ name })
            .then((s) => {
                status = s;
                setState(s.state);
                s.onchange = () => setState(s.state);
            })
            .catch(() => {});
        return () => {
            if (status) status.onchange = null;
        };
    }, [name]);
    return state;
}

const PERMISSION_TEXT = { granted: "Allowed", denied: "Blocked in browser settings", prompt: "Will ask when needed", unknown: "Will ask when needed" };

export default function SettingModal({ onClose }) {
    const { settings, updateSettings } = useSettings();
    const { theme, setTheme } = useTheme();
    const [, dispatch] = useStateProvider();
    const toast = useToast();
    const router = useRouter();
    const camera = usePermission("camera");
    const microphone = usePermission("microphone");
    const [confirmDelete, setConfirmDelete] = useState(false);

    const toggleNotifications = async (on) => {
        if (!on) return updateSettings({ notifications: false });
        if (!notificationsSupported()) return toast("This browser doesn't support notifications", { type: "error" });
        const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
        if (permission !== "granted") return toast("Notifications are blocked in your browser settings", { type: "error" });
        updateSettings({ notifications: true });
    };

    const deleteAccount = async () => {
        try {
            await api.deleteAccount();
            await endSession(dispatch);
            router.replace("/login");
        } catch (err) {
            toast(err.message, { type: "error" });
        }
    };

    return (
        <Modal title="Settings" onClose={onClose} closeLabel="Close settings modal">
            <div className="flex flex-col gap-5">
                <Toggle label="Dark mode" checked={theme === "dark"} onChange={(on) => setTheme(on ? "dark" : "light")} />
                <Toggle label="Notifications" description="Show alerts for new messages and calls while Chatter is in the background" checked={settings.notifications} onChange={toggleNotifications} />
                <Toggle label="Sounds" description="Ringtone for incoming calls" checked={settings.sounds} onChange={(on) => updateSettings({ sounds: on })} />
                <Toggle label="Send on Enter" description="Shift+Enter adds a new line. Ctrl/⌘+Enter always sends." checked={settings.enterToSend} onChange={(on) => updateSettings({ enterToSend: on })} />
                <dl className="grid grid-cols-2 gap-y-1 text-sm">
                    <dt>Camera</dt>
                    <dd className="text-right text-light-secondary-text dark:text-dark-secondary-text">{PERMISSION_TEXT[camera]}</dd>
                    <dt>Microphone</dt>
                    <dd className="text-right text-light-secondary-text dark:text-dark-secondary-text">{PERMISSION_TEXT[microphone]}</dd>
                </dl>
                <hr className="border-light-divider dark:border-dark-divider" />
                {confirmDelete ? (
                    <div className="flex flex-col gap-2 text-sm">
                        <p role="alert">This permanently removes your profile and you will be signed out. Your past messages will show as from “Deleted user”.</p>
                        <div className="flex gap-2">
                            <button type="button" className="flex-1 rounded-lg border border-light-divider py-2 dark:border-dark-divider" onClick={() => setConfirmDelete(false)}>
                                Cancel
                            </button>
                            <button type="button" className="flex-1 rounded-lg bg-light-error py-2 font-semibold text-white dark:bg-dark-error" onClick={deleteAccount}>
                                Delete my account
                            </button>
                        </div>
                    </div>
                ) : (
                    <button type="button" className="text-left text-sm text-light-error dark:text-dark-error" onClick={() => setConfirmDelete(true)}>
                        Delete account…
                    </button>
                )}
            </div>
        </Modal>
    );
}
