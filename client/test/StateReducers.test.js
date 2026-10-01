import { describe, expect, it } from "vitest";
import { reducerCases } from "@/context/constants";
import reducer, { initialState, selectCurrentChat, selectVisibleChats, upsertMessage } from "@/context/StateReducers";

const ME = "me";
const BOB = "bob";
const CAROL = "carol";
const C_BOB = "conv-bob";
const C_CAROL = "conv-carol";

const msg = (id, conversationId, sender, extra = {}) => ({
    _id: id,
    conversationId,
    sender,
    type: "text",
    message: id,
    messageStatus: "sent",
    createdAt: "2026-09-30T10:00:00.000Z",
    ...extra,
});

const chat = (id, partnerId, name, extra = {}) => ({
    id,
    conversationId: id,
    partnerId,
    name,
    isGroup: false,
    unreadCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastMessage: msg(`last-${id}`, id, partnerId, { createdAt: "2026-01-01T00:00:00.000Z" }),
    ...extra,
});

const base = (overrides = {}) => ({
    ...initialState,
    userInfo: { id: ME, name: "Me" },
    ...overrides,
});
const run = (state, ...actions) => actions.reduce(reducer, state);

describe("messages", () => {
    it("replaces an optimistic message with the server copy (by tempId)", () => {
        let state = base({ messagesByChat: { [C_BOB]: { items: [], hasMore: false, loaded: true } } });
        const optimistic = msg("temp-1", C_BOB, ME, { tempId: "temp-1", messageStatus: "pending" });
        state = run(
            state,
            { type: reducerCases.RECEIVE_MESSAGE, message: optimistic, tempId: "temp-1" },
            { type: reducerCases.RECEIVE_MESSAGE, message: msg("real-1", C_BOB, ME, { tempId: "temp-1" }), tempId: "temp-1" },
        );
        expect(state.messagesByChat[C_BOB].items).toHaveLength(1);
        expect(state.messagesByChat[C_BOB].items[0]).toMatchObject({ _id: "real-1", messageStatus: "sent" });
    });

    it("does not duplicate when the socket echo arrives before the HTTP response", () => {
        let state = base({ messagesByChat: { [C_BOB]: { items: [], hasMore: false, loaded: true } } });
        const optimistic = msg("temp-2", C_BOB, ME, { tempId: "temp-2", messageStatus: "pending" });
        const confirmed = msg("real-2", C_BOB, ME, { tempId: "temp-2" });
        state = run(
            state,
            { type: reducerCases.RECEIVE_MESSAGE, message: optimistic, tempId: "temp-2" },
            { type: reducerCases.RECEIVE_MESSAGE, message: confirmed, tempId: "temp-2" }, // socket echo (with tempId)
            { type: reducerCases.RECEIVE_MESSAGE, message: confirmed, tempId: "temp-2" }, // HTTP response
        );
        expect(state.messagesByChat[C_BOB].items.map((m) => m._id)).toEqual(["real-2"]);
    });

    it("upsertMessage removes a stale duplicate that shares the confirmed id", () => {
        const items = [msg("real-3", C_BOB, ME), msg("temp-3", C_BOB, ME, { tempId: "temp-3" })];
        expect(upsertMessage(items, msg("real-3", C_BOB, ME), "temp-3").map((m) => m._id)).toEqual(["real-3"]);
    });

    it("[B-C12] never downgrades a message from 'read' back to 'delivered'", () => {
        let state = base({ messagesByChat: { [C_BOB]: { items: [msg("m1", C_BOB, ME, { messageStatus: "read" })], loaded: true } } });
        state = run(state, { type: reducerCases.SET_MESSAGE_STATUS, ids: ["m1"], status: "delivered" });
        expect(state.messagesByChat[C_BOB].items[0].messageStatus).toBe("read");
    });

    it("[B-C12] updates the chat-list tick when the last message becomes read", () => {
        let state = base({ chats: [chat(C_BOB, BOB, "Bob", { lastMessage: msg("m1", C_BOB, ME) })] });
        state = run(state, { type: reducerCases.SET_MESSAGE_STATUS, ids: ["m1"], status: "read" });
        expect(state.chats[0].lastMessage.messageStatus).toBe("read");
        expect(state.chats[0].messageStatus).toBe("read");
    });

    it("prepends older pages without duplicates and keeps unsent optimistic messages on refresh", () => {
        let state = base({
            messagesByChat: { [C_BOB]: { items: [msg("m3", C_BOB, BOB), msg("temp-x", C_BOB, ME, { tempId: "temp-x", messageStatus: "failed" })], loaded: true } },
        });
        state = run(state, { type: reducerCases.SET_MESSAGES, chatId: C_BOB, items: [msg("m1", C_BOB, BOB), msg("m3", C_BOB, BOB)], hasMore: true, prepend: true });
        expect(state.messagesByChat[C_BOB].items.map((m) => m._id)).toEqual(["m1", "m3", "temp-x"]);
        state = run(state, { type: reducerCases.SET_MESSAGES, chatId: C_BOB, items: [msg("m3", C_BOB, BOB), msg("m4", C_BOB, BOB)], hasMore: false });
        expect(state.messagesByChat[C_BOB].items.map((m) => m._id)).toEqual(["m3", "m4", "temp-x"]);
    });

    it("applies edits/deletes to the list and the chat preview", () => {
        let state = base({
            chats: [chat(C_BOB, BOB, "Bob", { lastMessage: msg("m1", C_BOB, BOB) })],
            messagesByChat: { [C_BOB]: { items: [msg("m1", C_BOB, BOB)], loaded: true } },
        });
        state = run(state, { type: reducerCases.UPDATE_MESSAGE, message: { ...msg("m1", C_BOB, BOB), message: "", deleted: true } });
        expect(state.messagesByChat[C_BOB].items[0].deleted).toBe(true);
        expect(state.chats[0].lastMessage.deleted).toBe(true);
    });
});

