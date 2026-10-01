import { useRouter } from "next/router";
import { useEffect, useLayoutEffect, useRef } from "react";
import { reducerCases } from "@/context/constants";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { getIdToken } from "@/lib/firebase";
import { assetUrl } from "@/lib/media";
import { showNotification, startRingtone, stopRingtone } from "@/lib/notifications";
import { connectSocket, disconnectSocket, emit } from "@/lib/socket";

const TYPING_TTL_MS = 6000;

const previewText = (m) =>
    m.type === "image" ? "📷 Photo" : m.type === "audio" ? "🎤 Voice message" : m.type === "file" ? `📎 ${m.file?.name || "File"}` : m.message;

// Owns the socket for the signed-in user and maps server events onto app state.
export default function useChatSocket(state, dispatch) {
    const userId = state.userInfo?.id;
    const toast = useToast();
    const router = useRouter();
    const { settings } = useSettings();
    // Handlers read the latest state/settings through refs so listeners are bound once.
    const ref = useRef({ state, settings });
    useLayoutEffect(() => {
        ref.current = { state, settings };
    });

    useEffect(() => {
        if (!userId) return undefined;
        const socket = connectSocket();
        const typingTimers = new Map();
        const set = (status) => dispatch({ type: reducerCases.SET_SOCKET_STATUS, status });

        // Returns { chat, fetched }. A freshly fetched row already counts the new message as unread.
        const ensureChat = async (chatId) => {
            const known = ref.current.state.chats.find((c) => c.id === chatId);
            if (known) return { chat: known, fetched: false };
            const { conversation } = await api.chat(chatId);
            dispatch({ type: reducerCases.UPSERT_CHAT, chat: conversation });
            return { chat: conversation, fetched: true };
        };

        const clearTyping = (chatId, uid) => {
            const key = `${chatId}:${uid}`;
            clearTimeout(typingTimers.get(key));
            typingTimers.delete(key);
            dispatch({ type: reducerCases.SET_TYPING, chatId, userId: uid, typing: false });
        };

        const handlers = {
            connect: () => {
                set("connected");
                socket.emit("add-user");
            },
            disconnect: (reason) => set(reason === "io client disconnect" ? "disconnected" : "reconnecting"),
            connect_error: async (err) => {
                if (err?.message === "unauthorized") {
                    // Token expired between attempts: refresh it and try again.
                    await getIdToken(true).catch(() => null);
                    setTimeout(() => socket.connect(), 1000);
                }
                set("reconnecting");
            },
            "online-users": ({ onlineUsers = [] }) => dispatch({ type: reducerCases.SET_ONLINE_USERS, onlineUsers }),
            "user-online": ({ userId: uid }) => dispatch({ type: reducerCases.USER_ONLINE, userId: uid }),
            "user-offline": ({ userId: uid, lastSeen }) => dispatch({ type: reducerCases.USER_OFFLINE, userId: uid, lastSeen }),

            "msg-recieve": async ({ message }) => {
                if (!message?.conversationId) return;
                let chat;
                let fetched;
                try {
                    ({ chat, fetched } = await ensureChat(message.conversationId));
                } catch {
                    return;
                }
                const { state: s, settings: prefs } = ref.current;
                dispatch({ type: reducerCases.RECEIVE_MESSAGE, message, tempId: message.tempId, alreadyCounted: fetched });
                if (message.sender === s.userInfo?.id) return;
                clearTyping(message.conversationId, message.sender);

                const isOpen = s.currentChatId === message.conversationId;
                const visible = typeof document !== "undefined" && document.visibilityState === "visible";
                // Acknowledge once per message, at the moment it is actually seen.
                if (isOpen && visible && message.type !== "system") emit("read-message", { messageIds: [message._id] });
                if ((!isOpen || !visible) && prefs.notifications && message.type !== "system") {
                    showNotification(chat?.name || "New message", {
                        body: chat?.isGroup ? `${chat.participants?.find((p) => p.id === message.sender)?.name ?? ""}: ${previewText(message)}` : previewText(message),
                        icon: assetUrl(chat?.profilePicture),
                        tag: message.conversationId,
                        onClick: () => dispatch({ type: reducerCases.OPEN_CHAT, chatId: message.conversationId }),
                    });
                }
            },
            "msg-ack": ({ message, tempId }) => message && dispatch({ type: reducerCases.RECEIVE_MESSAGE, message, tempId }),
            "msg-updated": ({ message }) => message && dispatch({ type: reducerCases.UPDATE_MESSAGE, message }),
            "msg-removed": ({ conversationId, messageId }) => dispatch({ type: reducerCases.REMOVE_MESSAGE, chatId: conversationId, messageId }),
            delivered: ({ messageIds, messageId }) =>
                dispatch({ type: reducerCases.SET_MESSAGE_STATUS, ids: messageIds ?? [messageId], status: "delivered" }),
            read: ({ messageIds }) => dispatch({ type: reducerCases.SET_MESSAGE_STATUS, ids: messageIds, status: "read" }),

            typing: ({ conversationId, userId: uid, name }) => {
                dispatch({ type: reducerCases.SET_TYPING, chatId: conversationId, userId: uid, name, typing: true });
                const key = `${conversationId}:${uid}`;
                clearTimeout(typingTimers.get(key));
                typingTimers.set(key, setTimeout(() => clearTyping(conversationId, uid), TYPING_TTL_MS));
            },
            "stop-typing": ({ conversationId, userId: uid }) => clearTyping(conversationId, uid),

            "conversation-updated": async ({ conversationId }) => {
                try {
                    const { conversation } = await api.chat(conversationId);
                    dispatch({ type: reducerCases.UPSERT_CHAT, chat: conversation });
                } catch {
                    /* no longer a member */
                }
            },
            "conversation-removed": ({ conversationId }) => {
                dispatch({ type: reducerCases.REMOVE_CHAT, chatId: conversationId });
                toast("You were removed from a group");
            },
            "profile-updated": (user) => dispatch({ type: reducerCases.PROFILE_UPDATED, user }),
            "block-updated": ({ userId: uid, blocked }) => dispatch({ type: reducerCases.SET_BLOCKED, userId: uid, blocked }),
            "account-deleted": () => router.replace("/logout"),

            "incoming-voice-call": (data) => onIncoming(data, "voice"),
            "incoming-video-call": (data) => onIncoming(data, "video"),
            "accept-call": () => dispatch({ type: reducerCases.CALL_ACCEPTED }),
            "call-ended": ({ reason, roomId }) => {
                const { call, incomingCall } = ref.current.state;
                const current = call?.roomId ?? incomingCall?.roomId;
                if (current !== undefined && roomId !== undefined && String(current) !== String(roomId)) return;
                stopRingtone();
                dispatch({ type: reducerCases.END_CALL });
                const messages = { declined: "Call declined", "no-answer": "No answer", cancelled: "Call cancelled", "answered-elsewhere": "Answered on another device" };
                if (messages[reason]) toast(messages[reason]);
            },
            "call-unavailable": ({ reason }) => {
                dispatch({ type: reducerCases.END_CALL });
                toast(reason === "busy" ? "They're on another call" : reason === "offline" ? "They're offline right now" : "This person can't be called");
            },
        };

        function onIncoming({ from, roomId, callType }, fallbackType) {
            const { state: s, settings: prefs } = ref.current;
            if (s.call) return; // the server reports busy; ignore stray rings
            const peer = { id: from.id ?? from._id, name: from.name, profilePicture: from.profilePicture };
            dispatch({ type: reducerCases.SET_INCOMING_CALL, incomingCall: { callType: callType || fallbackType, peer, roomId } });
            if (prefs.sounds) startRingtone();
            if (document.visibilityState !== "visible" && prefs.notifications) {
                showNotification(`Incoming ${callType || fallbackType} call`, { body: peer.name, icon: assetUrl(peer.profilePicture), tag: "call" });
            }
        }

        const reconnecting = () => set("reconnecting");
        // The browser knows about lost connectivity long before the socket's ping times out.
        const offline = () => set("offline");
        const online = () => {
            set(socket.connected ? "connected" : "reconnecting");
            if (!socket.connected) socket.connect();
        };
        for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn);
        socket.io.on("reconnect_attempt", reconnecting);
        window.addEventListener("offline", offline);
        window.addEventListener("online", online);
        if (socket.connected) handlers.connect();

        return () => {
            typingTimers.forEach(clearTimeout);
            for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn);
            socket.io.off("reconnect_attempt", reconnecting);
            window.removeEventListener("offline", offline);
            window.removeEventListener("online", online);
            stopRingtone();
            disconnectSocket();
        };
    }, [userId, dispatch, toast, router]);
}
