import { FiMoon, FiSun } from "react-icons/fi";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle({ className = "", withLabel = false }) {
    const { theme, toggleTheme } = useTheme();
    const next = theme === "dark" ? "light" : "dark";
    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={`Switch to ${next} mode`}
            className={`inline-flex items-center gap-2 rounded-full p-2 text-xl text-light-accent hover:bg-black/5 dark:text-dark-accent dark:hover:bg-white/10 ${
                withLabel ? "border border-light-accent bg-light-surface px-4 text-base font-semibold shadow-md dark:border-dark-accent dark:bg-dark-surface" : ""
            } ${className}`}
        >
            {theme === "dark" ? <FiSun aria-hidden="true" /> : <FiMoon aria-hidden="true" />}
            {withLabel && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
        </button>
    );
}
