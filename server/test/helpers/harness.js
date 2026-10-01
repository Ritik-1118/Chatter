// Black-box test harness: boots the real server (index.js) as a child process
// against an in-memory MongoDB, and exposes small HTTP / Socket.IO helpers.
import { spawn } from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";
import { io as ioc } from "socket.io-client";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..", "..");

let mongo;
let mongoBaseUri;

// A 32-char secret is required by TokenGenerator.generateToken04.
export const ZEGO_APP_ID = "123456789";
export const ZEGO_SECRET = "0123456789abcdef0123456789abcdef";

const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
});

export async function startMongo() {
    if (process.env.MONGO_TEST_URI) {
        mongoBaseUri = process.env.MONGO_TEST_URI.replace(/\/$/, "");
        return;
    }
    // Set MONGOMS_SYSTEM_BINARY to use a local mongod instead of downloading one.
    mongo = await MongoMemoryServer.create();
    mongoBaseUri = mongo.getUri().replace(/\/$/, "");
}

export async function stopMongo() {
    if (mongo) await mongo.stop();
}

const freePort = () =>
    new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.listen(0, () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
        srv.on("error", reject);
    });

export async function startServer({ env = {}, port } = {}) {
    port = port ?? (await freePort());
    const dbName = `chatter_test_${randomUUID().slice(0, 8)}`;
    const mongoUri = `${mongoBaseUri}/${dbName}`;
    // Run in a scratch cwd so uploads never land in the repo.
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "chatter-server-"));
    const logs = [];
    const child = spawn(
        process.execPath,
        ["--import", path.join(here, "fake-firebase.js"), path.join(serverRoot, "index.js")],
        {
            cwd,
            env: {
                ...process.env,
                PORT: String(port),
                MONGOURL: mongoUri,
                FIREBASE_PROJECT_ID: "chatter-test",
                FIREBASE_CLIENT_EMAIL: "test@chatter-test.iam.gserviceaccount.com",
                FIREBASE_PRIVATE_KEY: privateKey,
                ZEGO_APP_ID,
                ZEGO_SERVER_SECRET: ZEGO_SECRET,
                MEDIA_URL_SECRET: "test-media-secret-0123456789abcdef0123",
                LOG_LEVEL: "warn",
                RATE_LIMIT_MAX: "100000",
                RATE_LIMIT_UPLOAD_MAX: "100000",
                SOCKET_EVENTS_PER_10S: "100000",
                ...env,
            },
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    let exited = null;
    child.on("exit", (code, signal) => {
        exited = { code, signal };
    });
    const onData = (d) => logs.push(d.toString());
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    const baseUrl = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 20000;
    // Ready once /health reports the database is up.
    for (;;) {
        if (exited) throw new Error(`server exited early: ${JSON.stringify(exited)}\n${logs.join("")}`);
        if (Date.now() > deadline) throw new Error(`server did not start\n${logs.join("")}`);
        try {
            const res = await fetch(`${baseUrl}/health`);
            if (res.status === 200) break;
        } catch {
            /* not listening yet */
        }
        await new Promise((r) => setTimeout(r, 100));
    }

    let dbClient;
    const server = {
        baseUrl,
        cwd,
        logs,
        mongoUri,
        // Direct DB access for arranging fixtures (e.g. back-dating messages).
        async db() {
            if (!dbClient) {
                const { default: mongoose } = await import("mongoose");
                dbClient = await mongoose.createConnection(mongoUri).asPromise();
            }
            return dbClient.db;
        },
        get exited() {
            return exited;
        },
        isAlive: () => exited === null,
        async stop() {
            if (dbClient) await dbClient.close();
            if (exited) return;
            child.kill("SIGTERM");
            await new Promise((r) => child.once("exit", r));
        },
        // Fetch helper. `user` is an object returned by makeUser (or null for no auth).
        async request(method, urlPath, { user, json, body, headers = {} } = {}) {
            const h = { ...headers };
            if (user) h.Authorization = `Bearer ${user.token}`;
            let payload = body;
            if (json !== undefined) {
                h["Content-Type"] = "application/json";
                payload = JSON.stringify(json);
            }
            const res = await fetch(baseUrl + urlPath, { method, headers: h, body: payload });
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                data = text;
            }
            return { status: res.status, data, text, headers: res.headers };
        },
        // Registers a Firebase identity and onboards it; returns the user with its Mongo id.
        async createUser(name, extra = {}) {
            const user = makeUser(name);
            const res = await server.request("POST", "/api/auth/onboard-user", {
                user,
                json: { name, about: `about ${name}`, image: "/avatars/1.png", ...extra },
            });
            if (res.status !== 200 || !res.data?.user?._id) {
                throw new Error(`onboarding failed: ${res.status} ${res.text}`);
            }
            user.id = res.data.user._id;
            return user;
        },
        // Connects a socket the same way the client does (auth token, then add-user).
        async connect(user, { addUser = true } = {}) {
            const socket = ioc(baseUrl, {
                auth: { token: user.token },
                transports: ["websocket"],
                reconnection: false,
                forceNew: true,
            });
            await new Promise((resolve, reject) => {
                socket.once("connect", resolve);
                socket.once("connect_error", reject);
            });
            if (addUser) {
                socket.emit("add-user", user.id);
                await delay(100);
            }
            return socket;
        },
    };
    return server;
}

export function makeUser(name) {
    const uid = `uid-${name}-${randomUUID().slice(0, 6)}`;
    const email = `${name.toLowerCase()}-${randomUUID().slice(0, 6)}@example.test`;
    return { name, uid, email, token: `test:${uid}:${email}` };
}

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function waitFor(socket, event, ms = 1500) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
            socket.off(event, handler);
            reject(new Error(`timed out waiting for "${event}"`));
        }, ms);
        const handler = (data) => {
            clearTimeout(t);
            resolve(data);
        };
        socket.once(event, handler);
    });
}

// Resolves with every payload of `event` received within `ms`.
export function collect(socket, event, ms = 800) {
    return new Promise((resolve) => {
        const seen = [];
        const handler = (data) => seen.push(data);
        socket.on(event, handler);
        setTimeout(() => {
            socket.off(event, handler);
            resolve(seen);
        }, ms);
    });
}
