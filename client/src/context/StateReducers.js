import { reducerCases } from "./constants";

export const initialState = {
    userInfo: undefined,
    newUser: false,

    chats: [],
    chatsLoaded: false,
    currentChatId: null,
    // chatId -> { items: Message[], hasMore: boolean, loaded: boolean }
    messagesByChat: {},
    highlightMessageId: null,
    replyTo: {},
    editing: {},

    onlineUsers: [],
    lastSeen: {},
    typing: {}, // chatId -> { userId: name }
    socketStatus: "connecting",

    panel: "chats", // "chats" | "contacts" | "newGroup"
    contactSearch: "",
    messagesSearch: false,
    infoPanel: false,
    smWindows: false,
    showSmChatList: true,

    call: null, // { direction, callType, peer: {id,name,profilePicture}, roomId, accepted }
    incomingCall: null,
};

const STATUS_RANK = { failed: 0, pending: 1, sent: 2, delivered: 3, read: 4 };
const rank = (s) => STATUS_RANK[s] ?? 0;
const time = (v) => (v ? new Date(v).getTime() : 0);
const chatTime = (c) => time(c.lastMessage?.createdAt ?? c.createdAt);

export const sortChats = (chats) => [...chats].sort((a, b) => chatTime(b) - chatTime(a));

// Flattens the latest message onto the chat row (the fields the list renders).
const withLastMessage = (chat, m) => ({
    ...chat,
    lastMessage: m,
    messageId: m._id,
    message: m.message,
    type: m.type,
    messageStatus: m.messageStatus,
    sender: m.sender,
    createdAt: m.createdAt,
});

// Inserts or replaces a message, reconciling optimistic copies by tempId. Every entry
// that refers to the same message collapses into one; status never moves backwards.
export function upsertMessage(items = [], message, tempId) {
    const temp = tempId || message.tempId;
    const matches = (m) => m._id === message._id || Boolean(temp && (m.tempId === temp || m._id === temp));
    const idx = items.findIndex(matches);
    if (idx === -1) return [...items, message];
    const merged = { ...items[idx], ...message, _id: message._id };
    for (const m of items) {
        if (m._id === message._id && rank(m.messageStatus) > rank(merged.messageStatus)) merged.messageStatus = m.messageStatus;
    }
    return items.map((m, i) => (i === idx ? merged : m)).filter((m, i) => i === idx || !matches(m));
}

function updateChat(state, chatId, fn) {
    return state.chats.map((c) => (c.id === chatId ? fn(c) : c));
}

function receiveMessage(state, { message, tempId, alreadyCounted = false }) {
    const chatId = message.conversationId;
    const me = state.userInfo?.id;
    const entry = state.messagesByChat[chatId];
    const alreadyKnown = Boolean(entry?.items.some((m) => m._id === message._id));
    const messagesByChat = entry
        ? { ...state.messagesByChat, [chatId]: { ...entry, items: upsertMessage(entry.items, message, tempId) } }
        : state.messagesByChat;

    const countsAsUnread =
        !alreadyKnown && !alreadyCounted && message.sender !== me && message.type !== "system" && chatId !== state.currentChatId && !message.tempId;
    const chats = sortChats(
        updateChat(state, chatId, (c) => {
            const newer = time(message.createdAt) >= time(c.lastMessage?.createdAt) || c.lastMessage?._id === message._id;
            const next = newer ? withLastMessage(c, message) : c;
            return countsAsUnread ? { ...next, unreadCount: (c.unreadCount || 0) + 1, totalUnreadMessages: (c.unreadCount || 0) + 1 } : next;
        }),
    );
    return { ...state, chats, messagesByChat };
}

function applyToMessages(state, fn) {
    const messagesByChat = {};
    for (const [chatId, entry] of Object.entries(state.messagesByChat)) {
        messagesByChat[chatId] = { ...entry, items: entry.items.map(fn) };
    }
    return messagesByChat;
}

const resetSession = (state) => ({ ...initialState, smWindows: state.smWindows, showSmChatList: state.showSmChatList });

