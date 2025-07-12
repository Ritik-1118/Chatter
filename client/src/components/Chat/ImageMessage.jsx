import { useStateProvider } from "@/context/StateContext";
import React from "react";
import Image from "next/image";
import { HOST } from "@/utils/ApiRoutes";
import MessageStatus from "../common/MessageStatus";
import { calculateTime } from "@/utils/CalculateTime";

function ImageMessage({ message }) {
    const [{currentChatUser, userInfo}] = useStateProvider();
    const imageUrl = `${HOST}/${message.message}`
    // {console.log("message & currentUser from ImageMessage",message,currentChatUser)}

    return (
        <div className={`p-1 rounded-lg ${message.sender === currentChatUser._id ? " bg-incoming-background" : " bg-outgoing-background"}`}>
            <div className="relative">
                <img src={imageUrl} className="rounded-lg" alt="asset" height={300} width={300} onError={(e) => console.error('Error loading image:', e)}/>
                <div className=" absolute bottom-1 right-1 flex items-end gap-1">
                    <span className=" text-bubble-meta text-[11px] pt-1 min-w-fit">
                        {calculateTime(message.createdAt)}
                    </span>
                    <span className=" text-bubble-meta">
                        {message.sender === userInfo.id && (<MessageStatus messageStatus={message.messageStatus}/>)}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default ImageMessage;
