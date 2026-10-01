import { useRef, useState } from "react";
import { BiArrowBack, BiSearchAlt2 } from "react-icons/bi";
import { BsThreeDotsVertical } from "react-icons/bs";
import { IoVideocam } from "react-icons/io5";
import { MdCall } from "react-icons/md";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { lastSeenLabel } from "@/lib/time";
import Avatar from "../common/Avatar";
import ContextMenu from "../common/ContextMenu";
import IconButton from "../common/IconButton";

export function useChatStatus(chat) {
    const [{ onlineUsers, lastSeen, typing, userInfo }] = useStateProvider();
    const typers = Object.values(typing[chat.id] || {});
    if (typers.length) return chat.isGroup ? `${typers.map((n) => n.split(" ")[0]).join(", ")} ${typers.length > 1 ? "are" : "is"} typing…` : "typing…";
    if (chat.isGroup) {
        const names = (chat.participants || []).map((p) => (p.id === userInfo?.id ? "You" : p.name.split(" ")[0]));
        return names.join(", ");
    }
    if (chat.blocked) return "blocked";
    if (onlineUsers.includes(chat.partnerId)) return "online";
    return lastSeenLabel(lastSeen[chat.partnerId] ?? chat.lastSeen);
}

export default function ChatHeader({ chat }) {
    const [{ userInfo, call, smWindows }, dispatch] = useStateProvider();
    const toast = useToast();
    const status = useChatStatus(chat);
    const menuButton = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);

    const startCall = (callType) =>
        dispatch({
            type: reducerCases.SET_CALL,
            call: {
                direction: "outgoing",
                callType,
                peer: { id: chat.partnerId, name: chat.name, profilePicture: chat.profilePicture },
                roomId: `${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
                accepted: false,
            },
        });

    const toggleBlock = async () => {
        try {
            if (chat.blocked) await api.unblock(chat.partnerId);
            else await api.block(chat.partnerId);
            dispatch({ type: reducerCases.SET_BLOCKED, userId: chat.partnerId, blocked: !chat.blocked });
            toast(chat.blocked ? `${chat.name} unblocked` : `${chat.name} blocked`);
        } catch (err) {
            toast(err.message, { type: "error" });
        }
    };

    const report = async () => {
        const reason = window.prompt(`Why are you reporting ${chat.name}? (optional)`);
        if (reason === null) return;
        try {
            await api.report(chat.partnerId, reason);
            toast("Thanks — the report was sent.");
        } catch (err) {
            toast(err.message, { type: "error" });
        }
    };

    const leave = async () => {
        if (!window.confirm(`Leave "${chat.name}"?`)) return;
        try {
            await api.removeMember(chat.id, userInfo.id);
            dispatch({ type: reducerCases.REMOVE_CHAT, chatId: chat.id });
        } catch (err) {
            toast(err.message, { type: "error" });
        }
    };

    const callDisabled = Boolean(call) || chat.blocked;
    return (
        <header
            aria-label="Chat header"
            className="z-10 flex h-16 items-center justify-between gap-2 border-b border-light-divider bg-light-secondary-background px-2 py-3 text-light-primary-text dark:border-dark-divider dark:bg-dark-secondary-background dark:text-dark-primary-text sm:px-4"
        >
            <div className="flex min-w-0 items-center gap-3">
                {smWindows && (
                    <IconButton label="Back to chats" onClick={() => dispatch({ type: reducerCases.CLOSE_CHAT })}>
                        <BiArrowBack aria-hidden="true" />
                    </IconButton>
                )}
                <button
                    type="button"
                    className="flex min-w-0 items-center gap-3 rounded-lg text-left"
                    onClick={() => dispatch({ type: reducerCases.TOGGLE_INFO_PANEL, open: true })}
                    aria-label={`${chat.isGroup ? "Group" : "Contact"} info for ${chat.name}`}
                >
                    <Avatar type="sm" image={chat.profilePicture} alt="" />
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{chat.name}</span>
                        <span className="truncate text-sm text-light-secondary-text dark:text-dark-secondary-text" data-testid="chat-status">
                            {status}
                        </span>
                    </span>
                </button>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-light-accent dark:text-dark-accent">
                {!chat.isGroup && (
                    <>
                        <IconButton label="Voice call" disabled={callDisabled} onClick={() => startCall("voice")}>
                            <MdCall aria-hidden="true" />
                        </IconButton>
                        <IconButton label="Video call" disabled={callDisabled} onClick={() => startCall("video")}>
                            <IoVideocam aria-hidden="true" />
                        </IconButton>
                    </>
                )}
                <IconButton
                    label="Search messages"
                    className="text-light-secondary-text dark:text-dark-secondary-text"
                    onClick={() => dispatch({ type: reducerCases.TOGGLE_MESSAGE_SEARCH })}
                >
                    <BiSearchAlt2 aria-hidden="true" />
                </IconButton>
                <IconButton
                    ref={menuButton}
                    label="Chat menu"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="text-light-secondary-text dark:text-dark-secondary-text"
                    onClick={() => setMenuOpen((v) => !v)}
                >
                    <BsThreeDotsVertical aria-hidden="true" />
                </IconButton>
                {menuOpen && (
                    <ContextMenu
                        anchorRef={menuButton}
                        onClose={() => setMenuOpen(false)}
                        options={[
                            { name: chat.isGroup ? "Group info" : "Contact info", callback: () => dispatch({ type: reducerCases.TOGGLE_INFO_PANEL, open: true }) },
                            !chat.isGroup && { name: chat.blocked ? "Unblock" : "Block", callback: toggleBlock, danger: !chat.blocked },
                            !chat.isGroup && { name: "Report", callback: report, danger: true },
                            chat.isGroup && { name: "Leave group", callback: leave, danger: true },
                            { name: "Close chat", callback: () => dispatch({ type: reducerCases.CLOSE_CHAT }) },
                        ]}
                    />
                )}
            </div>
        </header>
    );
}
