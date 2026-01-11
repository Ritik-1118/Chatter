import React from "react";
import Image from "next/image";
import { useStateProvider } from "@/context/StateContext";
import { useTheme } from '@/context/ThemeContext';
import { reducerCases } from "@/context/constants";

function Empty() {
    const [{showSmChatList, smWindows}, dispatch] = useStateProvider();
    const { theme } = useTheme();

    const openChatList = () => {
        dispatch({ type: reducerCases.SET_SHOW_SM_CHATLIST, showSmChatList: true });
    };

    return(
        <div className={`${showSmChatList && smWindows && "hidden"} w-full h-[100vh] flex items-center justify-center relative overflow-hidden ${theme === 'dark' ? 'bg-dark-background' : 'bg-light-background'}`}>
            <div className={`absolute inset-0 z-0 animate-gradient ${theme === 'dark' ? 'bg-dark-accent' : 'bg-light-accent'} opacity-20`} style={{ filter: 'blur(3px)' }} />
            <div className="relative z-10 flex flex-col items-center justify-center gap-4 px-4 text-center">
                <Image src={"/gifs/G1.gif"} alt="Chatter" width={180} height={180} className="rounded-full shadow-lg mb-2" />
                <span className={`text-4xl font-extrabold tracking-wide font-mono ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}`}>Chatter</span>
                <h2 className="text-2xl font-semibold">Welcome to Chatter!</h2>
                <p className={`text-base max-w-xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}>
                    Select a chat to get started or start a new conversation. Enjoy seamless, real-time messaging with a beautiful interface.
                </p>
                <button
                    className={`mt-2 px-5 py-3 rounded-xl font-semibold shadow-md transition-all duration-200 hover:scale-105 focus:outline-none ${theme === 'dark' ? 'bg-dark-accent text-dark-surface border-dark-accent' : 'bg-light-accent text-light-surface border-light-accent'} border`}
                    onClick={openChatList}
                >
                    Open chat list
                </button>
            </div>
            <style jsx global>{`
                @keyframes gradient {
                    0%, 100% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                }
                .animate-gradient {
                    animation: gradient 12s ease-in-out infinite;
                }
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 1.2s cubic-bezier(0.4,0,0.2,1) both;
                }
            `}</style>
        </div>
    )
}

export default Empty;
