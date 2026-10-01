// Builds a copy of ../client whose only difference is that "firebase/app" and
// "firebase/auth" resolve to local shims (see ../mocks). All app code is untouched.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const clientSrc = path.resolve(root, "..", "client");
export const buildDir = path.join(root, ".build", "client");
export const API_PORT = Number(process.env.E2E_API_PORT || 8765);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT || 3000);

export function buildClient() {
    fs.rmSync(buildDir, { recursive: true, force: true });
    fs.mkdirSync(buildDir, { recursive: true });
    for (const entry of ["src", "public", "jsconfig.json", "tailwind.config.js", "postcss.config.js"]) {
        fs.cpSync(path.join(clientSrc, entry), path.join(buildDir, entry), { recursive: true });
    }
    fs.copyFileSync(path.join(clientSrc, "next.config.js"), path.join(buildDir, "next.config.base.js"));
    fs.copyFileSync(path.join(clientSrc, "package.json"), path.join(buildDir, "package.json"));
    fs.symlinkSync(path.join(clientSrc, "node_modules"), path.join(buildDir, "node_modules"), "dir");
    fs.cpSync(path.join(root, "mocks"), path.join(buildDir, "e2e-mocks"), { recursive: true });
    fs.writeFileSync(
        path.join(buildDir, "next.config.js"),
        `const path = require("path");
const base = require("./next.config.base.js");
const alias = {
    "@firebase/app": "./e2e-mocks/firebase-app.js",
    "@firebase/auth": "./e2e-mocks/firebase-auth.js",
};
module.exports = {
    ...base,
    turbopack: { ...(base.turbopack || {}), root: path.resolve(__dirname, "../../.."), resolveAlias: { ...(base.turbopack?.resolveAlias || {}), ...alias } },
    webpack(config, ctx) {
        const out = base.webpack ? base.webpack(config, ctx) : config;
        out.resolve.alias = {
            ...out.resolve.alias,
            "@firebase/app$": path.resolve(__dirname, alias["@firebase/app"]),
            "@firebase/auth$": path.resolve(__dirname, alias["@firebase/auth"]),
        };
        return out;
    },
};
`,
    );
    execSync("npx next build", {
        cwd: buildDir,
        stdio: "inherit",
        env: {
            ...process.env,
            NEXT_TELEMETRY_DISABLED: "1",
            NEXT_PUBLIC_API_HOST: `http://localhost:${API_PORT}`,
            // Deliberately no NEXT_PUBLIC_FIREBASE_* values: the build must not need them.
        },
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) buildClient();
