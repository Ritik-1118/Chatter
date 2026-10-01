import { BiSearchAlt2 } from "react-icons/bi";

export default function UserSearchInput({ value, onChange, placeholder = "Search contacts" }) {
    return (
        <div className="flex h-14 items-center px-4 py-3">
            <label className="flex flex-grow items-center gap-3 rounded-lg border border-light-divider bg-light-secondary-background px-3 py-1 dark:border-dark-divider dark:bg-dark-secondary-background">
                <BiSearchAlt2 className="text-light-secondary-text dark:text-dark-secondary-text" aria-hidden="true" />
                <input
                    type="search"
                    placeholder={placeholder}
                    aria-label={placeholder}
                    autoFocus
                    className="w-full bg-transparent text-sm text-light-primary-text focus:outline-none dark:text-dark-primary-text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            </label>
        </div>
    );
}
