import { useMemo, useState } from "react";
import { IoClose } from "react-icons/io5";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { selectCurrentChat, selectMessages } from "@/context/StateReducers";
import { calculateTime } from "@/lib/time";
import IconButton from "../common/IconButton";

export default function SearchMessages() {
    const [state, dispatch] = useStateProvider();
    const chat = selectCurrentChat(state);
    const messages = selectMessages(state, chat?.id);
    const [term, setTerm] = useState("");

    const results = useMemo(() => {
        const q = term.trim().toLowerCase();
        if (!q) return [];
        return messages.filter((m) => m.type === "text" && !m.deleted && m.message.toLowerCase().includes(q)).reverse();
    }, [messages, term]);

    return (
        <div className="flex h-full flex-col text-light-primary-text dark:text-dark-primary-text">
            <div className="flex h-16 items-center gap-4 border-b border-light-divider bg-light-surface px-4 dark:border-dark-divider dark:bg-dark-surface">
                <IconButton label="Close search" onClick={() => dispatch({ type: reducerCases.TOGGLE_MESSAGE_SEARCH })}>
                    <IoClose aria-hidden="true" />
                </IconButton>
                <h2>Search messages</h2>
            </div>
            <div className="p-4">
                <input
                    type="search"
                    autoFocus
                    placeholder="Search messages"
                    aria-label="Search messages"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full rounded-lg border border-light-divider bg-light-secondary-background px-3 py-2 text-sm focus:outline-none dark:border-dark-divider dark:bg-dark-secondary-background"
                />
                {!term && (
                    <p className="mt-6 text-center text-sm text-light-secondary-text dark:text-dark-secondary-text">Search for messages with {chat?.name}</p>
                )}
                {term && !results.length && (
                    <p className="mt-6 text-center text-sm text-light-secondary-text dark:text-dark-secondary-text">No messages found.</p>
                )}
            </div>
            <ul className="custom-scrollbar flex-1 overflow-auto" aria-label="Search results">
                {results.map((m) => (
                    <li key={m._id}>
                        <button
                            type="button"
                            onClick={() => dispatch({ type: reducerCases.HIGHLIGHT_MESSAGE, messageId: m._id })}
                            className="w-full border-b border-light-divider px-5 py-4 text-left hover:bg-light-surface dark:border-dark-divider dark:hover:bg-dark-surface"
                        >
                            <span className="block text-xs text-light-secondary-text dark:text-dark-secondary-text">{calculateTime(m.createdAt)}</span>
                            <span className="line-clamp-2 text-light-accent dark:text-dark-accent">{m.message}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
