import { BiSearchAlt2 } from "react-icons/bi";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";

export default function SearchBar() {
    const [{ contactSearch }, dispatch] = useStateProvider();
    return (
        <div className="flex h-14 items-center bg-light-surface px-4 py-3 dark:bg-dark-surface">
            <label className="flex flex-grow items-center gap-3 rounded-lg border border-light-divider bg-light-secondary-background px-3 py-1 dark:border-dark-divider dark:bg-dark-secondary-background">
                <BiSearchAlt2 className="text-light-secondary-text dark:text-dark-secondary-text" aria-hidden="true" />
                <input
                    type="search"
                    placeholder="Search chats"
                    aria-label="Search chats"
                    className="w-full bg-transparent text-sm text-light-primary-text focus:outline-none dark:text-dark-primary-text"
                    value={contactSearch}
                    onChange={(e) => dispatch({ type: reducerCases.SET_CONTACT_SEARCH, contactSearch: e.target.value })}
                />
            </label>
        </div>
    );
}
