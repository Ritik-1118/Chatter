import React from "react";
import ChatHeader from "./ChatHeader";
import ChatContainer from "./ChatContainer";
import MessageBar from "./MessageBar";
import { useStateProvider } from "@/context/StateContext";

function Chat() {
    const [{smWindows}] = useStateProvider();
    return (
        <>
            <div className=" border-conversation-border border-1 w-full bg-conversation-panel-background flex flex-col h-[100vh] z-10">
                <ChatHeader />
                <ChatContainer />
                <MessageBar />
            </div>
        </>
    )
}

export default Chat;
