/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    darkMode: "class",
    theme: {
        extend: {
            backgroundImage: {
                "chat-background": "url('/chat-bg.png')",
            },
            colors: {
                // Light theme
                "light-background": "#FAFAFA",
                "light-secondary-background": "#FFFFFF",
                "light-surface": "#F1F1F1",
                "light-primary-text": "#1C1C1E",
                "light-secondary-text": "#6E6E73",
                "light-accent": "#007AFF",
                "light-error": "#D32F2F",
                "light-success": "#388E3C",
                "light-bubble-sender": "#DCF8C6",
                "light-bubble-receiver": "#FFFFFF",
                "light-link": "#0066CC",
                "light-divider": "#DADADA",
                "light-scrollbar": "#DADADA",
                // Dark theme
                "dark-background": "#121212",
                "dark-secondary-background": "#1E1E1E",
                "dark-surface": "#2C2C2E",
                "dark-primary-text": "#FFFFFF",
                "dark-secondary-text": "#B0B0B0",
                "dark-accent": "#4FC3F7",
                "dark-error": "#EF5350",
                "dark-success": "#66BB6A",
                "dark-bubble-sender": "#1F3B4D",
                "dark-bubble-receiver": "#2C2C2E",
                "dark-link": "#90CAF9",
                "dark-divider": "#444444",
                "dark-scrollbar": "#444444",
                // Shared
                ack: "#34B7F1", // read receipts
                unread: "#25D366", // unread badge / call accept
            },
            gridTemplateColumns: {
                main: "1fr 2.4fr",
            },
            keyframes: {
                "fade-in": { from: { opacity: 0, transform: "translateY(16px)" }, to: { opacity: 1, transform: "translateY(0)" } },
                gradient: { "0%, 100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
            },
            animation: {
                "fade-in": "fade-in 0.4s cubic-bezier(0.4,0,0.2,1) both",
                gradient: "gradient 12s ease-in-out infinite",
            },
        },
    },
    plugins: [],
};
