import React from "react";
import { BsCheck, BsCheckAll } from "react-icons/bs";

function MessageStatus({messageStatus}) {
    const status = (messageStatus || "").toLowerCase();
    return (
        <>
        {status === "sent" && <BsCheck className=" text-lg"/>}
        {status === "delivered" && <BsCheckAll className=" text-lg"/>}
        {status === "read" && <BsCheckAll className=" text-lg text-icon-ack"/>}
        </>
    )
}

export default MessageStatus;
