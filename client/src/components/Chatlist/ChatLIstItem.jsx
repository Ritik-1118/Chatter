import React, { useEffect } from "react";
import Avatar from "../common/Avatar";
import { useStateProvider } from "@/context/StateContext";
import { reducerCases } from "@/context/constants";
import { calculateTime } from "@/utils/CalculateTime";
import MessageStatus from "../common/MessageStatus";
import { FaCamera, FaMicrophone } from "react-icons/fa";
import { useTheme } from '@/context/ThemeContext';

function ChatLIstItem ( { data, isContactPage = false } ) {
  // console.log("Data from ChatListItem: -----",data)
  const [ { messages, userInfo, currentChatUser, showSmChatList }, dispatch ] = useStateProvider();
  // console.log("data*****************",data)
  const { theme } = useTheme();
  const handleContactClick = () => {
    dispatch( {
      type: reducerCases.SET_SHOW_SM_CHATLIST,
      showSmChatList: false,
    } );
    if ( !isContactPage ) {
      // console.log("data:::::::::::::::", data)
      // console.log("User Info:::::::", userInfo)
      dispatch( {
        type: reducerCases.CHANGE_CURRENT_CHAT_USER,
        user: {
          name: data.name,
          about: data.about,
          profilePicture: data.profilePicture,
          email: data.email,
          _id: userInfo.id == data.sender ? data.receiver : data.sender,
        },
      } );
      data.totalUnreadMessages = 0;
    } else {
      dispatch( { type: reducerCases.CHANGE_CURRENT_CHAT_USER, user: { ...data } } );
      dispatch( { type: reducerCases.SET_ALL_CONTACTS_PAGE } );
    }
  }

  return (
    <div className={ `flex cursor-pointer items-center hover:bg-background-default-hover ${theme === 'dark' ? 'hover:bg-dark-surface' : 'hover:bg-light-surface'}` }
      onClick={ handleContactClick }
    >
      <div className=" min-w-fit px-5 pt-3 pb-1">
        <Avatar type={ "lg" } image={ data?.profilePicture } />
      </div>
      <div className=" min-h-full flex flex-col justify-center mt-3 pr-2 w-full">
        <div className=" flex justify-between">
          <div className="">
            <span className={ `${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}` }>{ data?.name }</span>
          </div>
          { !isContactPage && (
            <div className="">
              <span className={ `${!data.totalUnreadMessages > 0
                ? ( theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text' )
                : 'text-icon-green'} text-sm pr-3` }
              >
                { messages[ messages.length - 1 ]?.createdAt ? (
                  calculateTime( messages[ messages.length - 1 ]?.createdAt )
                ) : (
                  calculateTime( data?.createdAt )
                ) }
              </span>
            </div>
          ) }
        </div>

        <div className={ `flex border-b pb-2 pt-1 ${theme === 'dark' ? 'border-dark-divider' : 'border-light-divider'}` }>
          <div className=" flex justify-between w-full">
            <span className={ `line-clamp-1 text-sm ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>
              { isContactPage ? (
                data?.about || "\u00A0"
              ) : (
                <div className=" flex items-center gap-1 max-w-[195px] sm:max-w-[200px] md:max-w-[300px] lg:max-w-[200px] xl:max-w-[300px]">
                  { data.sender === userInfo.id && <MessageStatus messageStatus={ data.messageStatus } /> }
                  { (data.type === "text" || !data.type) &&
                    <span className=" truncate">
                      { data.message || data.lastMessage || "\u00A0" }
                    </span>
                  }
                  { data.type === "audio" &&
                    <span className=" flex gap-1 items-center">
                      <FaMicrophone className={ ` ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` } />
                      Audio
                    </span>
                  }
                  { data.type === "image" &&
                    <span className=" flex gap-1 items-center">
                      <FaCamera className={ ` ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` } />
                      Image
                    </span>
                  }
                </div>
              ) }
            </span>

            { data.totalUnreadMessages > 0 && (
              <span className=" bg-icon-green px-[5px] rounded-full text-sm">{ data.totalUnreadMessages }</span>
            ) }
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatLIstItem;
