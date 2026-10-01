import { defineConfig } from "@playwright/test";

const WEB_PORT = Number(process.env.E2E_WEB_PORT || 3000);

export default defineConfig({
    testDir: "tests",
    timeout: 60000,
    expect: { timeout: 7000 },
    workers: 1,
    reporter: [["list"]],
    globalSetup: "./global-setup.js",
    use: {
        // Socket.IO CORS on the server only allows http://localhost:3000.
        baseURL: `http://localhost:${WEB_PORT}`,
        trace: "retain-on-failure",
        launchOptions: {
            args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
    },
});
