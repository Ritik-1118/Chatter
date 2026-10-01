import { createContext, useCallback, useContext, useEffect } from "react";
import { createPersistentStore, usePersistentStore } from "@/lib/persistentStore";

const KEY = "theme";
const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {}, setTheme: () => {} });

const systemTheme = () => (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");

const themeStore = createPersistentStore(KEY, "dark", {
    parse: (raw) => raw,
    serialize: (v) => v,
    migrate: (v) => (v === "light" || v === "dark" ? v : systemTheme()),
});

// Runs before React hydrates (see _document) to avoid a flash of the wrong theme.
export const themeBootScript = `try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.classList.toggle("dark",t==="dark")}catch(e){document.documentElement.classList.add("dark")}`;

export function ThemeProvider({ children }) {
    const theme = usePersistentStore(themeStore);
    useEffect(() => {
        document.documentElement.classList.toggle("dark", theme === "dark");
    }, [theme]);
    const setTheme = useCallback((next) => themeStore.set(next), []);
    const toggleTheme = useCallback(() => themeStore.set((t) => (t === "dark" ? "light" : "dark")), []);
    return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
