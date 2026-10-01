import { useRouter } from "next/router";
import { useRef, useState } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { TbMessagePlus } from "react-icons/tb";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import Avatar from "../common/Avatar";
import ContextMenu from "../common/ContextMenu";
import IconButton from "../common/IconButton";
import ThemeToggle from "../common/ThemeToggle";

export default function ChatListHeader() {
    const [{ userInfo }, dispatch] = useStateProvider();
    const router = useRouter();
    const menuButton = useRef(null);
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="flex h-16 items-center justify-between border-b border-light-divider bg-light-secondary-background px-4 py-3 text-light-primary-text dark:border-dark-divider dark:bg-dark-secondary-background dark:text-dark-primary-text">
            <Avatar type="sm" image={userInfo?.profilePicture} alt={userInfo?.name ? `${userInfo.name}'s avatar` : "Your avatar"} />
            <div className="flex items-center gap-2">
                <ThemeToggle />
                <IconButton label="New chat" className="text-light-accent dark:text-dark-accent" onClick={() => dispatch({ type: reducerCases.SET_PANEL, panel: "contacts" })}>
                    <TbMessagePlus aria-hidden="true" />
                </IconButton>
                <IconButton
                    ref={menuButton}
                    label="Menu"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="text-light-secondary-text dark:text-dark-secondary-text"
                    onClick={() => setMenuOpen((v) => !v)}
                >
                    <BsThreeDotsVertical aria-hidden="true" />
                </IconButton>
                {menuOpen && (
                    <ContextMenu
                        anchorRef={menuButton}
                        onClose={() => setMenuOpen(false)}
                        options={[
                            { name: "New group", callback: () => dispatch({ type: reducerCases.SET_PANEL, panel: "newGroup" }) },
                            { name: "Logout", callback: () => router.push("/logout"), danger: true },
                        ]}
                    />
                )}
            </div>
        </header>
    );
}
