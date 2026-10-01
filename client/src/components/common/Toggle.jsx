// Accessible on/off switch.
export default function Toggle({ label, checked, onChange, disabled = false, description }) {
    return (
        <div className="flex w-full items-center justify-between gap-4">
            <span className="flex flex-col">
                <span>{label}</span>
                {description && <span className="text-xs text-light-secondary-text dark:text-dark-secondary-text">{description}</span>}
            </span>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-unread" : "bg-gray-400"}`}
            >
                <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
            </button>
        </div>
    );
}
