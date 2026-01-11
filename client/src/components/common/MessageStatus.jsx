import React from "react";
import { BsCheck, BsCheckAll } from "react-icons/bs";
import { AiOutlineClockCircle, AiOutlineWarning } from "react-icons/ai";

function MessageStatus({messageStatus}) {
    const status = (messageStatus || "").toLowerCase();
    if (status === "pending") return <AiOutlineClockCircle className="text-lg text-gray-400" />;
    if (status === "failed") return <AiOutlineWarning className="text-lg text-red-500" title="Failed to send" />;
    if (status === "sent") return <BsCheck className="text-lg" />;
    if (status === "delivered") return <BsCheckAll className="text-lg" />;
    if (status === "read") return <BsCheckAll className="text-lg text-icon-ack" />;
    return null;
}

export default MessageStatus;
