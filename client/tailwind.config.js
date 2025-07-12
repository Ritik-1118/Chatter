/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
        backgroundImage: {
            "chat-background": "url('/chat-bg.png')",
        },
        colors: {
          // Light theme
          // Main app background
          'light-background': '#FAFAFA',
          // Cards or chat area
          'light-secondary-background': '#FFFFFF',
          // Inputs or message bubbles
          'light-surface': '#F1F1F1',
          // Main text
          'light-primary-text': '#1C1C1E',
          // Subtext / timestamps
          'light-secondary-text': '#6E6E73',
          // Primary buttons / links
          'light-accent': '#007AFF',
          // Errors / alerts
          'light-error': '#D32F2F',
          // Success indicators
          'light-success': '#388E3C',
          // Outgoing chat bubble
          'light-bubble-sender': '#DCF8C6',
          // Incoming chat bubble
          'light-bubble-receiver': '#FFFFFF',
          // Hyperlinks
          'light-link': '#0066CC',
          // Borders / dividers
          'light-divider': '#DADADA',
          // Scrollbar styling
          'light-scrollbar': '#DADADA',
          // Dark theme
          
          // Main app background
          'dark-background': '#121212',
          // Cards or chat area
          'dark-secondary-background': '#1E1E1E',
          // Inputs or message bubbles
          'dark-surface': '#2C2C2E',
          // Main text
          'dark-primary-text': '#FFFFFF',
          // Subtext / timestamps
          'dark-secondary-text': '#B0B0B0',
          // Primary buttons / links
          'dark-accent': '#4FC3F7',
          // Errors / alerts
          'dark-error': '#EF5350',
          // Success indicators
          'dark-success': '#66BB6A',
          // Outgoing chat bubble
          'dark-bubble-sender': '#1F3B4D',
          // Incoming chat bubble
          'dark-bubble-receiver': '#2C2C2E',
          // Hyperlinks
          'dark-link': '#90CAF9',
          // Borders / dividers
          'dark-divider': '#444444',
          // Scrollbar styling
          'dark-scrollbar': '#444444',
        },
        gridTemplateColumns: {
            main: "1fr 2.4fr",
        },
        },
    },
    plugins: [],
};
