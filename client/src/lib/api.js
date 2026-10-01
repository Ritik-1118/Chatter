import axios from "axios";
import { API_HOST } from "./config";
import { getIdToken } from "./firebase";

const http = axios.create({ baseURL: API_HOST, timeout: 30000 });

// A fresh ID token on every request: Firebase tokens expire after an hour.
http.interceptors.request.use(async (config) => {
    const token = await getIdToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export class ApiError extends Error {
    constructor(message, status, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

http.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err.response?.status ?? 0;
        const body = err.response?.data?.error;
        const message = body?.message || (status ? `Request failed (${status})` : "Network error — check your connection");
        return Promise.reject(new ApiError(message, status, body?.code || (status ? "http_error" : "network_error")));
    },
);

const data = (p) => p.then((r) => r.data);

function upload(url, field, file, fields = {}, onProgress) {
    const form = new FormData();
    form.append(field, file, file.name || field);
    for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) form.append(k, v);
    return data(
        http.post(url, form, {
            onUploadProgress: onProgress && ((e) => e.total && onProgress(Math.round((e.loaded / e.total) * 100))),
        }),
    );
}

const MEDIA_PATH = { image: ["images", "image"], audio: ["audio", "audio"], file: ["files", "file"] };

export const api = {
    checkUser: () => data(http.post("/api/auth/check-user")),
    onboard: (body) => data(http.post("/api/auth/onboard-user", body)),
    updateProfile: (body) => data(http.patch("/api/auth/profile", body)),
    deleteAccount: () => data(http.delete("/api/auth/account")),
    callToken: () => data(http.get("/api/auth/generate-token")),

    searchUsers: (q = "", limit = 100) => data(http.get("/api/users", { params: { q, limit } })),
    user: (id) => data(http.get(`/api/users/${id}`)),
    block: (id) => data(http.post(`/api/users/${id}/block`)),
    unblock: (id) => data(http.delete(`/api/users/${id}/block`)),
    report: (id, reason) => data(http.post(`/api/users/${id}/report`, { reason })),

    chats: () => data(http.get("/api/conversations")),
    chat: (id) => data(http.get(`/api/conversations/${id}`)),
    openDirect: (userId) => data(http.post("/api/conversations/direct", { userId })),
    createGroup: (body) => data(http.post("/api/conversations", body)),
    updateGroup: (id, body) => data(http.patch(`/api/conversations/${id}`, body)),
    addMembers: (id, userIds) => data(http.post(`/api/conversations/${id}/members`, { userIds })),
    removeMember: (id, userId) => data(http.delete(`/api/conversations/${id}/members/${userId}`)),
    setAdmin: (id, userId, admin) => data(http.patch(`/api/conversations/${id}/members/${userId}`, { admin })),
    markRead: (id) => data(http.post(`/api/conversations/${id}/read`)),

    messages: (id, params) => data(http.get(`/api/conversations/${id}/messages`, { params })),
    sendText: (id, body) => data(http.post(`/api/conversations/${id}/messages`, body)),
    sendMedia: (id, kind, file, fields, onProgress) => {
        const [path, field] = MEDIA_PATH[kind];
        return upload(`/api/conversations/${id}/${path}`, field, file, fields, onProgress);
    },
    editMessage: (id, message) => data(http.patch(`/api/messages/${id}`, { message })),
    deleteMessage: (id, scope) => data(http.delete(`/api/messages/${id}`, { params: { scope } })),
    react: (id, emoji) => data(http.post(`/api/messages/${id}/reactions`, { emoji })),
    linkPreview: (url) => data(http.get("/api/link-preview", { params: { url } })),
};
