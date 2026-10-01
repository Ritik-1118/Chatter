import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { selectVisibleChats } from "@/context/StateReducers";
import ChatListItem from "./ChatListItem";

export default function List() {
    const [state, dispatch] = useStateProvider();
    const chats = selectVisibleChats(state);
    const searching = state.contactSearch.trim().length > 0;

    if (!chats.length) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-light-secondary-text dark:text-dark-secondary-text">
                <p>{searching ? "No chats match your search." : "No conversations yet."}</p>
                {!searching && (
                    <button
                        type="button"
                        className="rounded-lg bg-light-accent px-4 py-2 font-semibold text-white dark:bg-dark-accent dark:text-dark-surface"
                        onClick={() => dispatch({ type: reducerCases.SET_PANEL, panel: "contacts" })}
                    >
                        Start a chat
                    </button>
                )}
            </div>
        );
    }

    return (
        <ul className="custom-scrollbar max-h-full flex-auto overflow-auto" aria-label="Conversations">
            {chats.map((chat) => (
                <li key={chat.id}>
                    <ChatListItem chat={chat} />
                </li>
            ))}
        </ul>
    );
}
