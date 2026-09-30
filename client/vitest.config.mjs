import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },
    test: {
        include: ["test/**/*.test.{js,mjs}"],
        environment: "node",
    },
});
