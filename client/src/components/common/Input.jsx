import { useId } from "react";

export default function Input({ name, state, setState, label = false, required = false, type = "text", autoComplete, maxLength, placeholder }) {
    const id = useId();
    return (
        <div className="flex w-full flex-col gap-1">
            {label && (
                <label htmlFor={id} className="px-1 text-lg font-semibold text-light-accent dark:text-dark-accent">
                    {name}
                </label>
            )}
            <input
                id={id}
                type={type}
                name={name}
                value={state}
                onChange={(e) => setState(e.target.value)}
                required={required}
                aria-label={label ? undefined : name}
                autoComplete={autoComplete}
                maxLength={maxLength}
                placeholder={placeholder}
                className="h-11 w-full rounded-xl border border-light-divider bg-light-surface px-5 py-2 text-light-primary-text shadow-sm focus:outline-none focus:ring-2 focus:ring-light-accent dark:border-dark-divider dark:bg-dark-surface dark:text-dark-primary-text dark:focus:ring-dark-accent"
            />
        </div>
    );
}
