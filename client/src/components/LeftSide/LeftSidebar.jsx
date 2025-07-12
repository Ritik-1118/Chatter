import React, { useState } from 'react'
import { useStateProvider } from '@/context/StateContext';
import { reducerCases } from '@/context/constants';
import { BsArchive, BsFillChatLeftTextFill } from "react-icons/bs"
import { IoCallOutline } from "react-icons/io5";
import { PiCircleDashed } from "react-icons/pi";
import { IoMdMenu } from "react-icons/io";
import { CgProfile } from "react-icons/cg";
import { MdOutlineSettings } from "react-icons/md";
import { useTheme } from '@/context/ThemeContext';
import ProfileModal from '../common/ProfileModal';
import SettingModal from '../common/SettingModal';

export default function LeftSidebar () {
  const [ sideBarMenu, setSideBarMenu ] = useState( true );
  const [ { smWindows, showSmChatList, userInfo }, dispatch ] = useStateProvider();
  const { theme } = useTheme();
  const [ showProfileModal, setShowProfileModal ] = useState( false );
  const [ showSettingModal, setShowSettingModal ] = useState( false );
  const handleChatClick = () => {
    dispatch( {
      type: reducerCases.SET_SHOW_SM_CHATLIST,
      showSmChatList: true,
    } );
  }
  const handleMenuClick = () => {
    setSideBarMenu( !sideBarMenu );
  }
  const handleProfileClick = () => {
    setShowProfileModal( true );
  }
  const handleSettingClick = () => {
    setShowSettingModal( true );
  }

  return (
    <div className={ `h-full px-4 py-3 flex flex-col justify-between z-50 border-r-2 ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider text-dark-primary-text' : 'bg-light-secondary-background border-light-divider text-light-primary-text'}` }>
      <div className="">
        <div className={ `py-4 text-3xl flex items-center justify-items-start cursor-pointer ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>
          <IoMdMenu onClick={ () => handleMenuClick() } />
          <span className={ `${sideBarMenu && "hidden"} text-xl pl-2` }>Menu</span>
        </div>
        <div className={ `py-4 text-xl flex items-center justify-items-start cursor-pointer ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>
          <BsFillChatLeftTextFill onClick={ () => handleChatClick() } />
          <span className={ `${sideBarMenu && "hidden"} pl-2` }>Chats</span>
        </div>
        {/* <div className={ `py-4 flex items-center justify-items-start text-xl cursor-pointer ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>
          <IoCallOutline />
          <span className={ `${sideBarMenu && "hidden"} pl-2` }>Calls</span>
        </div> */}
        {/* <div className="py-4 text-xl cursor-pointer text-panel-header-icon">
                    <PiCircleDashed />
                </div> */}
      </div>
      <div>
        {/* <div className={ `py-4 flex items-center justify-items-start text-xl cursor-pointer ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>
          <BsArchive />
          <span className={ `${sideBarMenu && "hidden"} pl-2` }>Archive</span>
        </div> */}
        <div className="flex items-center">
          <hr />
        </div>
        <div
          className={ `py-4 flex items-center justify-items-start text-xl cursor-pointer ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }
          onClick={ handleSettingClick }
        >
          <MdOutlineSettings />
          <span className={ `${sideBarMenu && "hidden"} pl-2` }>Setting</span>
        </div>
        <div className={ `py-4 flex items-center justify-items-start text-xl cursor-pointer ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }
          onClick={ handleProfileClick }
        >
          <CgProfile />
          <span className={ `${sideBarMenu && "hidden"} pl-2` }>Profile</span>
        </div>
      </div>
      { showProfileModal && (
        <ProfileModal user={ userInfo } onClose={ () => setShowProfileModal( !showProfileModal ) } />
      ) }
      { showSettingModal && (
        <SettingModal onClose={ () => setShowSettingModal( false ) } />
      ) }
    </div>
  )
}
