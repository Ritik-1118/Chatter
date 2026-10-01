import { BiArrowBack } from "react-icons/bi";
import IconButton from "../common/IconButton";

export default function PanelHeader({ title, onBack }) {
    return (
        <header className="flex h-24 items-end gap-6 bg-light-secondary-background px-3 py-4 text-light-accent dark:bg-dark-secondary-background dark:text-dark-accent">
            <IconButton label="Back" onClick={onBack}>
                <BiArrowBack aria-hidden="true" />
            </IconButton>
            <h2 className="pb-2 text-lg">{title}</h2>
        </header>
    );
}
