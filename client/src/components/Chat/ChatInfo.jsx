import { useState } from "react";
import { IoClose } from "react-icons/io5";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { selectCurrentChat } from "@/context/StateReducers";
import { useToast } from "@/context/ToastContext";
import useUserSearch from "@/hooks/useUserSearch";
import { api } from "@/lib/api";
import Avatar from "../common/Avatar";
import AvatarPicker from "../common/AvatarPicker";
import IconButton from "../common/IconButton";
import Input from "../common/Input";
import Modal from "../common/Modal";
import { useChatStatus } from "./ChatHeader";

function AddMembers({ chat, onClose }) {
    const toast = useToast();
    const [term, setTerm] = useState("");
    const [picked, setPicked] = useState([]);
    const { users } = useUserSearch(term);
    const existing = new Set(chat.participants.map((p) => p.id));
    const add = async () => {
        try {
            await api.addMembers(chat.id, picked);
            onClose();
        } catch (err) {
            toast(err.message, { type: "error" });
        }
    };
    return (
        <Modal title="Add members" onClose={onClose}>
            <input
                type="search"
                placeholder="Search people"
                aria-label="Search people"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="mb-3 w-full rounded-lg border border-light-divider bg-light-surface px-3 py-2 text-sm dark:border-dark-divider dark:bg-dark-surface"
            />
            <ul className="max-h-72 overflow-auto">
                {users
                    .filter((u) => !existing.has(u.id))
                    .map((u) => (
                        <li key={u.id}>
                            <label className="flex cursor-pointer items-center gap-3 py-2">
                                <input
                                    type="checkbox"
                                    checked={picked.includes(u.id)}
                                    onChange={() => setPicked((p) => (p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id]))}
                                />
                                <Avatar type="xs" image={u.profilePicture} alt="" />
                                {u.name}
                            </label>
                        </li>
                    ))}
            </ul>
            <button
                type="button"
                disabled={!picked.length}
                onClick={add}
                className="mt-4 w-full rounded-xl bg-light-accent py-2 font-semibold text-white disabled:opacity-50 dark:bg-dark-accent dark:text-dark-surface"
            >
                Add {picked.length || ""}
            </button>
        </Modal>
    );
}

function EditGroup({ chat, onClose }) {
    const toast = useToast();
    const [name, setName] = useState(chat.name);
    const [description, setDescription] = useState(chat.about || "");
    const [avatar, setAvatar] = useState(chat.profilePicture);
    const save = async (e) => {
        e.preventDefault();
        try {
            const body = { name: name.trim(), description: description.trim() };
            if (avatar !== chat.profilePicture) body.avatar = avatar;
            await api.updateGroup(chat.id, body);
            onClose();
        } catch (err) {
            toast(err.message, { type: "error" });
        }
    };
    return (
        <Modal title="Edit group" onClose={onClose}>
            <form onSubmit={save} className="flex flex-col items-center gap-4">
                <AvatarPicker image={avatar} setImage={setAvatar} size="lg" onError={(m) => toast(m, { type: "error" })} />
                <Input name="Group name" state={name} setState={setName} label required maxLength={60} />
                <Input name="Description" state={description} setState={setDescription} label maxLength={200} />
                <button type="submit" className="w-full rounded-xl bg-light-accent py-2 font-semibold text-white dark:bg-dark-accent dark:text-dark-surface">
                    Save
                </button>
            </form>
        </Modal>
    );
}