describe("chat list", () => {
    it("[B-C09] increments the unread badge and bumps the time for a message in a background chat", () => {
        let state = base({ chats: [chat(C_BOB, BOB, "Bob"), chat(C_CAROL, CAROL, "Carol")] });
        const incoming = msg("m9", C_CAROL, CAROL, { message: "ping" });
        state = run(state, { type: reducerCases.RECEIVE_MESSAGE, message: incoming });
        const carol = state.chats.find((c) => c.id === C_CAROL);
        expect(carol.lastMessage.message).toBe("ping");
        expect(carol.unreadCount).toBe(1);
        expect(carol.lastMessage.createdAt).toBe(incoming.createdAt);
    });

    it("[B-C09] moves the conversation with the newest message to the top", () => {
        let state = base({ chats: [chat(C_BOB, BOB, "Bob"), chat(C_CAROL, CAROL, "Carol")] });
        state = run(state, { type: reducerCases.RECEIVE_MESSAGE, message: msg("m9", C_CAROL, CAROL) });
        expect(state.chats[0].id).toBe(C_CAROL);
    });

    it("does not count messages in the open chat, my own messages or system notices as unread", () => {
        let state = base({ chats: [chat(C_BOB, BOB, "Bob"), chat(C_CAROL, CAROL, "Carol")], currentChatId: C_BOB });
        state = run(
            state,
            { type: reducerCases.RECEIVE_MESSAGE, message: msg("a", C_BOB, BOB) },
            { type: reducerCases.RECEIVE_MESSAGE, message: msg("b", C_CAROL, ME) },
            { type: reducerCases.RECEIVE_MESSAGE, message: msg("c", C_CAROL, CAROL, { type: "system" }) },
        );
        expect(state.chats.map((c) => c.unreadCount)).toEqual([0, 0]);
    });

    it("[B-C10] does not double-count a message whose chat row was just fetched", () => {
        const fetched = chat(C_CAROL, CAROL, "Carol", { unreadCount: 1, lastMessage: msg("n", C_CAROL, CAROL) });
        const state = run(
            base(),
            { type: reducerCases.UPSERT_CHAT, chat: fetched },
            { type: reducerCases.RECEIVE_MESSAGE, message: msg("n", C_CAROL, CAROL), alreadyCounted: true },
        );
        expect(state.chats[0].unreadCount).toBe(1);
    });

    it("[B-C10] adds a brand-new conversation to the chat list", () => {
        let state = base({ chats: [chat(C_BOB, BOB, "Bob")] });
        state = run(state, { type: reducerCases.UPSERT_CHAT, chat: chat(C_CAROL, CAROL, "Carol", { lastMessage: msg("n", C_CAROL, CAROL) }) });
        expect(state.chats.map((c) => c.id)).toEqual([C_CAROL, C_BOB]);
    });

    it("[B-C11] clears the unread badge when a chat is opened (without mutating state)", () => {
        const bob = chat(C_BOB, BOB, "Bob", { unreadCount: 3 });
        const state = run(base({ chats: [bob] }), { type: reducerCases.OPEN_CHAT, chatId: C_BOB });
        expect(state.chats[0].unreadCount).toBe(0);
        expect(selectCurrentChat(state).id).toBe(C_BOB);
        expect(bob.unreadCount).toBe(3);
    });

    it("[B-C13] contact search tolerates chats without a name", () => {
        const state = base({ chats: [chat(C_BOB, BOB, "Bob"), { id: C_CAROL }], contactSearch: "bo" });
        expect(() => selectVisibleChats(state)).not.toThrow();
        expect(selectVisibleChats(state).map((c) => c.id)).toEqual([C_BOB]);
    });

    it("[B-C13] keeps search results in sync when the chat list changes", () => {
        let state = base({ chats: [chat(C_BOB, BOB, "Bob")], contactSearch: "bo" });
        state = run(state, { type: reducerCases.RECEIVE_MESSAGE, message: msg("fresh", C_BOB, BOB, { message: "new preview" }) });
        expect(selectVisibleChats(state)[0].lastMessage.message).toBe("new preview");
    });

    it("[B-C13] distinguishes 'no search' from 'search with zero matches'", () => {
        const state = base({ chats: [chat(C_BOB, BOB, "Bob")], contactSearch: "zzz" });
        expect(selectVisibleChats(state)).toHaveLength(0);
    });

    it("propagates profile updates and block state to chat rows", () => {
        let state = base({ chats: [chat(C_BOB, BOB, "Bob", { participants: [{ id: BOB, name: "Bob" }] })] });
        state = run(
            state,
            { type: reducerCases.PROFILE_UPDATED, user: { id: BOB, name: "Robert", about: "hi", profilePicture: "/avatars/3.png" } },
            { type: reducerCases.SET_BLOCKED, userId: BOB, blocked: true },
        );
        expect(state.chats[0]).toMatchObject({ name: "Robert", profilePicture: "/avatars/3.png", blocked: true });
        expect(state.chats[0].participants[0].name).toBe("Robert");
        expect(state.userInfo.blockedUsers).toEqual([BOB]);
    });

    it("tracks typing and presence", () => {
        let state = run(
            base(),
            { type: reducerCases.SET_TYPING, chatId: C_BOB, userId: BOB, name: "Bob", typing: true },
            { type: reducerCases.SET_ONLINE_USERS, onlineUsers: [BOB, CAROL] },
            { type: reducerCases.USER_OFFLINE, userId: CAROL, lastSeen: "2026-09-30T10:00:00.000Z" },
        );
        expect(state.typing[C_BOB]).toEqual({ [BOB]: "Bob" });
        expect(state.onlineUsers).toEqual([BOB]);
        expect(state.lastSeen[CAROL]).toBe("2026-09-30T10:00:00.000Z");
        state = run(state, { type: reducerCases.SET_TYPING, chatId: C_BOB, userId: BOB, typing: false });
        expect(state.typing[C_BOB]).toEqual({});
    });
});

