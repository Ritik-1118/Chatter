import { Server } from "socket.io";
import { z } from "zod";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { findUserForIdentity } from "../middleware/auth.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { findDirect, getOrCreateDirect, loadConversationFor } from "../services/conversations.js";
import { verifyIdToken } from "../services/firebase.js";
import { createCallLog, markDelivered, markRead } from "../services/messages.js";
import { presence } from "../services/presence.js";
import { realtime, userRoom } from "../services/realtime.js";
import { messageDto } from "../services/serialize.js";
import { objectId } from "../validate.js";

const optionalId = objectId().optional().nullable();
const schemas = {
    sendMsg: z.object({
        messageId: optionalId,
        message: z.object({ _id: z.string() }).partial().passthrough().optional().nullable(),
        tempId: z.string().max(64).optional().nullable(),
    }),
    read: z.object({ messageIds: z.array(objectId()).max(500).optional(), conversationId: optionalId }),
    typing: z.object({ conversationId: optionalId, to: optionalId }),
    invite: z.object({ to: objectId("to"), roomId: z.union([z.string().max(64), z.number()]).optional(), callType: z.enum(["voice", "video"]).optional() }),
    accept: z.object({ id: optionalId }),
    end: z.object({ from: z.unknown().optional() }),
};

function rateLimiter() {
    const capacity = config.SOCKET_EVENTS_PER_10S;
    let tokens = capacity;
    let last = Date.now();
    return () => {
        const now = Date.now();
        tokens = Math.min(capacity, tokens + ((now - last) / 10000) * capacity);
        last = now;
        if (tokens < 1) return false;
        tokens -= 1;
        return true;
    };
}

const broadcastOnline = (io) => io.emit("online-users", { onlineUsers: presence.onlineUserIds() });

async function blockedEitherWay(a, b) {
    const [ua, ub] = await Promise.all([User.findById(a, "blockedUsers deletedAt"), User.findById(b, "blockedUsers deletedAt")]);
    if (!ua || !ub || ub.deletedAt) return true;
    return ua.blockedUsers.some((x) => String(x) === String(b)) || ub.blockedUsers.some((x) => String(x) === String(a));
}

async function logCall(callerId, calleeId, callType, outcome, durationMs) {
    try {
        const conv = await getOrCreateDirect(callerId, calleeId);
        await createCallLog({ conv, callerId, callType, outcome, durationMs });
    } catch (err) {
        logger.warn({ err }, "failed to write call log");
    }
}

// Ends the call `userId` is part of, notifying the peer. Works for any reason/side.
function endCall(userId, reason) {
    const mine = presence.clearCall(userId);
    if (!mine) return false;
    const peer = presence.clearCall(mine.peerId);
    const callType = mine.callType;
    const payload = { by: userId, reason, roomId: mine.roomId, callType };
    realtime.emitToUser(mine.peerId, `${callType}-call-rejected`, payload); // legacy event name
    realtime.emitToUser(mine.peerId, "call-ended", payload);
    realtime.emitToUser(userId, "call-ended", payload);

    const callerId = mine.role === "caller" ? userId : mine.peerId;
    const calleeId = mine.role === "caller" ? mine.peerId : userId;
    const active = mine.state === "active" || peer?.state === "active";
    const outcome = active ? "completed" : reason === "declined" ? "declined" : "missed";
    const startedAt = mine.startedAt || peer?.startedAt;
    logCall(callerId, calleeId, callType, outcome, startedAt ? Date.now() - startedAt : 0);
    return true;
}

