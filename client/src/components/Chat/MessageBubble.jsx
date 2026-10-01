import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { BsChevronDown } from "react-icons/bs";
import { FaPhoneAlt } from "react-icons/fa";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { sendOutgoing } from "@/lib/outbox";
import { formatClock } from "@/lib/time";
import ContextMenu from "../common/ContextMenu";
import MessageStatus from "../common/MessageStatus";
import FileMessage from "./FileMessage";
import ImageMessage from "./ImageMessage";
import MessageText from "./MessageText";

const VoiceMessage = dynamic(() => import("./VoiceMessage"), { ssr: false });

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 60 * 60 * 1000;

function ReplyQuote({ reply, chat, me }) {
    const [, dispatch] = useStateProvider();
    if (!reply) return null;
    const author = reply.sender === me ? "You" : (chat.participants?.find((p) => p.id === reply.sender)?.name ?? chat.name);
    return (
        <button
            type="button"
            onClick={() => dispatch({ type: reducerCases.HIGHLIGHT_MESSAGE, messageId: reply._id })}
            className="mb-1 block w-full rounded border-l-4 border-light-accent bg-black/5 px-2 py-1 text-left text-xs dark:border-dark-accent dark:bg-white/10"
        >
            <span className="block font-semibold text-light-accent dark:text-dark-accent">{author}</span>
            <span className="line-clamp-2 opacity-80">
                {reply.deleted
                    ? "This message was deleted"
                    : reply.message || (reply.type === "image" ? "📷 Photo" : reply.type === "audio" ? "🎤 Voice message" : "Attachment")}
            </span>
        </button>
    );
}

function Reactions({ reactions, me, onToggle }) {
    if (!reactions?.length) return null;
    const counts = reactions.reduce((acc, r) => ({ ...acc, [r.emoji]: [...(acc[r.emoji] || []), r.user] }), {});
    return (
        <div className="-mb-2 mt-1 flex flex-wrap gap-1">
            {Object.entries(counts).map(([emoji, users]) => (
                <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggle(emoji)}
                    aria-label={`${emoji} ${users.length}${users.includes(me) ? ", including you" : ""}`}
                    className={`rounded-full border px-1.5 text-xs ${users.includes(me) ? "border-light-accent dark:border-dark-accent" : "border-transparent"} bg-light-secondary-background dark:bg-dark-surface`}
                >
                    {emoji} {users.length > 1 ? users.length : ""}
                </button>
            ))}
        </div>
    );
}

