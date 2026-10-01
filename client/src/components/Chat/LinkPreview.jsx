import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const cache = new Map();

export default function LinkPreview({ url }) {
    const [preview, setPreview] = useState(cache.get(url) ?? null);
    useEffect(() => {
        if (cache.has(url)) return;
        let cancelled = false;
        api.linkPreview(url)
            .then(({ preview: p }) => {
                cache.set(url, p);
                if (!cancelled) setPreview(p);
            })
            .catch(() => cache.set(url, null));
        return () => {
            cancelled = true;
        };
    }, [url]);
    if (!preview) return null;
    return (
        <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="mb-1 flex max-w-xs gap-2 overflow-hidden rounded-md bg-black/5 dark:bg-white/10">
            {preview.image && (
                <img src={preview.image} alt="" className="h-16 w-16 shrink-0 object-cover" loading="lazy" referrerPolicy="no-referrer" />
            )}
            <span className="min-w-0 p-2 text-xs">
                <span className="block truncate font-semibold">{preview.title}</span>
                {preview.description && <span className="line-clamp-2 opacity-80">{preview.description}</span>}
                <span className="block truncate opacity-60">{preview.siteName}</span>
            </span>
        </a>
    );
}
