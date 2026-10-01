import { useState } from "react";
import { IoClose } from "react-icons/io5";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { useToast } from "@/context/ToastContext";
import useUserSearch from "@/hooks/useUserSearch";
import { api } from "@/lib/api";
import Avatar from "../common/Avatar";
import AvatarPicker from "../common/AvatarPicker";
import Input from "../common/Input";
import PanelHeader from "./PanelHeader";
import UserSearchInput from "./UserSearchInput";

export default function NewGroup() {
    const [, dispatch] = useStateProvider();
    const toast = useToast();
    const [step, setStep] = useState("members");
    const [term, setTerm] = useState("");
    const [selected, setSelected] = useState([]);
    const [name, setName] = useState("");
    const [avatar, setAvatar] = useState("/group_avatar.svg");
    const [saving, setSaving] = useState(false);
    const { users, loading } = useUserSearch(term);

    const toggle = (u) => setSelected((s) => (s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));
    const back = () => (step === "details" ? setStep("members") : dispatch({ type: reducerCases.SET_PANEL, panel: "chats" }));

    const create = async (e) => {
        e.preventDefault();
        if (!name.trim()) return toast("Give the group a name", { type: "error" });
        setSaving(true);
        try {
            const { conversation } = await api.createGroup({
                name: name.trim(),
                participantIds: selected.map((u) => u.id),
                avatar: avatar === "/group_avatar.svg" ? undefined : avatar,
            });
            dispatch({ type: reducerCases.UPSERT_CHAT, chat: conversation });
            dispatch({ type: reducerCases.OPEN_CHAT, chatId: conversation.id });
        } catch (err) {
            toast(err.message, { type: "error" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex h-full flex-col bg-light-surface text-light-primary-text dark:bg-dark-surface dark:text-dark-primary-text">
            <PanelHeader title={step === "members" ? "Add group members" : "New group"} onBack={back} />
            {step === "members" ? (
                <>
                    {selected.length > 0 && (
                        <ul className="flex flex-wrap gap-2 px-4 pt-3" aria-label="Selected members">
                            {selected.map((u) => (
                                <li key={u.id} className="flex items-center gap-1 rounded-full bg-light-secondary-background py-1 pl-1 pr-2 text-sm dark:bg-dark-secondary-background">
                                    <Avatar type="xs" image={u.profilePicture} alt="" />
                                    {u.name}
                                    <button type="button" aria-label={`Remove ${u.name}`} onClick={() => toggle(u)}>
                                        <IoClose aria-hidden="true" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <UserSearchInput value={term} onChange={setTerm} placeholder="Search people to add" />
                    <ul className="custom-scrollbar flex-auto overflow-auto" aria-label="People">
                        {loading && <li className="px-5 py-3 text-sm" role="status">Loading…</li>}
                        {users.map((u) => {
                            const checked = selected.some((x) => x.id === u.id);
                            return (
                                <li key={u.id}>
                                    <label className="flex cursor-pointer items-center gap-4 px-5 py-2 hover:bg-light-secondary-background dark:hover:bg-dark-secondary-background">
                                        <input type="checkbox" checked={checked} onChange={() => toggle(u)} className="h-4 w-4" aria-label={`Add ${u.name}`} />
                                        <Avatar type="sm" image={u.profilePicture} alt="" />
                                        <span>{u.name}</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                    <div className="p-4">
                        <button
                            type="button"
                            disabled={!selected.length}
                            onClick={() => setStep("details")}
                            className="w-full rounded-xl bg-light-accent py-3 font-semibold text-white disabled:opacity-50 dark:bg-dark-accent dark:text-dark-surface"
                        >
                            Next ({selected.length} selected)
                        </button>
                    </div>
                </>
            ) : (
                <form onSubmit={create} className="flex flex-1 flex-col items-center gap-6 p-6">
                    <AvatarPicker image={avatar} setImage={setAvatar} size="lg" onError={(m) => toast(m, { type: "error" })} />
                    <Input name="Group name" state={name} setState={setName} label required maxLength={60} />
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-xl bg-light-accent py-3 font-semibold text-white disabled:opacity-50 dark:bg-dark-accent dark:text-dark-surface"
                    >
                        {saving ? "Creating…" : "Create group"}
                    </button>
                </form>
            )}
        </div>
    );
}
