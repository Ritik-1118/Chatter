import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Accessible dropdown menu rendered in a portal.
// `anchorRef` points at the element that opened it; clicks on it never count as "outside".
export default function ContextMenu({ options, anchorRef, onClose, align = "right", label = "Menu" }) {
    const ref = useRef(null);
    const [pos, setPos] = useState({ top: -9999, left: -9999 });
    const [active, setActive] = useState(0);

    useLayoutEffect(() => {
        const a = anchorRef?.current?.getBoundingClientRect?.();
        const menu = ref.current.getBoundingClientRect();
        if (!a) return;
        let left = align === "right" ? a.right - menu.width : a.left;
        let top = a.bottom + 4;
        left = Math.max(8, Math.min(left, window.innerWidth - menu.width - 8));
        if (top + menu.height > window.innerHeight - 8) top = Math.max(8, a.top - menu.height - 4);
        setPos({ top, left });
    }, [anchorRef, align]);

    useEffect(() => {
        ref.current?.querySelectorAll('[role="menuitem"]')[0]?.focus();
        const anchor = anchorRef?.current;
        const onPointer = (e) => {
            if (ref.current?.contains(e.target) || anchor?.contains?.(e.target)) return;
            onClose();
        };
        const onKey = (e) => {
            if (e.key === "Escape") {
                onClose();
                anchor?.focus?.();
            }
        };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("touchstart", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("touchstart", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [anchorRef, onClose]);

    const items = options.filter(Boolean);
    const move = (delta) => {
        const next = (active + delta + items.length) % items.length;
        setActive(next);
        ref.current?.querySelectorAll('[role="menuitem"]')[next]?.focus();
    };

    return createPortal(
        <ul
            ref={ref}
            role="menu"
            aria-label={label}
            style={{ top: pos.top, left: pos.left }}
            onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    move(1);
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    move(-1);
                }
            }}
            className="fixed z-[90] min-w-[180px] rounded-lg border border-light-divider bg-light-secondary-background py-1 text-sm text-light-primary-text shadow-xl dark:border-dark-divider dark:bg-dark-surface dark:text-dark-primary-text"
        >
            {items.map(({ name, callback, danger }, i) => (
                <li key={name} role="none">
                    <button
                        type="button"
                        role="menuitem"
                        tabIndex={i === active ? 0 : -1}
                        className={`block w-full px-4 py-2 text-left hover:bg-black/5 focus:bg-black/5 focus:outline-none dark:hover:bg-white/10 dark:focus:bg-white/10 ${
                            danger ? "text-light-error dark:text-dark-error" : ""
                        }`}
                        onClick={() => {
                            onClose();
                            callback();
                        }}
                    >
                        {name}
                    </button>
                </li>
            ))}
        </ul>,
        document.body,
    );
}
