import { io } from "socket.io-client";
import { API_HOST } from "./config";
import { getIdToken } from "./firebase";

let socket = null;

// The auth callback runs on every (re)connect, so reconnects use a fresh token.
export function connectSocket() {
    if (socket) return socket;
    socket = io(API_HOST, {
        auth: (cb) => getIdToken().then((token) => cb({ token })),
        reconnection: true,
        reconnectionDelayMax: 10000,
    });
    return socket;
}

export function disconnectSocket() {
    if (!socket) return;
    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.disconnect();
    socket = null;
}

export const getSocket = () => socket;

export function emit(event, payload) {
    if (socket?.connected) socket.emit(event, payload);
}
