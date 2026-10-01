import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
    { ignores: [".next/**", "node_modules/**", "coverage/**"] },
    ...nextVitals,
    {
        rules: {
            // Avatars and media come from the API origin with signed URLs; next/image adds nothing there.
            "@next/next/no-img-element": "off",
        },
    },
];

export default config;
