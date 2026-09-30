import { describe, expect, it } from "vitest";
import reducer, { initialState } from "@/context/StateReducers";
import { reducerCases } from "@/context/constants";

const ME = "me";
const BOB = "bob";
const CAROL = "carol";

const base = (overrides = {}) => ({
    ...initialState,
    userInfo: { id: ME, name: "Me" },
    ...overrides,
});

const contact = (id, name, extra = {}) => ({
    _id: id,
    name,
    message: "old",
    type: "text",
    messageStatus: "read",
    totalUnreadMessages: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    sender: id,
    receiver: ME,
    ...extra,
});

describe("StateReducers — messages", () => {
    it("replaces an optimistic message with the server-confirmed one (by tempId)", () => {
        let state = base({ currentChatUser: { _id: BOB } });
        const optimistic = { _id: "temp-1", tempId: "temp-1", sender: ME, receiver: BOB, message: "hi", messageStatus: "pending" };
        state = reducer(state, { type: reducerCases.UPSERT_MESSAGE, chatId: BOB, message: optimistic });
        state = reducer(state, {
            type: reducerCases.UPSERT_MESSAGE,
            chatId: BOB,
            tempId: "temp-1",
            message: { _id: "real-1", sender: ME, receiver: BOB, message: "hi", messageStatus: "sent" },
        });
        expect(state.messages).toHaveLength(1);
        expect(state.messages[0]).toMatchObject({ _id: "real-1", messageStatus: "sent" });
        expect(state.messagesByChat[BOB]).toBe(state.messages);
    });

    it("does not duplicate a message when the socket ack arrives after the HTTP response", () => {
        let state = base({ currentChatUser: { _id: BOB } });
        const confirmed = { _id: "real-2", sender: ME, receiver: BOB, message: "yo", messageStatus: "sent" };
        state = reducer(state, { type: reducerCases.UPSERT_MESSAGE, chatId: BOB, message: confirmed });
        state = reducer(state, { type: reducerCases.UPSERT_MESSAGE, chatId: BOB, tempId: "temp-x", message: confirmed });
        expect(state.messages).toHaveLength(1);
    });

    it("[B-C12] never downgrades a message from 'read' back to 'delivered'", () => {
        let state = base({
            currentChatUser: { _id: BOB },
            messages: [{ _id: "m1", sender: ME, receiver: BOB, messageStatus: "read" }],
            messagesByChat: { [BOB]: [{ _id: "m1", sender: ME, receiver: BOB, messageStatus: "read" }] },
        });
        // A late "delivered" socket event arrives after the "read" event.
        state = reducer(state, { type: reducerCases.BULK_UPDATE_MESSAGE_STATUS, ids: ["m1"], status: "delivered" });
        expect(state.messages[0].messageStatus).toBe("read");
    });

    it("[B-C12] updates the chat-list tick when the last message becomes read", () => {
        let state = base({
            userContacts: [contact(BOB, "Bob", { messageId: "m1", sender: ME, receiver: BOB, messageStatus: "sent" })],
        });
        state = reducer(state, { type: reducerCases.BULK_UPDATE_MESSAGE_STATUS, ids: ["m1"], status: "read" });
        expect(state.userContacts[0].messageStatus).toBe("read");
    });
});

describe("StateReducers — chat list", () => {
    it("[B-C09] increments the unread badge and bumps the time for a message in a background chat", () => {
        let state = base({ userContacts: [contact(BOB, "Bob"), contact(CAROL, "Carol")] });
        const incoming = {
            _id: "m9",
            sender: CAROL,
            receiver: ME,
            message: "ping",
            type: "text",
            createdAt: "2026-09-30T10:00:00.000Z",
        };
        state = reducer(state, { type: reducerCases.UPDATE_CONTACT_PREVIEW, message: incoming });
        const carol = state.userContacts.find((c) => c._id === CAROL);
        expect(carol.message).toBe("ping");
        expect(carol.totalUnreadMessages).toBe(1);
        expect(carol.createdAt).toBe(incoming.createdAt);
    });

    it("[B-C09] moves the conversation with the newest message to the top", () => {
        let state = base({ userContacts: [contact(BOB, "Bob"), contact(CAROL, "Carol")] });
        state = reducer(state, {
            type: reducerCases.UPDATE_CONTACT_PREVIEW,
            message: { _id: "m9", sender: CAROL, receiver: ME, message: "ping", createdAt: "2026-09-30T10:00:00.000Z" },
        });
        expect(state.userContacts[0]._id).toBe(CAROL);
    });

    it("[B-C10] adds a brand-new conversation to the chat list when a stranger messages me", () => {
        let state = base({ userContacts: [contact(BOB, "Bob")] });
        state = reducer(state, {
            type: reducerCases.UPDATE_CONTACT_PREVIEW,
            message: { _id: "m10", sender: CAROL, receiver: ME, message: "hi, new here", createdAt: "2026-09-30T10:00:00.000Z" },
        });
        expect(state.userContacts.map((c) => c._id)).toContain(CAROL);
    });

    it("[B-C11] clears the unread badge when a chat is opened (without mutating state)", () => {
        const bob = contact(BOB, "Bob", { totalUnreadMessages: 3 });
        let state = base({ userContacts: [bob] });
        state = reducer(state, { type: reducerCases.CHANGE_CURRENT_CHAT_USER, user: { _id: BOB, name: "Bob" } });
        expect(state.userContacts[0].totalUnreadMessages).toBe(0);
        expect(bob.totalUnreadMessages).toBe(3); // original object untouched
    });

    it("[B-C13] contact search tolerates contacts without a name", () => {
        const state = base({ userContacts: [contact(BOB, "Bob"), { _id: CAROL }] });
        expect(() =>
            reducer(state, { type: reducerCases.SET_CONTACT_SEARCH, contactSearch: "bo" }),
        ).not.toThrow();
    });

    it("[B-C13] keeps search results in sync when the contact list changes", () => {
        let state = base({ userContacts: [contact(BOB, "Bob")] });
        state = reducer(state, { type: reducerCases.SET_CONTACT_SEARCH, contactSearch: "bo" });
        state = reducer(state, {
            type: reducerCases.SET_USER_CONTACTS,
            userContacts: [contact(BOB, "Bob", { message: "new preview" })],
        });
        expect(state.filteredContacts[0].message).toBe("new preview");
    });

    it("[B-C13] distinguishes 'no search' from 'search with zero matches'", () => {
        let state = base({ userContacts: [contact(BOB, "Bob")] });
        state = reducer(state, { type: reducerCases.SET_CONTACT_SEARCH, contactSearch: "zzz" });
        // List.jsx renders `filteredContacts.length > 0 ? filteredContacts : userContacts`,
        // so an empty result silently shows every contact.
        const visible = state.filteredContacts.length > 0 ? state.filteredContacts : state.userContacts;
        expect(visible).toHaveLength(0);
    });
});

describe("StateReducers — session", () => {
    it("[B-C14] clears the previous user's chats, contacts and socket state on logout", () => {
        let state = base({
            currentChatUser: { _id: BOB },
            messages: [{ _id: "m1" }],
            messagesByChat: { [BOB]: [{ _id: "m1" }] },
            userContacts: [contact(BOB, "Bob")],
            onlineUsers: [BOB],
        });
        state = reducer(state, { type: reducerCases.SET_USER_INFO, userInfo: undefined });
        expect(state.currentChatUser).toBeUndefined();
        expect(state.messagesByChat).toEqual({});
        expect(state.userContacts).toEqual([]);
        expect(state.onlineUsers).toEqual([]);
    });
});
