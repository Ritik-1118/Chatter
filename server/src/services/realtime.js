import { presence } from "./presence.js";

let io = null;

export const userRoom = (userId) => `user:${userId}`;

export const realtime = {
    attach(server) {
        io = server;
    },
    emitToUser(userId, event, payload) {
        io?.to(userRoom(String(userId))).emit(event, payload);
    },
    emitToUsers(userIds, event, payload) {
        if (!io || !userIds?.length) return;
        io.to([...new Set(userIds.map(String))].map(userRoom)).emit(event, payload);
    },
    isOnline: (userId) => presence.isOnline(String(userId)),
};
