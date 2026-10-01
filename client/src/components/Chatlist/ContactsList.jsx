import { useState } from "react";
import { HiOutlineUserGroup } from "react-icons/hi";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { useToast } from "@/context/ToastContext";
import useUserSearch from "@/hooks/useUserSearch";
import { api } from "@/lib/api";
import Avatar from "../common/Avatar";
import PanelHeader from "./PanelHeader";
import UserSearchInput from "./UserSearchInput";

function groupByLetter(users) {
    const groups = new Map();
    for (const u of users) {
        const letter = (u.name || "#").charAt(0).toUpperCase();
        if (!groups.has(letter)) groups.set(letter, []);
        groups.get(letter).push(u);
    }
    return [...groups.entries()];
}

export default function ContactsList() {
    const [, dispatch] = useStateProvider();
    const toast = useToast();
    const [term, setTerm] = useState("");
    const [opening, setOpening] = useState(null);
    const { users, loading, error } = useUserSearch(term);

    const open = async (user) => {
        setOpening(user.id);
        try {
            const { conversation } = await api.openDirect(user.id);
            dispatch({ type: reducerCases.UPSERT_CHAT, chat: conversation });
            dispatch({ type: reducerCases.OPEN_CHAT, chatId: conversation.id });
        } catch (err) {
            toast(err.message, { type: "error" });
        } finally {
            setOpening(null);
        }
    };

    return (
        <div className="flex h-full flex-col bg-light-surface text-light-primary-text dark:bg-dark-surface dark:text-dark-primary-text">
            <PanelHeader title="New chat" onBack={() => dispatch({ type: reducerCases.SET_PANEL, panel: "chats" })} />
            <UserSearchInput value={term} onChange={setTerm} />
            <div className="custom-scrollbar flex-auto overflow-auto">
                <button
                    type="button"
                    onClick={() => dispatch({ type: reducerCases.SET_PANEL, panel: "newGroup" })}
                    className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-light-secondary-background dark:hover:bg-dark-secondary-background"
                >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-light-accent text-2xl text-white dark:bg-dark-accent dark:text-dark-surface">
                        <HiOutlineUserGroup aria-hidden="true" />
                    </span>
                    New group
                </button>
                {loading && (
                    <p className="px-5 py-3 text-sm text-light-secondary-text dark:text-dark-secondary-text" role="status">
                        Loading contacts…
                    </p>
                )}
                {error && (
                    <p className="px-5 py-3 text-sm text-light-error dark:text-dark-error" role="alert">
                        {error}
                    </p>
                )}
                {!loading && !error && !users.length && (
                    <p className="px-5 py-3 text-sm text-light-secondary-text dark:text-dark-secondary-text">No contacts found.</p>
                )}
                {groupByLetter(users).map(([letter, list]) => (
                    <section key={letter} aria-label={letter}>
                        <h3 className="py-4 pl-10 text-light-accent dark:text-dark-accent">{letter}</h3>
                        {list.map((u) => (
                            <button
                                key={u.id}
                                type="button"
                                disabled={opening === u.id}
                                onClick={() => open(u)}
                                aria-label={`Open chat with ${u.name}`}
                                className="flex w-full items-center gap-4 px-5 py-2 text-left hover:bg-light-secondary-background disabled:opacity-60 dark:hover:bg-dark-secondary-background"
                            >
                                <Avatar type="lg" image={u.profilePicture} alt="" />
                                <span className="flex min-w-0 flex-col border-b border-light-divider pb-2 dark:border-dark-divider">
                                    <span>{u.name}</span>
                                    <span className="truncate text-sm text-light-secondary-text dark:text-dark-secondary-text">{u.about || " "}</span>
                                </span>
                            </button>
                        ))}
                    </section>
                ))}
            </div>
        </div>
    );
}
