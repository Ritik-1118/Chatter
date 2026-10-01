import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startMongo, startServer, stopMongo } from "../server/test/helpers/harness.js";
import { API_PORT, WEB_PORT, buildClient, buildDir } from "./scripts/build-client.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const STATE_FILE = path.join(here, ".build", "state.json");

const portInUse = (port) =>
    new Promise((resolve) => {
        const sock = net.connect(port, "127.0.0.1");
        sock.once("connect", () => {
            sock.destroy();
            resolve(true);
        });
        sock.once("error", () => resolve(false));
    });

export default async function globalSetup() {
    if (!process.env.E2E_SKIP_BUILD || !fs.existsSync(path.join(buildDir, ".next"))) buildClient();

    await startMongo();
    const server = await startServer({ port: API_PORT });

    if (await portInUse(WEB_PORT)) throw new Error(`port ${WEB_PORT} is already in use (a stale next server?)`);
    // Own process group, so teardown can stop next and all of its children.
    const web = spawn(process.execPath, [path.join(buildDir, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(WEB_PORT)], {
        cwd: buildDir,
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
    });
    let webLog = "";
    web.stdout.on("data", (d) => (webLog += d));
    web.stderr.on("data", (d) => (webLog += d));
    const deadline = Date.now() + 60000;
    for (;;) {
        try {
            const res = await fetch(`http://localhost:${WEB_PORT}/login`);
            if (res.ok) break;
        } catch {}
        if (Date.now() > deadline) throw new Error(`next start did not come up\n${webLog}`);
        await new Promise((r) => setTimeout(r, 300));
    }

    fs.writeFileSync(STATE_FILE, JSON.stringify({ apiUrl: server.baseUrl, mongoUri: server.mongoUri }));

    return async () => {
        try {
            process.kill(-web.pid, "SIGTERM");
        } catch {
            /* already gone */
        }
        await server.stop();
        await stopMongo();
        if (process.env.E2E_DUMP_SERVER_LOG) console.log(server.logs.join(""));
    };
}
