import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { api } from "@/lib/api";
import { dayLabel, isSameDay } from "@/lib/time";
import MessageBubble from "./MessageBubble";

const NEAR_BOTTOM_PX = 120;

export default function ChatContainer({ chat, entry }) {
    const [{ userInfo, highlightMessageId }, dispatch] = useStateProvider();
    const scroller = useRef(null);
    const nearBottom = useRef(true);
    const prependAnchor = useRef(null);
    const lastId = useRef(null);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const items = entry.items;
    const me = userInfo?.id;

    // Jump to the bottom when a chat opens.
    useLayoutEffect(() => {
        const el = scroller.current;
        if (el) el.scrollTop = el.scrollHeight;
        nearBottom.current = true;
    }, [chat.id]);

    useLayoutEffect(() => {
        const el = scroller.current;
        if (!el) return;
        if (prependAnchor.current !== null) {
            // Keep the viewport on the same message after older ones are added above.
            el.scrollTop = el.scrollHeight - prependAnchor.current;
            prependAnchor.current = null;
            return;
        }
        const newest = items[items.length - 1];
        if (newest && newest._id !== lastId.current && (nearBottom.current || newest.sender === me)) {
            el.scrollTo({ top: el.scrollHeight, behavior: lastId.current ? "smooth" : "auto" });
        }
        lastId.current = newest?._id ?? null;
    }, [items, me]);

    // Coming back to the tab while this chat is open counts as reading it.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") api.markRead(chat.id).catch(() => {});
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [chat.id]);

    useEffect(() => {
        if (!highlightMessageId) return;
        document.getElementById(`msg-${highlightMessageId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        const t = setTimeout(() => dispatch({ type: reducerCases.HIGHLIGHT_MESSAGE, messageId: null }), 2000);
        return () => clearTimeout(t);
    }, [highlightMessageId, dispatch]);

    const loadOlder = useCallback(async () => {
        const firstSaved = items.find((m) => !m.tempId || m._id !== m.tempId);
        if (loadingOlder || !entry.hasMore || !firstSaved) return;
        setLoadingOlder(true);
        try {
            const { messages, hasMore } = await api.messages(chat.id, { before: firstSaved._id, limit: 50 });
            prependAnchor.current = scroller.current.scrollHeight - scroller.current.scrollTop;
            dispatch({ type: reducerCases.SET_MESSAGES, chatId: chat.id, items: messages, hasMore, prepend: true });
        } finally {
            setLoadingOlder(false);
        }
    }, [items, loadingOlder, entry.hasMore, chat.id, dispatch]);

    const onScroll = (e) => {
        const el = e.currentTarget;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
        if (el.scrollTop < 80) loadOlder();
    };

    return (
        <div
            ref={scroller}
            onScroll={onScroll}
            className="custom-scrollbar relative flex-1 overflow-y-auto bg-light-background px-3 py-4 dark:bg-dark-background sm:px-8"
            role="log"
            aria-label="Messages"
            aria-live="polite"
        >
            <div className="pointer-events-none fixed inset-0 z-0 bg-chat-background bg-fixed opacity-5" aria-hidden="true" />
            <div className="relative z-10 flex flex-col gap-1">
                {entry.hasMore && (
                    <button
                        type="button"
                        onClick={loadOlder}
                        disabled={loadingOlder}
                        className="mx-auto mb-2 rounded-full bg-light-surface px-4 py-1 text-xs text-light-secondary-text dark:bg-dark-surface dark:text-dark-secondary-text"
                    >
                        {loadingOlder ? "Loading…" : "Load older messages"}
                    </button>
                )}
                {!items.length && (
                    <p className="mx-auto mt-10 rounded-lg bg-light-surface px-4 py-2 text-sm text-light-secondary-text dark:bg-dark-surface dark:text-dark-secondary-text">
                        No messages yet. Say hi! 👋
                    </p>
                )}
                {items.map((message, i) => {
                    const prev = items[i - 1];
                    const newDay = !prev || !isSameDay(prev.createdAt, message.createdAt);
                    const showSender = chat.isGroup && message.sender !== me && (newDay || prev?.sender !== message.sender || prev?.type === "system");
                    return (
                        <Fragment key={message._id}>
                            {newDay && (
                                <div className="my-2 flex justify-center" role="separator">
                                    <span className="rounded-md bg-light-surface px-3 py-1 text-xs text-light-secondary-text shadow-sm dark:bg-dark-surface dark:text-dark-secondary-text">
                                        {dayLabel(message.createdAt)}
                                    </span>
                                </div>
                            )}
                            <MessageBubble message={message} chat={chat} me={me} showSender={showSender} highlighted={highlightMessageId === message._id} />
                        </Fragment>
                    );
                })}
            </div>
        </div>
    );
}
