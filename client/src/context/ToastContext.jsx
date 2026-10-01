import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(() => {});
let nextId = 1;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));
    const toast = useCallback((message, { type = "info", duration = 4000 } = {}) => {
        const id = nextId++;
        setToasts((t) => [...t.slice(-3), { id, message, type }]);
        setTimeout(() => dismiss(id), duration);
    }, []);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        role={t.type === "error" ? "alert" : "status"}
                        className={`pointer-events-auto flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
                            t.type === "error" ? "bg-light-error text-white dark:bg-dark-error" : "bg-light-primary-text text-white dark:bg-dark-surface"
                        }`}
                    >
                        <span>{t.message}</span>
                        <button type="button" aria-label="Dismiss notification" className="opacity-80 hover:opacity-100" onClick={() => dismiss(t.id)}>
                            ×
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