export default function MessageBubble({ message, chat, me, showSender, highlighted }) {
    const [, dispatch] = useStateProvider();
    const toast = useToast();
    const menuButton = useRef(null);
    const [menu, setMenu] = useState(null); // null | { kind: "actions" | "react", at: openedAt }
    const mine = message.sender === me;
    const pending = Boolean(message.tempId && message._id === message.tempId);

    if (message.type === "system" || message.type === "call") {
        return (
            <div id={`msg-${message._id}`} className="my-1 flex justify-center">
                <span className="flex items-center gap-2 rounded-md bg-light-surface px-3 py-1 text-center text-xs text-light-secondary-text shadow-sm dark:bg-dark-surface dark:text-dark-secondary-text">
                    {message.type === "call" && (
                        <FaPhoneAlt
                            className={message.message.startsWith("Missed") && !mine ? "text-light-error dark:text-dark-error" : ""}
                            aria-hidden="true"
                        />
                    )}
                    {message.message}
                    {message.type === "call" && <span className="opacity-70">{formatClock(message.createdAt)}</span>}
                </span>
            </div>
        );
    }

    const run = (fn) => async () => {
        try {
            await fn();
        } catch (err) {
            toast(err.message, { type: "error" });
        }
    };
    const react = (emoji) =>
        run(async () => {
            const { message: updated } = await api.react(message._id, emoji);
            dispatch({ type: reducerCases.UPDATE_MESSAGE, message: updated });
        })();
    const age = menu ? menu.at - new Date(message.createdAt).getTime() : 0;
    const actions =
        menu?.kind === "react"
            ? QUICK_REACTIONS.map((emoji) => ({ name: emoji, callback: () => react(emoji) }))
            : [
                  { name: "Reply", callback: () => dispatch({ type: reducerCases.SET_REPLY, chatId: chat.id, message }) },
                  { name: "React", callback: () => setTimeout(() => setMenu({ kind: "react", at: Date.now() }), 0) },
                  message.type === "text" && { name: "Copy", callback: () => navigator.clipboard?.writeText(message.message).then(() => toast("Copied")) },
                  mine &&
                      message.type === "text" &&
                      age < EDIT_WINDOW_MS && { name: "Edit", callback: () => dispatch({ type: reducerCases.SET_EDITING, chatId: chat.id, message }) },
                  {
                      name: "Delete for me",
                      danger: true,
                      callback: run(async () => {
                          await api.deleteMessage(message._id, "me");
                          dispatch({ type: reducerCases.REMOVE_MESSAGE, chatId: chat.id, messageId: message._id });
                      }),
                  },
                  mine &&
                      age < DELETE_WINDOW_MS && {
                          name: "Delete for everyone",
                          danger: true,
                          callback: run(async () => {
                              if (!window.confirm("Delete this message for everyone?")) return;
                              dispatch({ type: reducerCases.UPDATE_MESSAGE, message: await api.deleteMessage(message._id, "everyone") });
                          }),
                      },
              ];

    const authorName = chat.participants?.find((p) => p.id === message.sender)?.name ?? "Former member";
    const bubbleColor = mine
        ? "bg-light-bubble-sender text-light-primary-text dark:bg-dark-bubble-sender dark:text-dark-primary-text"
        : "bg-light-bubble-receiver text-light-primary-text dark:bg-dark-bubble-receiver dark:text-dark-primary-text";

    return (
        <div id={`msg-${message._id}`} className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
                className={`relative max-w-[85%] rounded-lg px-2 py-1.5 text-sm shadow-sm transition-shadow sm:max-w-[70%] ${bubbleColor} ${highlighted ? "ring-2 ring-light-accent dark:ring-dark-accent" : ""}`}
                data-testid="message-bubble"
                data-status={message.messageStatus}
            >
                {!pending && !message.deleted && (
                    <button
                        ref={menuButton}
                        type="button"
                        aria-label="Message actions"
                        aria-haspopup="menu"
                        onClick={() => setMenu((m) => (m ? null : { kind: "actions", at: Date.now() }))}
                        className="absolute right-1 top-1 rounded-full bg-inherit p-1 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                    >
                        <BsChevronDown aria-hidden="true" />
                    </button>
                )}
                {menu && <ContextMenu label="Message actions" anchorRef={menuButton} onClose={() => setMenu(null)} options={actions} />}
                {showSender && <span className="block text-xs font-semibold text-light-accent dark:text-dark-accent">{authorName}</span>}
                <ReplyQuote reply={message.replyTo} chat={chat} me={me} />
                {message.deleted ? (
                    <span className="italic opacity-70">{mine ? "You deleted this message" : "This message was deleted"}</span>
                ) : message.type === "image" ? (
                    <ImageMessage message={message} />
                ) : message.type === "audio" ? (
                    <VoiceMessage message={message} />
                ) : message.type === "file" ? (
                    <FileMessage message={message} />
                ) : (
                    <MessageText text={message.message} />
                )}
                {typeof message.progress === "number" && message.messageStatus === "pending" && (
                    <progress className="mt-1 h-1 w-full" max={100} value={message.progress} aria-label="Upload progress" />
                )}
                <span className="float-right ml-2 mt-1 flex items-center gap-1 text-[11px] text-light-secondary-text dark:text-dark-secondary-text">
                    {message.editedAt && !message.deleted && <span>edited</span>}
                    <span>{formatClock(message.createdAt)}</span>
                    {mine && !message.deleted && <MessageStatus messageStatus={message.messageStatus} />}
                </span>
                <span className="clear-both block" />
                <Reactions reactions={message.reactions} me={me} onToggle={react} />
                {mine && message.messageStatus === "failed" && message.retry && (
                    <button
                        type="button"
                        className="mt-1 text-xs font-semibold text-light-error underline dark:text-dark-error"
                        onClick={() =>
                            sendOutgoing(dispatch, { chatId: chat.id, me, payload: message.retry, onError: (e) => toast(e.message, { type: "error" }) })
                        }
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}
