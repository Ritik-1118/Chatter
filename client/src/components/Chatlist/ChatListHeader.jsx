import React, { useState } from "react";
import Avatar from "../common/Avatar";
import { useStateProvider } from "@/context/StateContext";
import { BsThreeDotsVertical } from "react-icons/bs"
import { TbMessagePlus } from "react-icons/tb";
import { reducerCases } from "@/context/constants";
import ContextMenu from "../common/ContextMenu";
import { useRouter } from "next/router";
import { useTheme } from '@/context/ThemeContext';
import { FiSun, FiMoon } from "react-icons/fi";

function ChatListHeader () {
  const [ { userInfo, smWindows }, dispatch ] = useStateProvider();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [ contextMenuCordinates, setContextMenuCordinates ] = useState( {
    x: 0,
    y: 0,
  } );
  const [ isContextMenuVisible, setIsContextMenuVisible ] = useState( false );
  const showContextMenu = ( e ) => {
    e.preventDefault();
    if(smWindows){
      setContextMenuCordinates( { x: e.pageX-100, y: e.pageY } );
    }else{
      setContextMenuCordinates( { x: e.pageX, y: e.pageY } );
    }
    setIsContextMenuVisible( true );
  };
  const ContextMenuOptions = [
    {
      name: "Logout",
      callback: async () => {
        setIsContextMenuVisible( false );
        router.push( "/logout" );
      }
    },
  ];

  const handleAllContactsPage = () => {
    dispatch( { type: reducerCases.SET_ALL_CONTACTS_PAGE } );
  }

  return (
    <div className={ `h-16 px-4 py-3 flex justify-between items-center border-b ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider text-dark-primary-text' : 'bg-light-secondary-background border-light-divider text-light-primary-text'}` }>
      <div className=" cursor-pointer">
        <Avatar type={ "sm" } image={ userInfo?.profileImage } />
      </div>
      <div className=" flex gap-6 items-center">
        {/* Theme Toggle Icon */ }
        <button
          onClick={ toggleTheme }
          aria-label="Toggle theme"
          className={ `focus:outline-none text-xl ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` }
          title={ theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode' }
        >
          { theme === 'dark' ? <FiSun /> : <FiMoon /> }
        </button>
        <TbMessagePlus className={ `cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` } title="New Chat"
          onClick={ handleAllContactsPage }
        />
        <>
          <BsThreeDotsVertical
            className={ `cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` } title="Menu"
            onClick={ ( e ) => showContextMenu( e ) }
            id="context-opener"
          />
          { isContextMenuVisible && (
            <ContextMenu
              options={ ContextMenuOptions }
              cordinates={ contextMenuCordinates }
              setContextMenu={ setIsContextMenuVisible }
            />
          ) }
        </>
      </div>
    </div>
  )
}

export default ChatListHeader;
