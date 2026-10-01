// In-memory presence: which users have live sockets, plus in-progress calls.
// Single-process only; a multi-instance deployment needs the Socket.IO Redis adapter.
const sockets = new Map(); // userId -> Set<socketId>
const calls = new Map(); // userId -> { peerId, roomId, callType, role, state, startedAt, timer }

export const presence = {
    add(userId, socketId) {
        const set = sockets.get(userId) ?? new Set();
        const wasOffline = set.size === 0;
        set.add(socketId);
        sockets.set(userId, set);
        return wasOffline;
    },
    // Returns true when this was the user's last socket.
    remove(userId, socketId) {
        const set = sockets.get(userId);
        if (!set) return false;
        set.delete(socketId);
        if (set.size === 0) {
            sockets.delete(userId);
            return true;
        }
        return false;
    },
    isOnline: (userId) => (sockets.get(String(userId))?.size ?? 0) > 0,
    onlineUserIds: () => Array.from(sockets.keys()),
    socketCount: (userId) => sockets.get(String(userId))?.size ?? 0,

    getCall: (userId) => calls.get(String(userId)),
    setCall: (userId, state) => calls.set(String(userId), state),
    clearCall(userId) {
        const state = calls.get(String(userId));
        if (state?.timer) clearTimeout(state.timer);
        calls.delete(String(userId));
        return state;
    },
};
