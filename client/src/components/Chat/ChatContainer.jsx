import { useStateProvider } from "@/context/StateContext";
import { calculateTime } from "@/utils/CalculateTime";
import React, { useEffect, useRef } from "react";
import MessageStatus from "../common/MessageStatus";
import ImageMessage from "./ImageMessage";
import dynamic from "next/dynamic";
const VoiceMessage = dynamic( () => import( "./VoiceMessage" ), { ssr: false, } );
import { useTheme } from '@/context/ThemeContext';

function ChatContainer () {
  const [ { messages, currentChatUser, userInfo, socket } ] = useStateProvider();
  const { theme } = useTheme();
  const messagesEndRef = useRef( null );

  // Scroll to bottom when messages or chat changes
  useEffect( () => {
    if ( messagesEndRef.current ) {
      messagesEndRef.current.scrollIntoView( { behavior: "smooth" } );
    }
  }, [ messages, currentChatUser ] );

  useEffect( () => {
    // Emit read receipt for all unread messages sent to this user
    if ( socket && socket.current && currentChatUser && userInfo ) {
      const unreadMessageIds = messages
        .filter( msg => msg.messageStatus !== "read" && msg.receiver === userInfo.id )
        .map( msg => msg._id );
      if ( unreadMessageIds.length > 0 ) {
        socket.current.emit( "read-message", {
          messageIds: unreadMessageIds,
          from: userInfo.id,
          to: currentChatUser._id,
        } );
      }
    }
  }, [ messages, currentChatUser, userInfo, socket ] );

  return (
    <div className={ `h-[80vh] w-full relative flex-grow overflow-auto custom-scrollbar ${theme === 'dark' ? 'bg-dark-background' : 'bg-light-background'}` }>
      <div className=" bg-chat-background bg-fixed h-full w-full opacity-5 fixed left-0 top-0 z-0"></div>
      <div className=" mx-10 my-6 relative bottom-0 z-40 left-0">
        <div className=" flex w-full">
          <div className="flex flex-col justify-end w-full gap-1 overflow-auto">
            { messages.map( ( message, index ) => (
              <div key={ message._id }
                className={ `flex ${message.sender === currentChatUser._id ? "justify-start" : "justify-end"}` }>
                { message.type === "text" && (
                  <div className={ `px-2 py-[5px] text-sm rounded-md flex gap-2 items-end max-w-[90%]
                                    ${message.sender === currentChatUser._id
                      ? ( theme === 'dark' ? 'bg-dark-bubble-receiver text-dark-primary-text' : 'bg-light-bubble-receiver text-light-primary-text' )
                      : ( theme === 'dark' ? 'bg-dark-bubble-sender text-dark-primary-text' : 'bg-light-bubble-sender text-light-primary-text' )}
                                `}
                  >
                    <span className=" break-all">{
                      message.message.split( '\n' ).map( ( line, i, arr ) => (
                        <React.Fragment key={ i }>
                          { line }
                          { i < arr.length - 1 && <br /> }
                        </React.Fragment>
                      ) )
                    }</span>
                    <div className="flex gap-1 items-end">
                      <span className=" text-bubble-meta text-[11px] pt-1 min-w-fit">
                        { calculateTime( message.createdAt ) }
                      </span>
                      <span>
                        { message.sender === userInfo.id && ( <MessageStatus messageStatus={ message.messageStatus } /> ) }
                      </span>
                    </div>
                  </div>
                ) }
                { message.type === "image" && <ImageMessage message={ message } /> }
                { message.type === "audio" && <VoiceMessage message={ message } /> }
              </div> ) ) }
            <div ref={ messagesEndRef } />
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatContainer;
