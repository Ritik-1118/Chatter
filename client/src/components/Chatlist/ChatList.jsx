import { memo } from "react";
import { useStateProvider } from "@/context/StateContext";
import ChatListHeader from "./ChatListHeader";
import ContactsList from "./ContactsList";
import List from "./List";
import NewGroup from "./NewGroup";
import SearchBar from "./SearchBar";

const SKELETON = Array.from({ length: 7 });

function ChatList({ loading = false, hidden = false }) {
    const [{ panel }] = useStateProvider();
    return (
        <nav
            aria-label="Chat list"
            className={`${hidden ? "hidden" : "flex"} max-h-screen w-full flex-col border-r border-light-divider bg-light-surface dark:border-dark-divider dark:bg-dark-surface md:w-1/2 lg:w-1/3 lg:min-w-[320px]`}
        >
            {panel === "contacts" && <ContactsList />}
            {panel === "newGroup" && <NewGroup />}
            {panel === "chats" && (
                <>
                    <ChatListHeader />
                    <SearchBar />
                    {loading ? (
                        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-busy="true" aria-label="Loading chats">
                            {SKELETON.map((_, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="skeleton h-12 w-12 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <div className="skeleton h-4 w-1/2 rounded" />
                                        <div className="skeleton h-3 w-1/3 rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <List />
                    )}
                </>
            )}
        </nav>
    );
}

export default memo(ChatList);