describe("session", () => {
    it("[B-C14] clears the previous user's chats, messages and presence on logout", () => {
        const loaded = base({
            chats: [chat(C_BOB, BOB, "Bob")],
            currentChatId: C_BOB,
            messagesByChat: { [C_BOB]: { items: [msg("m1", C_BOB, BOB)], loaded: true } },
            onlineUsers: [BOB],
            smWindows: true,
        });
        for (const action of [{ type: reducerCases.SET_USER_INFO, userInfo: undefined }, { type: reducerCases.RESET_SESSION }]) {
            const state = reducer(loaded, action);
            expect(state.currentChatId).toBeNull();
            expect(state.messagesByChat).toEqual({});
            expect(state.chats).toEqual([]);
            expect(state.onlineUsers).toEqual([]);
            expect(state.userInfo).toBeUndefined();
            expect(state.smWindows).toBe(true); // layout state survives
        }
    });

    it("tracks the call lifecycle", () => {
        const call = { direction: "outgoing", callType: "video", peer: { id: BOB }, roomId: "r1", accepted: false };
        let state = run(base(), { type: reducerCases.SET_CALL, call }, { type: reducerCases.CALL_ACCEPTED });
        expect(state.call.accepted).toBe(true);
        state = run(state, { type: reducerCases.END_CALL });
        expect(state.call).toBeNull();
    });
});
