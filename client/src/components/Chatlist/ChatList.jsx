import React, { useEffect, useState } from "react";
import ChatListHeader from "./ChatListHeader";
import SearchBar from "./SearchBar";
import List from "./List";
import { useStateProvider } from "@/context/StateContext";
import ContactsList from "./ContactsList";

function ChatList () {
  const [ { contactsPage, smWindows, showSmChatList } ] = useStateProvider();
  const [ pageType, setPageType ] = useState( "default" );
  // console.log("smWindows=====",smWindows)

  useEffect( () => {
    if ( contactsPage ) {
      setPageType( "all-contacts" );
    }
    else {
      setPageType( "default" );
    }
  }, [ contactsPage ] );
  return (
    <>
      <div className={ `${smWindows && !showSmChatList && "hidden"} bg-panel-header-background sm:w-3/4 md:w-1/2 lg:w-1/3 flex flex-col max-h-screen z-30` }>
        { pageType === "default" && (
          <>
            <ChatListHeader />
            <SearchBar />
            <List />
          </>
        ) }
        { pageType === "all-contacts" && <ContactsList /> }
      </div>
    </>
  )
}

export default ChatList;