const reducer = (state, action) => {
    switch (action.type) {
        case reducerCases.SET_USER_INFO:
            if (!action.userInfo) return resetSession(state);
            return { ...state, userInfo: action.userInfo };
        case reducerCases.SET_NEW_USER:
            return { ...state, newUser: action.newUser };
        case reducerCases.RESET_SESSION:
            return resetSession(state);

        case reducerCases.SET_CHATS:
            return {
                ...state,
                chatsLoaded: true,
                chats: sortChats(action.chats.map((c) => (c.id === state.currentChatId ? { ...c, unreadCount: 0, totalUnreadMessages: 0 } : c))),
            };
        case reducerCases.UPSERT_CHAT: {
            const incoming = action.chat.id === state.currentChatId ? { ...action.chat, unreadCount: 0, totalUnreadMessages: 0 } : action.chat;
            const exists = state.chats.some((c) => c.id === incoming.id);
            const chats = exists ? state.chats.map((c) => (c.id === incoming.id ? { ...c, ...incoming } : c)) : [incoming, ...state.chats];
            return { ...state, chats: sortChats(chats) };
        }
        case reducerCases.REMOVE_CHAT:
            return {
                ...state,
                chats: state.chats.filter((c) => c.id !== action.chatId),
                currentChatId: state.currentChatId === action.chatId ? null : state.currentChatId,
            };
        case reducerCases.OPEN_CHAT:
            return {
                ...state,
                currentChatId: action.chatId,
                chats: updateChat(state, action.chatId, (c) => ({ ...c, unreadCount: 0, totalUnreadMessages: 0 })),
                messagesSearch: false,
                infoPanel: false,
                showSmChatList: false,
                panel: "chats",
            };
        case reducerCases.CLOSE_CHAT:
            return { ...state, currentChatId: null, messagesSearch: false, infoPanel: false, showSmChatList: true };

        case reducerCases.SET_MESSAGES: {
            const { chatId, items, hasMore, prepend } = action;
            const existing = state.messagesByChat[chatId]?.items ?? [];
            let next;
            if (prepend) {
                const known = new Set(existing.map((m) => m._id));
                next = [...items.filter((m) => !known.has(m._id)), ...existing];
            } else {
                // Keep optimistic messages that the server has not confirmed yet.
                const ids = new Set(items.map((m) => m._id));
                next = [...items, ...existing.filter((m) => m.tempId && !ids.has(m._id) && ["pending", "failed"].includes(m.messageStatus))];
            }
            return {
                ...state,
                messagesByChat: { ...state.messagesByChat, [chatId]: { items: next, hasMore: Boolean(hasMore), loaded: true } },
            };
        }
        case reducerCases.RECEIVE_MESSAGE:
            return receiveMessage(state, action);
        case reducerCases.UPDATE_MESSAGE: {
            const m = action.message;
            const entry = state.messagesByChat[m.conversationId];
            return {
                ...state,
                messagesByChat: entry
                    ? { ...state.messagesByChat, [m.conversationId]: { ...entry, items: entry.items.map((x) => (x._id === m._id ? { ...x, ...m } : x)) } }
                    : state.messagesByChat,
                chats: updateChat(state, m.conversationId, (c) => (c.lastMessage?._id === m._id ? withLastMessage(c, { ...c.lastMessage, ...m }) : c)),
            };
        }
        case reducerCases.REMOVE_MESSAGE: {
            const entry = state.messagesByChat[action.chatId];
            if (!entry) return state;
            return {
                ...state,
                messagesByChat: { ...state.messagesByChat, [action.chatId]: { ...entry, items: entry.items.filter((m) => m._id !== action.messageId) } },
            };
        }
        case reducerCases.SET_MESSAGE_STATUS: {
            const ids = new Set(action.ids || []);
            if (!ids.size || !action.status) return state;
            const bump = (m) => (ids.has(m._id) && rank(action.status) > rank(m.messageStatus) ? { ...m, messageStatus: action.status } : m);
            return {
                ...state,
                messagesByChat: applyToMessages(state, bump),
                chats: state.chats.map((c) => {
                    if (!c.lastMessage || !ids.has(c.lastMessage._id) || rank(action.status) <= rank(c.lastMessage.messageStatus)) return c;
                    return { ...c, messageStatus: action.status, lastMessage: { ...c.lastMessage, messageStatus: action.status } };
                }),
            };
        }
        case reducerCases.HIGHLIGHT_MESSAGE:
            return { ...state, highlightMessageId: action.messageId };
        case reducerCases.SET_REPLY:
            return { ...state, replyTo: { ...state.replyTo, [action.chatId]: action.message }, editing: { ...state.editing, [action.chatId]: null } };
        case reducerCases.SET_EDITING:
            return { ...state, editing: { ...state.editing, [action.chatId]: action.message }, replyTo: { ...state.replyTo, [action.chatId]: null } };

        case reducerCases.PROFILE_UPDATED: {
            const u = action.user;
            const patch = { name: u.name, about: u.about, profilePicture: u.profilePicture };
            return {
                ...state,
                userInfo: state.userInfo?.id === u.id ? { ...state.userInfo, ...patch } : state.userInfo,
                chats: state.chats.map((c) => ({
                    ...c,
                    ...(c.partnerId === u.id ? patch : {}),
                    participants: c.participants?.map((p) => (p.id === u.id ? { ...p, ...patch } : p)),
                })),
            };
        }
        case reducerCases.SET_BLOCKED: {
            const blockedUsers = new Set(state.userInfo?.blockedUsers || []);
            if (action.blocked) blockedUsers.add(action.userId);
            else blockedUsers.delete(action.userId);
            return {
                ...state,
                userInfo: state.userInfo && { ...state.userInfo, blockedUsers: [...blockedUsers] },
                chats: state.chats.map((c) => (c.partnerId === action.userId ? { ...c, blocked: action.blocked } : c)),
            };
        }
        case reducerCases.SET_ONLINE_USERS:
            return { ...state, onlineUsers: action.onlineUsers.map(String) };
        case reducerCases.USER_ONLINE:
            return state.onlineUsers.includes(action.userId) ? state : { ...state, onlineUsers: [...state.onlineUsers, action.userId] };
        case reducerCases.USER_OFFLINE:
            return {
                ...state,
                onlineUsers: state.onlineUsers.filter((u) => u !== action.userId),
                lastSeen: { ...state.lastSeen, [action.userId]: action.lastSeen },
            };
        case reducerCases.SET_TYPING: {
            const current = { ...(state.typing[action.chatId] || {}) };
            if (action.typing) current[action.userId] = action.name || "";
            else delete current[action.userId];
            return { ...state, typing: { ...state.typing, [action.chatId]: current } };
        }
        case reducerCases.SET_SOCKET_STATUS:
            return { ...state, socketStatus: action.status };

        case reducerCases.SET_PANEL:
            return { ...state, panel: action.panel };
        case reducerCases.SET_CONTACT_SEARCH:
            return { ...state, contactSearch: action.contactSearch };
        case reducerCases.TOGGLE_MESSAGE_SEARCH:
            return { ...state, messagesSearch: !state.messagesSearch, infoPanel: false };
        case reducerCases.TOGGLE_INFO_PANEL:
            return { ...state, infoPanel: action.open ?? !state.infoPanel, messagesSearch: false };
        case reducerCases.SET_SM_WINDOWS:
            return { ...state, smWindows: action.smWindows };
        case reducerCases.SET_SHOW_SM_CHATLIST:
            return { ...state, showSmChatList: action.showSmChatList };

        case reducerCases.SET_CALL:
            return { ...state, call: action.call };
        case reducerCases.SET_INCOMING_CALL:
            return { ...state, incomingCall: action.incomingCall };
        case reducerCases.CALL_ACCEPTED:
            return state.call ? { ...state, call: { ...state.call, accepted: true } } : state;
        case reducerCases.END_CALL:
            return { ...state, call: null, incomingCall: null };
        default:
            return state;
    }
};

export default reducer;

// ---- selectors ----
export const selectCurrentChat = (state) => state.chats.find((c) => c.id === state.currentChatId) || null;

export function selectVisibleChats(state) {
    const q = state.contactSearch.trim().toLowerCase();
    if (!q) return state.chats;
    return state.chats.filter((c) => (c.name || "").toLowerCase().includes(q));
}

export const selectMessages = (state, chatId) => state.messagesByChat[chatId]?.items ?? [];
