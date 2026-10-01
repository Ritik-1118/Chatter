import js from "@eslint/js";
import globals from "globals";

export default [
    { ignores: ["node_modules/**", "uploads/**"] },
    js.configs.recommended,
    {
        languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } },
        rules: {
            "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
            eqeqeq: ["error", "always"],
            "no-console": ["error", { allow: ["error"] }],
        },
    },
    {
        files: ["test/**/*.js", "scripts/**/*.js"],
        languageOptions: { globals: { ...globals.mocha } },
        rules: { "no-console": "off" },
    },
];
