import { forwardRef } from "react";

// Every clickable icon is a real button with an accessible name.
const IconButton = forwardRef(function IconButton({ label, title, className = "", children, ...props }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            aria-label={label}
            title={title ?? label}
            className={`inline-flex items-center justify-center rounded-full p-2 text-xl transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 ${className}`}
            {...props}
        >
            {children}
        </button>
    );
});

export default IconButton;
