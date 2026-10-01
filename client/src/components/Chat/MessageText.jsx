import Linkify from "linkify-react";
import dynamic from "next/dynamic";
import { find } from "linkifyjs";

const LinkPreview = dynamic(() => import("./LinkPreview"), { ssr: false });

const OPTIONS = {
    target: "_blank",
    rel: "noopener noreferrer nofollow",
    className: "text-light-link underline dark:text-dark-link",
    validate: { url: (value) => /^(https?:\/\/|www\.)/i.test(value) },
};

export default function MessageText({ text }) {
    const firstUrl = find(text || "", "url").find((l) => /^https?:\/\//i.test(l.href))?.href;
    return (
        <>
            {firstUrl && <LinkPreview url={firstUrl} />}
            <span data-testid="message-text" className="whitespace-pre-wrap break-words pr-6">
                <Linkify options={OPTIONS}>{text}</Linkify>
            </span>
        </>
    );
}
