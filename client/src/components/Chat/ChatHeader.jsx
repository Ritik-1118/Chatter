import React, { useState } from "react";
import Avatar from "../common/Avatar";
import { MdCall } from "react-icons/md";
import {IoVideocam} from "react-icons/io5";
import { BiSearchAlt2 } from "react-icons/bi";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useStateProvider } from "@/context/StateContext";
import { reducerCases } from "@/context/constants";
import ContextMenu from "../common/ContextMenu";
import { useTheme } from '@/context/ThemeContext';

function ChatHeader() {
    const [{currentChatUser,onlineUsers},dispatch] = useStateProvider();
    const { theme } = useTheme();
    const [contextMenuCordinates,setContextMenuCordinates] = useState({
        x:0,
        y:0,
    });
    const [isContextMenuVisible,setIsContextMenuVisible]  = useState(false);
    const showContextMenu = (e) => {
        e.preventDefault();
        setContextMenuCordinates({ x:e.pageX -50,y:e.pageY +20 });
        setIsContextMenuVisible(true);
    };
    const ContextMenuOptions = [
        {
            name:"Exit",
            callback: async() => {
                setIsContextMenuVisible(false);
                dispatch({ type: reducerCases.SET_EXIT_CHAT});
        }},
    ];

    const handleVoiceCall = () =>{
        dispatch({type:reducerCases.SET_VOICE_CALL,voiceCall:{
            ...currentChatUser,
            type:"out-going",
            callType:"voice",
            roomId:Date.now(),

        }})
    };
    const handleVideoCall = () =>{
        dispatch({type:reducerCases.SET_VIDEO_CALL,videoCall:{
            ...currentChatUser,
            type:"out-going",
            callType:"video",
            roomId:Date.now(),
            
        }})
    };

    return (
        <div className={`h-16 px-4 py-3 flex justify-between items-center border-b z-10 ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider text-dark-primary-text' : 'bg-light-secondary-background border-light-divider text-light-primary-text'}`}>
            <div className="flex items-center justify-center gap-6">
                <Avatar type="sm" image={currentChatUser?.profilePicture}/>
                <div className="flex flex-col">
                    <span className={`${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}>{currentChatUser?.name}</span>
                    <span className={`text-sm ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>
                        {onlineUsers.includes(currentChatUser._id) ? "online" : "offline"}
                    </span>
                </div>
            </div>
            <div className=" flex gap-6">
                <MdCall className={`cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}`}
                    onClick={handleVoiceCall}
                />
                <IoVideocam className={`cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}`} 
                    onClick={handleVideoCall}
                />
                <BiSearchAlt2 className={`cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`} 
                    onClick={()=>dispatch({type:reducerCases.SET_MESSAGE_SEARCH})} 
                />
                <BsThreeDotsVertical 
                    className={`cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`} 
                    onClick={(e) => showContextMenu(e)} 
                    id="context-opener"
                />
                {isContextMenuVisible && (
                    <ContextMenu 
                        options={ContextMenuOptions}
                        cordinates={contextMenuCordinates}
                        setContextMenu={setIsContextMenuVisible}
                    />
                )}
            </div>
        </div>
    )
}

export default ChatHeader;
