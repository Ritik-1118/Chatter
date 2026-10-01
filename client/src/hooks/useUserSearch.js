import { useEffect, useState } from "react";
import { api } from "@/lib/api";

// Debounced server-side user search.
export default function useUserSearch(term, delay = 250) {
    const [result, setResult] = useState({ term: null, users: [], error: "" });
    useEffect(() => {
        let cancelled = false;
        const t = setTimeout(() => {
            api.searchUsers(term.trim())
                .then(({ users }) => !cancelled && setResult({ term, users, error: "" }))
                .catch((err) => !cancelled && setResult({ term, users: [], error: err.message }));
        }, delay);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [term, delay]);
    return { users: result.users, error: result.error, loading: result.term !== term };
}
