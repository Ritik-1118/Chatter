import { FaCamera, FaFileAlt, FaMicrophone, FaPhoneAlt } from "react-icons/fa";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { calculateTime } from "@/lib/time";
import Avatar from "../common/Avatar";
import MessageStatus from "../common/MessageStatus";

function Preview({ chat, me, typing }) {
    if (typing) return <span className="truncate italic text-unread">{typing}</span>;
    const m = chat.lastMessage;
    if (!m) return <span className="truncate">{chat.isGroup ? "Group created" : " "}</span>;
    const author = chat.isGroup && m.sender && m.type !== "system" ? (m.sender === me ? "You: " : `${chat.participants?.find((p) => p.id === m.sender)?.name?.split(" ")[0] ?? ""}: `) : "";
    let body = m.message;
    let Icon = null;
    if (m.deleted) body = "This message was deleted";
    else if (m.type === "image") [Icon, body] = [FaCamera, "Photo"];
    else if (m.type === "audio") [Icon, body] = [FaMicrophone, "Voice message"];
    else if (m.type === "file") [Icon, body] = [FaFileAlt, m.file?.name || "File"];
    else if (m.type === "call") Icon = FaPhoneAlt;
    return (
        <span className="flex min-w-0 items-center gap-1">
            {m.sender === me && !["system", "call"].includes(m.type) && !m.deleted && <MessageStatus messageStatus={m.messageStatus} />}
            {author && <span className="shrink-0">{author}</span>}
            {Icon && <Icon className="shrink-0 text-light-accent dark:text-dark-accent" aria-hidden="true" />}
            <span className={`truncate ${m.deleted ? "italic" : ""}`}>{body}</span>
        </span>
    );
}

export default function ChatListItem({ chat }) {
    const [{ userInfo, currentChatId, onlineUsers, typing }, dispatch] = useStateProvider();
    const active = currentChatId === chat.id;
    const unread = chat.unreadCount || 0;
    const typers = Object.values(typing[chat.id] || {});
    const typingLabel = typers.length ? (chat.isGroup ? `${typers[0].split(" ")[0]} is typing…` : "typing…") : "";
    const online = !chat.isGroup && onlineUsers.includes(chat.partnerId);

    return (
        <button
            type="button"
            className={`flex w-full items-center text-left hover:bg-light-secondary-background dark:hover:bg-dark-secondary-background ${active ? "bg-light-secondary-background dark:bg-dark-secondary-background" : ""}`}
            onClick={() => dispatch({ type: reducerCases.OPEN_CHAT, chatId: chat.id })}
            aria-current={active ? "true" : undefined}
            aria-label={`Open chat with ${chat.name}`}
        >
            <span className="min-w-fit px-4 py-2">
                <Avatar type="lg" image={chat.profilePicture} alt="" online={online} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col border-b border-light-divider py-3 pr-3 dark:border-dark-divider">
                <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-light-primary-text dark:text-dark-primary-text">{chat.name}</span>
                    <span className={`shrink-0 text-xs ${unread ? "font-semibold text-unread" : "text-light-secondary-text dark:text-dark-secondary-text"}`}>
                        {calculateTime(chat.lastMessage?.createdAt ?? chat.createdAt)}
                    </span>
                </span>
                <span className="flex items-center justify-between gap-2 text-sm text-light-secondary-text dark:text-dark-secondary-text">
                    <Preview chat={chat} me={userInfo?.id} typing={typingLabel} />
                    {unread > 0 && (
                        <span className="min-w-[1.25rem] shrink-0 rounded-full bg-unread px-1.5 text-center text-xs font-semibold text-white" aria-label={`${unread} unread`}>
                            {unread}
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
}
