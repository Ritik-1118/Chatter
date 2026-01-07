import React, { memo, useEffect, useMemo, useState } from "react";
import ChatListHeader from "./ChatListHeader";
import SearchBar from "./SearchBar";
import List from "./List";
import { useStateProvider } from "@/context/StateContext";
import ContactsList from "./ContactsList";

function ChatList ( { loading = false } ) {
  const [ { contactsPage, smWindows, showSmChatList } ] = useStateProvider();
  const [ pageType, setPageType ] = useState( "default" );

  useEffect( () => {
    if ( contactsPage ) {
      setPageType( "all-contacts" );
    }
    else {
      setPageType( "default" );
    }
  }, [ contactsPage ] );

  const skeletonItems = useMemo( () => Array.from( { length: 7 } ), [] );

  return (
    <div className={ `${smWindows && !showSmChatList && "hidden"} bg-panel-header-background sm:w-3/4 md:w-1/2 lg:w-1/3 flex flex-col max-h-screen z-30` }>
      { pageType === "default" && (
        <>
          <ChatListHeader />
          <SearchBar />
          { loading ? (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              { skeletonItems.map( ( _, idx ) => (
                <div key={ idx } className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded skeleton" />
                    <div className="h-3 w-1/3 rounded skeleton" />
                  </div>
                </div>
              ) ) }
            </div>
          ) : (
            <List />
          ) }
        </>
      ) }
      { pageType === "all-contacts" && <ContactsList /> }
    </div>
  )
}

export default memo(ChatList);
