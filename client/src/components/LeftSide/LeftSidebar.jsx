import { useState } from "react";
import { BsFillChatLeftTextFill } from "react-icons/bs";
import { CgProfile } from "react-icons/cg";
import { HiOutlineUserGroup } from "react-icons/hi";
import { IoMdMenu } from "react-icons/io";
import { MdOutlineSettings } from "react-icons/md";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import ProfileModal from "../common/ProfileModal";
import SettingModal from "../common/SettingModal";

function NavItem({ icon: Icon, label, expanded, onClick, active }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
            className={`flex w-full items-center gap-3 rounded-lg px-2 py-3 text-xl text-light-secondary-text hover:bg-black/5 dark:text-dark-secondary-text dark:hover:bg-white/10 ${
                active ? "text-light-accent dark:text-dark-accent" : ""
            }`}
        >
            <Icon aria-hidden="true" />
            {expanded && <span className="text-base">{label}</span>}
        </button>
    );
}

export default function LeftSidebar() {
    const [{ panel }, dispatch] = useStateProvider();
    const [expanded, setExpanded] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const showPanel = (p) => {
        dispatch({ type: reducerCases.SET_PANEL, panel: p });
        dispatch({ type: reducerCases.SET_SHOW_SM_CHATLIST, showSmChatList: true });
    };

    return (
        <nav
            aria-label="Main menu"
            className="z-40 flex h-full shrink-0 flex-col justify-between border-r-2 border-light-divider bg-light-secondary-background px-2 py-3 dark:border-dark-divider dark:bg-dark-secondary-background"
        >
            <div className="flex flex-col gap-1">
                <NavItem icon={IoMdMenu} label={expanded ? "Collapse menu" : "Expand menu"} expanded={expanded} onClick={() => setExpanded((v) => !v)} />
                <NavItem icon={BsFillChatLeftTextFill} label="Chats" expanded={expanded} active={panel === "chats"} onClick={() => showPanel("chats")} />
                <NavItem icon={HiOutlineUserGroup} label="New group" expanded={expanded} active={panel === "newGroup"} onClick={() => showPanel("newGroup")} />
            </div>
            <div className="flex flex-col gap-1">
                <NavItem icon={MdOutlineSettings} label="Settings" expanded={expanded} onClick={() => setSettingsOpen(true)} />
                <NavItem icon={CgProfile} label="Profile" expanded={expanded} onClick={() => setProfileOpen(true)} />
            </div>
            {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
            {settingsOpen && <SettingModal onClose={() => setSettingsOpen(false)} />}
        </nav>
    );
}
