import { useStateProvider } from "@/context/StateContext";
import { reducerCases } from "@/context/constants";
import { GET_ALL_CONTACTS } from "@/utils/ApiRoutes";
import axios from "axios";
import React, { useEffect, useState } from "react";
import {BiArrowBack,BiSearchAlt2} from "react-icons/bi";
import ChatLIstItem from "./ChatLIstItem";
import { useTheme } from '@/context/ThemeContext';

function ContactsList() {

    const [ allContacts,setAllContacts ] = useState([]);
    const [searchTerm,setSearchTerm] = useState("");
    const [searchContacts,setSearchContacts] = useState([]);
    const [{},dispatch] = useStateProvider();
    const { theme } = useTheme();

    useEffect(()=>{
        if(searchTerm.length){
            const filteredData = {};
            Object.keys(allContacts).forEach((key)=>{
                filteredData[key] = allContacts[key].filter((obj)=> 
                    obj.name.toLowerCase().includes(searchTerm.toLowerCase()
                ));
            });
            setSearchContacts(filteredData);
        }else{
            setSearchContacts(allContacts);
        }
    },[searchTerm]);

    useEffect(()=>{
        const getContacts = async() =>{
            try {
                const {
                    data:{users},
                } = await axios.get(GET_ALL_CONTACTS);
                // console.log("**************",users)
                setAllContacts(users);
                setSearchContacts(users);
            } catch (error) {
                console.log(error);
            }
        };
        getContacts();
    },[])

    return (
        <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-dark-secondary-background text-dark-primary-text' : 'bg-light-secondary-background text-light-primary-text'}`}>
            <div className="h-24 flex items-end px-3 py-4">
                <div className={`flex items-center gap-12 ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` }>
                    <BiArrowBack className="cursor-pointer text-xl" onClick={()=>dispatch({type:reducerCases.SET_ALL_CONTACTS_PAGE})} />
                    <span>New Chat</span>
                </div>
            </div>

            <div className={`h-full flex-auto overflow-auto custom-scrollbar ${theme === 'dark' ? 'bg-dark-surface' : 'bg-light-surface'}` }>
                <div className="flex py-3 items-center gap-3 h-14">
                    <div className={`flex items-center gap-5 px-3 py-1 rounded-lg flex-grow mx-4 border ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider' : 'bg-light-secondary-background border-light-divider'}` }>
                        <div>
                            <BiSearchAlt2 className={`cursor-pointer text-l ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}/>
                        </div>
                        <div>
                            <input 
                                type="text" 
                                placeholder="Search Contacts" 
                                className={`bg-transparent text-sm focus:outline-none w-full ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}
                                value={searchTerm}
                                onChange={e=> setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                {
                    Object.entries(searchContacts).map(([initialLetter,userList])=>{
                        return ( userList.length>0 && 
                            <div key={Date.now()+initialLetter}>
                                <div className={`pl-10 py-5 ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}`}>{initialLetter}</div>
                                {userList.map(contact => {
                                        return (
                                            <ChatLIstItem 
                                                data={contact}
                                                isContactPage={true}
                                                key={contact.id}
                                            />)
                                    })
                                }
                            </div>
                        )
                    })
                }
            </div>
        </div>
    );
}

export default ContactsList;
