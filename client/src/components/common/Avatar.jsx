import { assetUrl } from "@/lib/media";

const SIZES = { xs: "h-8 w-8", sm: "h-10 w-10", lg: "h-14 w-14", xl: "h-40 w-40 sm:h-60 sm:w-60" };

// Display-only avatar. Editable avatars use AvatarPicker.
export default function Avatar({ type = "sm", image, alt = "Avatar", online = false }) {
    return (
        <span className={`relative inline-block shrink-0 ${SIZES[type] ?? SIZES.sm}`}>
            <img
                src={assetUrl(image)}
                alt={alt}
                className="h-full w-full rounded-full bg-light-surface object-cover dark:bg-dark-surface"
                onError={(e) => {
                    if (!e.currentTarget.src.endsWith("/default_avatar.png")) e.currentTarget.src = "/default_avatar.png";
                }}
            />
            {online && (
                <span
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-light-secondary-background bg-unread dark:border-dark-secondary-background"
                    aria-label="online"
                />
            )}
        </span>
    );
}
