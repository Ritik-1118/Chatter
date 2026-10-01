import { FaFileAlt } from "react-icons/fa";
import { assetUrl, formatBytes } from "@/lib/media";

export default function FileMessage({ message }) {
    const name = message.file?.name || "File";
    return (
        <a
            href={message.mediaUrl ? assetUrl(message.mediaUrl) : undefined}
            download={name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-[200px] items-center gap-3 rounded-md bg-black/5 p-2 pr-6 dark:bg-white/10"
            aria-label={`Download ${name}`}
        >
            <FaFileAlt className="shrink-0 text-2xl text-light-accent dark:text-dark-accent" aria-hidden="true" />
            <span className="min-w-0">
                <span className="block truncate font-medium">{name}</span>
                <span className="text-xs opacity-70">{formatBytes(message.file?.size)}</span>
            </span>
        </a>
    );
}
