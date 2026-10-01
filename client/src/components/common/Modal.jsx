import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Dialog with focus trap, Escape to close and focus restoration.
export default function Modal({ title, onClose, children, closeLabel, className = "max-w-md" }) {
    const ref = useRef(null);

    useEffect(() => {
        const previous = document.activeElement;
        const nodes = () => [...(ref.current?.querySelectorAll(FOCUSABLE) ?? [])];
        (nodes()[1] ?? nodes()[0])?.focus();
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
            }
            if (e.key !== "Tab") return;
            const list = nodes();
            if (!list.length) return;
            const first = list[0];
            const last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            previous?.focus?.();
        };
    }, [onClose]);

    return createPortal(
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-light-divider bg-light-secondary-background p-6 text-light-primary-text shadow-2xl animate-fade-in dark:border-dark-divider dark:bg-dark-secondary-background dark:text-dark-primary-text ${className}`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={closeLabel || `Close ${title}`}
                    className="absolute right-3 top-3 rounded-full p-2 text-2xl hover:bg-black/5 dark:hover:bg-white/10"
                >
                    <IoClose aria-hidden="true" />
                </button>
                <h2 className="mb-4 pr-10 text-xl font-bold text-light-accent dark:text-dark-accent">{title}</h2>
                {children}
            </div>
        </div>,
        document.body,
    );
}
