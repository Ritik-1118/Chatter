import { useStateProvider } from "@/context/StateContext";
import axios from "axios";
import React, { useEffect } from "react";
import { GET_INITIAL_CONTACTS_RIUTE } from "@/utils/ApiRoutes";
import { reducerCases } from "@/context/constants";
import ChatLIstItem from "./ChatLIstItem";
import { useTheme } from '@/context/ThemeContext';

function List() {
    const [{ userInfo,userContacts,filteredContacts },dispatch] = useStateProvider();
    const { theme } = useTheme();

    useEffect(() => {
        const getContacts = async () => {
            try {
                const {data:{users,onlineUsers},} = await axios(`${GET_INITIAL_CONTACTS_RIUTE}/${userInfo.id}`);
                // console.log("users from List ",users,onlineUsers)
                dispatch({type:reducerCases.SET_ONLINE_USERS,onlineUsers});
                dispatch({type:reducerCases.SET_USER_CONTACTS,userContacts: users});

            } catch (error) {
                console.log(error);
            }
        };
        if(userInfo?.id) getContacts();
    },[userInfo]);

    return (
        <div className={`flex-auto overflow-auto max-h-full custom-scrollbar ${theme === 'dark' ? 'bg-dark-surface' : 'bg-light-surface'}`}>
        {filteredContacts && filteredContacts.length>0 ? (
            filteredContacts.map((contact)=> <ChatLIstItem data={contact} key={contact.id}/>)
            ) :(
                userContacts.map((contact)=> <ChatLIstItem data={contact} key={contact.id}/>)
            )}
        </div>
    )
}

export default List;
