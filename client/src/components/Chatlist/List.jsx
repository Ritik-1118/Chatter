import { useStateProvider } from "@/context/StateContext";
import axios from "axios";
import React, { useEffect } from "react";
import { GET_INITIAL_CONTACTS_RIUTE, GET_USER_GROUPS_ROUTE } from "@/utils/ApiRoutes";
import { reducerCases } from "@/context/constants";
import ChatLIstItem from "./ChatLIstItem";
import { useTheme } from '@/context/ThemeContext';

function List() {
    const [{ userInfo,userContacts,filteredContacts, userGroups },dispatch] = useStateProvider();
    const { theme } = useTheme();

    useEffect(() => {
        const getContacts = async () => {
            try {
                const {data:{users,onlineUsers},} = await axios(`${GET_INITIAL_CONTACTS_RIUTE}/${userInfo.id}`);
                dispatch({type:reducerCases.SET_ONLINE_USERS,onlineUsers});
                dispatch({type:reducerCases.SET_USER_CONTACTS,userContacts: users});

            } catch (error) {
                console.log(error);
            }
        };
        const getGroups = async () => {
            try {
                const {data:{groups}} = await axios(`${GET_USER_GROUPS_ROUTE}/${userInfo.id}`);
                dispatch({type:reducerCases.SET_USER_GROUPS,userGroups: groups});
            } catch (error) {
                console.log(error);
            }
        };

        if(userInfo?.id) {
            getContacts();
            getGroups();
        }
    },[userInfo]);

    return (
        <div className={`flex-auto overflow-auto max-h-full custom-scrollbar ${theme === 'dark' ? 'bg-dark-surface' : 'bg-light-surface'}`}>
        {filteredContacts && filteredContacts.length>0 ? (
            filteredContacts.map((contact)=> <ChatLIstItem data={contact} key={contact.id}/>)
            ) :(
                userContacts.map((contact)=> <ChatLIstItem data={contact} key={contact.id}/>)
            )}
            {userGroups.map((group) => <ChatLIstItem data={group} key={group.id} isGroup />)}
        </div>
    )
}

export default List;
