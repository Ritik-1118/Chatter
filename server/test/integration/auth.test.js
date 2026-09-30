import { expect } from "chai";
import { makeUser, startServer } from "../helpers/harness.js";

describe("Auth API (/api/auth)", () => {
    let server;
    before(async () => {
        server = await startServer();
    });
    after(async () => {
        await server.stop();
    });

    describe("authentication middleware", () => {
        it("rejects requests without a bearer token with 401 JSON", async () => {
            const res = await server.request("POST", "/api/auth/check-user");
            expect(res.status).to.equal(401);
            expect(res.data).to.have.property("message");
        });

        it("rejects requests with an invalid token with 401", async () => {
            const res = await server.request("POST", "/api/auth/check-user", {
                headers: { Authorization: "Bearer not-a-real-token" },
            });
            expect(res.status).to.equal(401);
        });
    });

    describe("check-user / onboard-user", () => {
        it("reports an unknown identity as not found", async () => {
            const res = await server.request("POST", "/api/auth/check-user", { user: makeUser("Ghost") });
            expect(res.status).to.equal(200);
            expect(res.data.status).to.equal(false);
        });

        it("onboards a new user using the email from the verified token, not the body", async () => {
            const user = makeUser("Alice");
            const res = await server.request("POST", "/api/auth/onboard-user", {
                user,
                json: { email: "spoofed@evil.test", name: "Alice", about: "hi", image: "/avatars/1.png" },
            });
            expect(res.status).to.equal(200);
            expect(res.data.user.email).to.equal(user.email);

            const check = await server.request("POST", "/api/auth/check-user", { user });
            expect(check.data.status).to.equal(true);
            expect(check.data.data.name).to.equal("Alice");
        });

        it("[B-S10] rejects onboarding with missing fields using a 400 JSON error", async () => {
            const res = await server.request("POST", "/api/auth/onboard-user", {
                user: makeUser("NoName"),
                json: { about: "x" },
            });
            expect(res.status).to.equal(400);
            expect(res.headers.get("content-type")).to.match(/json/);
        });

        it("[B-S11] rejects a second onboarding of the same identity with 409, not a 500", async () => {
            const user = makeUser("Twice");
            await server.request("POST", "/api/auth/onboard-user", {
                user,
                json: { name: "Twice", image: "/avatars/1.png" },
            });
            const res = await server.request("POST", "/api/auth/onboard-user", {
                user,
                json: { name: "Twice", image: "/avatars/1.png" },
            });
            expect(res.status).to.equal(409);
        });

        it("[B-S12] accepts a custom (uploaded/captured) avatar of realistic size", async () => {
            // Avatar.jsx and CapturePhoto.jsx store the picture as a base64 data URL.
            // A small JPEG photo is easily > 100 KB once base64-encoded.
            const image = `data:image/jpeg;base64,${Buffer.alloc(150 * 1024, 7).toString("base64")}`;
            const res = await server.request("POST", "/api/auth/onboard-user", {
                user: makeUser("Photo"),
                json: { name: "Photo", image },
            });
            expect(res.status).to.equal(200);
        });

        it("[B-S13] trims and validates the display name server-side (min 3 chars, max 50)", async () => {
            const tooShort = await server.request("POST", "/api/auth/onboard-user", {
                user: makeUser("Short"),
                json: { name: "  a ", image: "/avatars/1.png" },
            });
            expect(tooShort.status).to.equal(400);
            const tooLong = await server.request("POST", "/api/auth/onboard-user", {
                user: makeUser("Long"),
                json: { name: "x".repeat(500), image: "/avatars/1.png" },
            });
            expect(tooLong.status).to.equal(400);
        });
    });

    describe("get-contacts", () => {
        let alice;
        let bob;
        before(async () => {
            alice = await server.createUser("Alice2");
            bob = await server.createUser("Bob2");
            // Give Bob some message history so the arrays are non-empty.
            await server.request("POST", "/api/messages/add-message", {
                user: bob,
                json: { from: bob.id, to: alice.id, message: "secret-ish" },
            });
        });

        it("returns contacts grouped by initial letter", async () => {
            const res = await server.request("GET", "/api/auth/get-contacts", { user: alice });
            expect(res.status).to.equal(200);
            expect(res.data.users).to.be.an("object");
            const all = Object.values(res.data.users).flat();
            expect(all.map((u) => u.name)).to.include("Bob2");
        });

        it("[B-S14] does not include the requesting user in their own contact list", async () => {
            const res = await server.request("GET", "/api/auth/get-contacts", { user: alice });
            const all = Object.values(res.data.users).flat();
            expect(all.map((u) => u._id)).to.not.include(alice.id);
        });

        it("[B-S15] does not expose other users' email addresses", async () => {
            const res = await server.request("GET", "/api/auth/get-contacts", { user: alice });
            const bobEntry = Object.values(res.data.users).flat().find((u) => u._id === bob.id);
            expect(bobEntry).to.not.have.property("email");
        });

        it("[B-S16] returns a stable `id` field the client uses as a React key", async () => {
            // ContactsList.jsx and List.jsx render `key={contact.id}`.
            const res = await server.request("GET", "/api/auth/get-contacts", { user: alice });
            const bobEntry = Object.values(res.data.users).flat().find((u) => u._id === bob.id);
            expect(bobEntry.id).to.equal(bob.id);
        });
    });

    describe("generate-token (Zego call token)", () => {
        let alice;
        let bob;
        before(async () => {
            alice = await server.createUser("Alice3");
            bob = await server.createUser("Bob3");
        });

        it("issues a Zego token (04-prefixed) for the caller's own id", async () => {
            const res = await server.request("GET", `/api/auth/generate-token/${alice.id}`, { user: alice });
            expect(res.status).to.equal(200);
            expect(res.data.token).to.match(/^04/);
        });

        it("[B-S05] refuses to mint a call token for a different user id", async () => {
            const res = await server.request("GET", `/api/auth/generate-token/${bob.id}`, { user: alice });
            expect(res.status).to.equal(403);
        });
    });

    describe("profile management", () => {
        it("[G-01] exposes an endpoint to update name / about / avatar", async () => {
            const alice = await server.createUser("Alice4");
            const res = await server.request("PATCH", "/api/auth/profile", {
                user: alice,
                json: { name: "Alice Renamed", about: "new status" },
            });
            expect(res.status).to.equal(200);
        });
    });

    describe("operational endpoints", () => {
        it("[G-02] exposes an unauthenticated health check", async () => {
            const res = await server.request("GET", "/health");
            expect(res.status).to.equal(200);
        });

        it("[B-S17] returns JSON (not an HTML stack page) for unknown API routes", async () => {
            const res = await server.request("GET", "/api/messages/does-not-exist", { user: makeUser("X") });
            expect(res.status).to.equal(404);
            expect(res.headers.get("content-type")).to.match(/json/);
        });
    });
});
