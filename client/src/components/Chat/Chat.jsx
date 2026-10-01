import { memo, useEffect, useState } from "react";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { selectCurrentChat } from "@/context/StateReducers";
import { api } from "@/lib/api";
import ChatContainer from "./ChatContainer";
import ChatHeader from "./ChatHeader";
import ChatInfo from "./ChatInfo";
import MessageBar from "./MessageBar";
import SearchMessages from "./SearchMessages";

function Chat() {
    const [state, dispatch] = useStateProvider();
    const chat = selectCurrentChat(state);
    const entry = state.messagesByChat[chat?.id];
    const [failure, setFailure] = useState({ chatId: null, message: "" });
    const chatId = chat?.id;
    const error = failure.chatId === chatId ? failure.message : "";

    // Cached messages render immediately; a fresh page (which also marks them read) replaces them.
    useEffect(() => {
        if (!chatId) return;
        let cancelled = false;
        api.messages(chatId, { limit: 50 })
            .then(({ messages, hasMore }) => !cancelled && dispatch({ type: reducerCases.SET_MESSAGES, chatId, items: messages, hasMore }))
            .catch((err) => !cancelled && setFailure({ chatId, message: err.message }));
        return () => {
            cancelled = true;
        };
    }, [chatId, dispatch]);

    if (!chat) return null;
    const sidePanel = state.messagesSearch ? <SearchMessages /> : state.infoPanel ? <ChatInfo /> : null;

    return (
        <div className="flex h-screen w-full min-w-0">
            <section className="flex h-screen min-w-0 flex-1 flex-col bg-light-background dark:bg-dark-background" aria-label={`Conversation with ${chat.name}`}>
                <ChatHeader chat={chat} />
                {entry?.loaded ? (
                    <ChatContainer chat={chat} entry={entry} />
                ) : error ? (
                    <div className="flex flex-1 items-center justify-center p-6 text-light-error dark:text-dark-error" role="alert">
                        {error}
                    </div>
                ) : (
                    <div className="flex-1 space-y-3 overflow-hidden p-6" aria-busy="true" aria-label="Loading messages">
                        <div className="skeleton h-12 w-2/3 rounded-xl" />
                        <div className="skeleton ml-auto h-10 w-1/2 rounded-xl" />
                        <div className="skeleton h-16 w-3/5 rounded-xl" />
                    </div>
                )}
                <MessageBar key={chat.id} chat={chat} />
            </section>
            {sidePanel && (
                <aside className="fixed inset-0 z-50 flex w-full flex-col border-l border-light-divider bg-light-secondary-background dark:border-dark-divider dark:bg-dark-secondary-background md:static md:w-80 lg:w-96">
                    {sidePanel}
                </aside>
            )}
        </div>
    );
}

export default memo(Chat);