export function attachSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: { origin: config.clientOrigins, methods: ["GET", "POST"], credentials: true },
        maxHttpBufferSize: 100_000,
    });
    realtime.attach(io);

    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        let identity;
        try {
            if (!token) throw new Error("missing token");
            identity = await verifyIdToken(token);
        } catch {
            return next(new Error("unauthorized"));
        }
        const user = await findUserForIdentity(identity).catch(() => null);
        if (!user) return next(new Error("not_onboarded"));
        socket.data.userId = String(user._id);
        socket.data.name = user.name;
        next();
    });

    io.on("connection", (socket) => {
        const uid = socket.data.userId;
        const allow = rateLimiter();
        socket.join(userRoom(uid));
        const cameOnline = presence.add(uid, socket.id);
        socket.emit("online-users", { onlineUsers: presence.onlineUserIds() });
        if (cameOnline) {
            broadcastOnline(io);
            socket.broadcast.emit("user-online", { userId: uid });
        }
        markDelivered(uid).catch((err) => logger.warn({ err }, "markDelivered failed"));

        // Every handler validates its payload and can never throw out of the event loop.
        const on = (event, schema, handler) =>
            socket.on(event, async (raw, ack) => {
                const reply = (body) => typeof ack === "function" && ack(body);
                if (!allow()) return reply({ ok: false, error: "rate_limited" });
                const parsed = schema ? schema.safeParse(raw ?? {}) : { success: true, data: raw };
                if (!parsed.success) return reply({ ok: false, error: "invalid_payload" });
                try {
                    reply({ ok: true, ...((await handler(parsed.data)) || {}) });
                } catch (err) {
                    logger.warn({ err: err?.message, event, uid }, "socket handler failed");
                    reply({ ok: false, error: err?.code || "error" });
                }
            });

        // The identity comes from the handshake; the payload of add-user is ignored.
        on("add-user", null, () => {
            socket.emit("online-users", { onlineUsers: presence.onlineUserIds() });
        });

        // Only ever affects the caller's own socket.
        on("signout", null, () => {
            setTimeout(() => socket.disconnect(true), 0);
        });

        // Messages are persisted and fanned out by the REST API; this only acknowledges
        // to the sending socket so it can reconcile its optimistic copy.
        on("send-msg", schemas.sendMsg, async ({ messageId, message, tempId }) => {
            const id = messageId || message?._id;
            if (!id || !/^[0-9a-f]{24}$/i.test(id)) throw Object.assign(new Error("invalid message"), { code: "invalid_payload" });
            const msg = await Message.findById(id);
            if (!msg || String(msg.sender) !== uid) throw Object.assign(new Error("not your message"), { code: "forbidden" });
            socket.emit("msg-ack", { tempId: tempId || undefined, message: messageDto(msg) });
        });

        on("read-message", schemas.read, async ({ messageIds, conversationId }) => {
            if (!messageIds?.length && !conversationId) return {};
            return { messageIds: await markRead(uid, { messageIds, conversationId }) };
        });

        const typing = (event) =>
            on(event, schemas.typing, async ({ conversationId, to }) => {
                const conv = conversationId ? await loadConversationFor(uid, conversationId) : to ? await findDirect(uid, to) : null;
                if (!conv) return {};
                const others = conv.participants.filter((p) => String(p) !== uid);
                realtime.emitToUsers(others, event, { conversationId: String(conv._id), userId: uid, name: socket.data.name });
                return {};
            });
        typing("typing");
        typing("stop-typing");

        const invite = (fixedType) => async (data) => {
            const callType = fixedType || data.callType || "voice";
            const callee = data.to;
            if (callee === uid) throw Object.assign(new Error("self call"), { code: "invalid_payload" });
            if (presence.getCall(uid)) endCall(uid, "replaced");
            if (await blockedEitherWay(uid, callee)) {
                socket.emit("call-unavailable", { to: callee, reason: "unavailable" });
                return { delivered: false };
            }
            const busy = Boolean(presence.getCall(callee));
            if (!presence.isOnline(callee) || busy) {
                socket.emit("call-unavailable", { to: callee, reason: busy ? "busy" : "offline" });
                logCall(uid, callee, callType, "missed", 0);
                return { delivered: false };
            }
            const caller = await User.findById(uid, "name profilePicture");
            const roomId = data.roomId ?? `${Date.now()}`;
            const base = { callType, roomId, state: "ringing", startedAt: null };
            const timer = setTimeout(() => endCall(uid, "no-answer"), config.CALL_RING_TIMEOUT_SECONDS * 1000);
            timer.unref?.();
            presence.setCall(uid, { ...base, peerId: callee, role: "caller", timer });
            presence.setCall(callee, { ...base, peerId: uid, role: "callee" });
            realtime.emitToUser(callee, `incoming-${callType}-call`, {
                from: { id: uid, _id: uid, name: caller?.name, profilePicture: caller?.profilePicture },
                roomId,
                callType,
            });
            return { delivered: true, roomId };
        };
        on("outgoing-voice-call", schemas.invite, invite("voice"));
        on("outgoing-video-call", schemas.invite, invite("video"));
        on("call:invite", schemas.invite, invite(null));

        const accept = async ({ id }) => {
            const mine = presence.getCall(uid);
            if (!mine || mine.role !== "callee" || mine.state !== "ringing" || (id && id !== mine.peerId)) {
                throw Object.assign(new Error("no ringing call"), { code: "no_call" });
            }
            const caller = presence.getCall(mine.peerId);
            if (caller?.timer) clearTimeout(caller.timer);
            const startedAt = Date.now();
            presence.setCall(uid, { ...mine, state: "active", startedAt });
            if (caller) presence.setCall(mine.peerId, { ...caller, timer: null, state: "active", startedAt });
            realtime.emitToUser(mine.peerId, "accept-call", { by: uid, roomId: mine.roomId });
            socket.to(userRoom(uid)).emit("call-ended", { reason: "answered-elsewhere", roomId: mine.roomId });
            return {};
        };
        on("accept-incoming-call", schemas.accept, accept);
        on("call:accept", schemas.accept, accept);

        // Rejecting (callee, ringing), cancelling (caller, ringing) and hanging up all end the call.
        const hangUp = async () => {
            const mine = presence.getCall(uid);
            if (!mine) return { ended: false };
            const reason = mine.state === "ringing" ? (mine.role === "callee" ? "declined" : "cancelled") : "ended";
            return { ended: endCall(uid, reason) };
        };
        for (const e of ["reject-voice-call", "reject-video-call", "call:reject", "call:cancel", "call:end"]) on(e, schemas.end, hangUp);

        socket.on("disconnect", async () => {
            const wentOffline = presence.remove(uid, socket.id);
            if (!wentOffline) return;
            if (presence.getCall(uid)) endCall(uid, "disconnected");
            const lastSeen = new Date();
            await User.updateOne({ _id: uid }, { lastSeen }).catch(() => {});
            broadcastOnline(io);
            io.emit("user-offline", { userId: uid, lastSeen });
        });
    });

    return io;
}
