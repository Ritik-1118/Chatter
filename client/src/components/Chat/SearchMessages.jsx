import { useStateProvider } from "@/context/StateContext";
import { reducerCases } from "@/context/constants";
import { calculateTime } from "@/utils/CalculateTime";
import React, { useEffect, useState } from "react";
import { BiSearchAlt2 } from "react-icons/bi";
import { IoClose } from "react-icons/io5";
import { useTheme } from '@/context/ThemeContext';

function SearchMessages() {
    const [{currentChatUser,messages},dispatch] = useStateProvider();
    const [searchTerm,setSearchTerm] = useState("");
    const [searchedMessages,setSearchedMessages] = useState([]);
    const { theme } = useTheme();

    useEffect(() => {
        if (searchTerm) {
            setSearchedMessages(
                messages.filter(
                    (message) =>
                    message.type === "text" && message.message.includes(searchTerm)
                )
            );
        } else {
            setSearchedMessages([]);
        }
    }, [searchTerm]);

    return (
        <div className={`w-full flex flex-col z-10 max-h-screen border ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider text-dark-primary-text' : 'bg-light-secondary-background border-light-divider text-light-primary-text'}`}>
            <div className={`h-16 px-4 py-5 flex gap-10 items-center border-b ${theme === 'dark' ? 'bg-dark-surface border-dark-divider text-dark-primary-text' : 'bg-light-surface border-light-divider text-light-primary-text'}`}>
                <IoClose className={`cursor-pointer text-2xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}
                    onClick={()=> dispatch({type:reducerCases.SET_MESSAGE_SEARCH})}
                />
                <span>Search Messages</span>
            </div>
            <div className="overflow-auto custom-scrollbar h-full">
                <div className="flex items-center flex-col w-full">
                    <div className={`flex px-5 items-center gap-3 h-14 w-full`}>
                        <div className={`flex items-center gap-5 px-3 py-1 rounded-lg flex-grow border ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider' : 'bg-light-secondary-background border-light-divider'}`}>
                            <div>
                                <BiSearchAlt2 className={`cursor-pointer text-l ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}/>
                            </div>
                            <div>
                                <input 
                                    type="text" 
                                    placeholder="Search Messages" 
                                    className={`bg-transparent text-sm focus:outline-none w-full ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`} 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <span className={`mt-10 ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}>
                        {!searchTerm.length &&
                        `Search for messages with ${currentChatUser.name}`}
                    </span>
                </div>
                <div className="flex justify-center h-full flex-col">
                    {searchTerm.length>0 && !searchedMessages.length && (
                        <span className={`${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'} w-full flex justify-center`}>
                            No messages found.
                        </span>
                    )}
                    <div className="flex flex-col w-full h-full">
                        {searchedMessages.map((message)=> (
                            <div className={`flex cursor-pointer flex-col justify-center w-full px-5 border-b py-5 ${theme === 'dark' ? 'hover:bg-dark-surface border-dark-divider' : 'hover:bg-light-surface border-light-divider'}`}>
                                <div className={`text-sm ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}>{calculateTime(message.createdAt)}</div>
                                <div className={`${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}`}>{message.message}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SearchMessages;
