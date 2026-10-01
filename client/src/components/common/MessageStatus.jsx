import { AiOutlineClockCircle, AiOutlineWarning } from "react-icons/ai";
import { BsCheck, BsCheckAll } from "react-icons/bs";

const LABELS = { pending: "Sending", failed: "Failed to send", sent: "Sent", delivered: "Delivered", read: "Read" };

export default function MessageStatus({ messageStatus }) {
    const status = String(messageStatus || "").toLowerCase();
    const label = LABELS[status];
    if (!label) return null;
    const common = { "aria-label": label, role: "img", title: label };
    if (status === "pending") return <AiOutlineClockCircle {...common} className="text-base text-light-secondary-text dark:text-dark-secondary-text" />;
    if (status === "failed") return <AiOutlineWarning {...common} className="text-base text-light-error dark:text-dark-error" />;
    if (status === "sent") return <BsCheck {...common} className="text-lg text-light-secondary-text dark:text-dark-secondary-text" />;
    if (status === "delivered") return <BsCheckAll {...common} className="text-lg text-light-secondary-text dark:text-dark-secondary-text" />;
    return <BsCheckAll {...common} className="text-lg text-ack" />;
}
