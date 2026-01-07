import React, { memo } from "react";
import ChatHeader from "./ChatHeader";
import ChatContainer from "./ChatContainer";
import MessageBar from "./MessageBar";
import { useStateProvider } from "@/context/StateContext";

function Chat( { isMessagesLoading = false } ) {
    const [{smWindows}] = useStateProvider();

    if (isMessagesLoading) {
        return (
            <div className="border-conversation-border border-1 w-full bg-conversation-panel-background flex flex-col h-[100vh] z-10 p-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full skeleton" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/3 rounded skeleton" />
                        <div className="h-3 w-1/4 rounded skeleton" />
                    </div>
                </div>
                <div className="flex-1 space-y-3 overflow-hidden">
                    <div className="h-16 rounded-xl skeleton" />
                    <div className="h-12 rounded-xl skeleton" />
                    <div className="h-20 rounded-xl skeleton" />
                </div>
                <div className="h-12 rounded-xl skeleton" />
            </div>
        );
    }

    return (
        <div className=" border-conversation-border border-1 w-full bg-conversation-panel-background flex flex-col h-[100vh] z-10">
            <ChatHeader />
            <ChatContainer />
            <MessageBar />
        </div>
    )
}

export default memo(Chat);
