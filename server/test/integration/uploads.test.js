import { expect } from "chai";
import fs from "node:fs";
import path from "node:path";
import { startServer } from "../helpers/harness.js";

// 1x1 transparent PNG
const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
);

const upload = (server, user, route, field, { blob, filename, query }) => {
    const form = new FormData();
    if (blob) form.append(field, blob, filename);
    const qs = new URLSearchParams(query).toString();
    return server.request("POST", `/api/messages/${route}?${qs}`, { user, body: form });
};

describe("Media uploads", () => {
    let server;
    let alice;
    let bob;

    before(async () => {
        server = await startServer();
        alice = await server.createUser("Alice");
        bob = await server.createUser("Bob");
    });
    after(async () => {
        await server.stop();
    });

    const filesIn = (sub) => fs.readdirSync(path.join(server.cwd, "uploads", sub));

    describe("image messages", () => {
        it("stores an image, creates an image message and serves the file", async () => {
            const res = await upload(server, alice, "add-image-message", "image", {
                blob: new Blob([PNG], { type: "image/png" }),
                filename: "dot.png",
                query: { from: alice.id, to: bob.id },
            });
            expect(res.status).to.equal(201);
            expect(res.data.message.type).to.equal("image");
            expect(res.data.message.message).to.match(/^uploads\/images\/.+\.png$/);

            const file = await fetch(`${server.baseUrl}/${res.data.message.message}`);
            expect(file.status).to.equal(200);
            expect(file.headers.get("content-type")).to.equal("image/png");
        });

        it("[B-S22] rejects a disallowed file type with a 4xx JSON error (not a 500 HTML page)", async () => {
            const res = await upload(server, alice, "add-image-message", "image", {
                blob: new Blob(["<svg onload=alert(1)>"], { type: "image/svg+xml" }),
                filename: "x.svg",
                query: { from: alice.id, to: bob.id },
            });
            expect(res.status).to.be.within(400, 499);
            expect(res.headers.get("content-type")).to.match(/json/);
        });

        it("[B-S22] rejects an image over the 5 MB limit with 413", async () => {
            const res = await upload(server, alice, "add-image-message", "image", {
                blob: new Blob([Buffer.alloc(5 * 1024 * 1024 + 10)], { type: "image/png" }),
                filename: "big.png",
                query: { from: alice.id, to: bob.id },
            });
            expect(res.status).to.equal(413);
        });

        it("[B-S23] returns 400 (not 500) when the `from` query parameter is missing", async () => {
            const res = await upload(server, alice, "add-image-message", "image", {
                blob: new Blob([PNG], { type: "image/png" }),
                filename: "dot.png",
                query: { to: bob.id },
            });
            expect(res.status).to.equal(400);
        });

        it("[B-S24] does not leave orphaned files on disk when the request is rejected", async () => {
            const before = filesIn("images").length;
            const res = await upload(server, alice, "add-image-message", "image", {
                blob: new Blob([PNG], { type: "image/png" }),
                filename: "dot.png",
                query: { from: bob.id, to: alice.id }, // spoofed sender
            });
            expect(res.status).to.equal(403);
            expect(filesIn("images").length).to.equal(before);
        });

        it("[B-S25] validates that the receiver exists before storing an image message", async () => {
            const res = await upload(server, alice, "add-image-message", "image", {
                blob: new Blob([PNG], { type: "image/png" }),
                filename: "dot.png",
                query: { from: alice.id, to: "0123456789abcdef01234567" },
            });
            expect(res.status).to.equal(404);
        });

        it("[B-S26] reports 'delivered' for media sent to an online recipient, like text messages", async () => {
            const bobSocket = await server.connect(bob);
            try {
                const res = await upload(server, alice, "add-image-message", "image", {
                    blob: new Blob([PNG], { type: "image/png" }),
                    filename: "dot.png",
                    query: { from: alice.id, to: bob.id },
                });
                expect(res.data.message.messageStatus).to.equal("delivered");
            } finally {
                bobSocket.close();
            }
        });

        it("[B-S27] does not serve uploaded media to unauthenticated clients", async () => {
            const res = await upload(server, alice, "add-image-message", "image", {
                blob: new Blob([PNG], { type: "image/png" }),
                filename: "dot.png",
                query: { from: alice.id, to: bob.id },
            });
            const anon = await fetch(`${server.baseUrl}/${res.data.message.message}`);
            expect(anon.status).to.be.oneOf([401, 403]);
        });
    });

    describe("audio messages", () => {
        it("stores a webm voice note recorded by MediaRecorder", async () => {
            const res = await upload(server, alice, "add-audio-message", "audio", {
                blob: new Blob([Buffer.from("fake-webm")], { type: "audio/webm" }),
                filename: "recording.webm",
                query: { from: alice.id, to: bob.id },
            });
            expect(res.status).to.equal(201);
            expect(res.data.message.type).to.equal("audio");
        });

        it("[B-C19] serves the client's recording with a content type matching its real encoding", async () => {
            // CaptureAudio.jsx wraps MediaRecorder output (webm/opus in Chromium) in a
            // File named "recording.mp3" with type audio/mp3, so it is stored as .mp3
            // and served as audio/mpeg — which Safari/Firefox refuse to decode.
            const webmMagic = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00]);
            const res = await upload(server, alice, "add-audio-message", "audio", {
                blob: new Blob([webmMagic], { type: "audio/mp3" }),
                filename: "recording.mp3",
                query: { from: alice.id, to: bob.id },
            });
            expect(res.status).to.equal(201);
            const file = await fetch(`${server.baseUrl}/${res.data.message.message}`);
            expect(file.headers.get("content-type")).to.match(/webm/);
        });
    });
});