export default function ChatInfo() {
    const [state, dispatch] = useStateProvider();
    const chat = selectCurrentChat(state);
    const toast = useToast();
    const status = useChatStatus(chat);
    const [modal, setModal] = useState(null);
    const me = state.userInfo?.id;
    const amAdmin = chat.isGroup && chat.admins?.includes(me);
    const close = () => dispatch({ type: reducerCases.TOGGLE_INFO_PANEL, open: false });
    const act = (fn) => async () => {
        try {
            await fn();
        } catch (err) {
            toast(err.message, { type: "error" });
        }
    };

    return (
        <div className="flex h-full flex-col overflow-y-auto text-light-primary-text dark:text-dark-primary-text">
            <div className="flex h-16 shrink-0 items-center gap-4 border-b border-light-divider bg-light-surface px-4 dark:border-dark-divider dark:bg-dark-surface">
                <IconButton label="Close info" onClick={close}>
                    <IoClose aria-hidden="true" />
                </IconButton>
                <h2>{chat.isGroup ? "Group info" : "Contact info"}</h2>
            </div>
            <div className="flex flex-col items-center gap-2 p-6 text-center">
                <Avatar type="xl" image={chat.profilePicture} alt="" />
                <h3 className="text-xl font-semibold">{chat.name}</h3>
                <p className="text-sm text-light-secondary-text dark:text-dark-secondary-text">
                    {chat.isGroup ? `Group · ${chat.participants.length} members` : status}
                </p>
                {chat.about && <p className="mt-2 whitespace-pre-wrap text-sm">{chat.about}</p>}
                {amAdmin && (
                    <button type="button" onClick={() => setModal("edit")} className="mt-2 text-sm font-semibold text-light-accent dark:text-dark-accent">
                        Edit group
                    </button>
                )}
            </div>
            {chat.isGroup ? (
                <section className="px-4 pb-4" aria-label="Members">
                    <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm text-light-secondary-text dark:text-dark-secondary-text">{chat.participants.length} members</h4>
                        {amAdmin && (
                            <button type="button" onClick={() => setModal("add")} className="text-sm font-semibold text-light-accent dark:text-dark-accent">
                                Add members
                            </button>
                        )}
                    </div>
                    <ul>
                        {chat.participants.map((p) => {
                            const isAdmin = chat.admins?.includes(p.id);
                            return (
                                <li key={p.id} className="flex items-center gap-3 py-2">
                                    <Avatar type="sm" image={p.profilePicture} alt="" />
                                    <span className="min-w-0 flex-1 truncate">{p.id === me ? "You" : p.name}</span>
                                    {isAdmin && <span className="rounded bg-light-surface px-1.5 text-xs text-unread dark:bg-dark-surface">Admin</span>}
                                    {amAdmin && p.id !== me && (
                                        <span className="flex gap-2 text-xs">
                                            <button
                                                type="button"
                                                className="text-light-accent dark:text-dark-accent"
                                                onClick={act(() => api.setAdmin(chat.id, p.id, !isAdmin))}
                                            >
                                                {isAdmin ? "Dismiss admin" : "Make admin"}
                                            </button>
                                            <button
                                                type="button"
                                                className="text-light-error dark:text-dark-error"
                                                onClick={act(async () => window.confirm(`Remove ${p.name}?`) && api.removeMember(chat.id, p.id))}
                                            >
                                                Remove
                                            </button>
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <button
                        type="button"
                        className="mt-4 w-full rounded-lg border border-light-error py-2 text-light-error dark:border-dark-error dark:text-dark-error"
                        onClick={act(async () => {
                            if (!window.confirm(`Leave "${chat.name}"?`)) return;
                            await api.removeMember(chat.id, me);
                            dispatch({ type: reducerCases.REMOVE_CHAT, chatId: chat.id });
                        })}
                    >
                        Leave group
                    </button>
                </section>
            ) : (
                <section className="flex flex-col gap-2 px-4 pb-4">
                    <button
                        type="button"
                        className="w-full rounded-lg border border-light-error py-2 text-light-error dark:border-dark-error dark:text-dark-error"
                        onClick={act(async () => {
                            if (chat.blocked) await api.unblock(chat.partnerId);
                            else await api.block(chat.partnerId);
                            dispatch({ type: reducerCases.SET_BLOCKED, userId: chat.partnerId, blocked: !chat.blocked });
                        })}
                    >
                        {chat.blocked ? `Unblock ${chat.name}` : `Block ${chat.name}`}
                    </button>
                    <button
                        type="button"
                        className="w-full rounded-lg border border-light-error py-2 text-light-error dark:border-dark-error dark:text-dark-error"
                        onClick={act(async () => {
                            const reason = window.prompt(`Why are you reporting ${chat.name}? (optional)`);
                            if (reason === null) return;
                            await api.report(chat.partnerId, reason);
                            toast("Thanks — the report was sent.");
                        })}
                    >
                        Report {chat.name}
                    </button>
                </section>
            )}
            {modal === "add" && <AddMembers chat={chat} onClose={() => setModal(null)} />}
            {modal === "edit" && <EditGroup chat={chat} onClose={() => setModal(null)} />}
        </div>
    );
}
