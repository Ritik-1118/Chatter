import { useEffect } from "react";
import { reducerCases } from "@/context/constants";
import { useStateProvider } from "@/context/StateContext";
import { selectCurrentChat } from "@/context/StateReducers";
import { useToast } from "@/context/ToastContext";
import useAuthBootstrap from "@/hooks/useAuthBootstrap";
import useChatSocket from "@/hooks/useChatSocket";
import { api } from "@/lib/api";
import CallScreen from "./Call/CallScreen";
import IncomingCall from "./Call/IncomingCall";
import Chat from "./Chat/Chat";
import ChatList from "./Chatlist/ChatList";
import ConnectionBanner from "./common/ConnectionBanner";
import Empty from "./Empty";
import LeftSidebar from "./LeftSide/LeftSidebar";

export default function Main() {
    const [state, dispatch] = useStateProvider();
    const { userInfo, smWindows, showSmChatList, socketStatus, call, incomingCall, chatsLoaded } = state;
    const currentChat = selectCurrentChat(state);
    const toast = useToast();
    const { error: bootError, retry } = useAuthBootstrap(dispatch, userInfo);
    useChatSocket(state, dispatch);

    useEffect(() => {
        const onResize = () => dispatch({ type: reducerCases.SET_SM_WINDOWS, smWindows: window.innerWidth <= 768 });
        onResize();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [dispatch]);

    // Initial chat list. Socket events keep it current afterwards.
    useEffect(() => {
        if (!userInfo?.id) return;
        api.chats()
            .then(({ conversations }) => dispatch({ type: reducerCases.SET_CHATS, chats: conversations }))
            .catch((err) => toast(err.message, { type: "error" }));
    }, [userInfo?.id, dispatch, toast]);

    if (bootError) {
        return (
            <main className="flex h-screen flex-col items-center justify-center gap-4 bg-light-background text-light-primary-text dark:bg-dark-background dark:text-dark-primary-text">
                <p role="alert">Couldn&apos;t load your account: {bootError}</p>
                <button type="button" onClick={retry} className="rounded-lg bg-light-accent px-4 py-2 font-semibold text-white dark:bg-dark-accent dark:text-dark-surface">
                    Retry
                </button>
            </main>
        );
    }

    const showChat = Boolean(currentChat) && !(smWindows && showSmChatList);
    return (
        <>
            {userInfo?.id && <ConnectionBanner status={socketStatus} />}
            {incomingCall && <IncomingCall />}
            {call ? (
                <CallScreen />
            ) : (
                <main className="flex h-screen max-h-screen w-screen max-w-full overflow-hidden" aria-label="Chat interface">
                    <LeftSidebar />
                    <ChatList loading={!userInfo?.id || !chatsLoaded} hidden={smWindows && showChat} />
                    {showChat ? <Chat /> : !smWindows && <Empty />}
                </main>
            )}
        </>
    );
}
