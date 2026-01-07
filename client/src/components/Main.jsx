import React, { useEffect, useRef, useState } from "react";
import ChatList from "./Chatlist/ChatList";
import Empty from "./Empty";
import { setAxiosAuthToken } from "@/utils/authHeaders";
import axios from "axios";
import { GET_MESSAGES_ROUTE, HOST } from "@/utils/ApiRoutes";
import { useRouter } from "next/router";
import { useStateProvider } from "@/context/StateContext";
import { reducerCases } from "@/context/constants";
import Chat from "./Chat/Chat";
import { io } from "socket.io-client";
import SearchMessages from "./Chat/SearchMessages";
import VideoCall from "./Call/VideoCall";
import VoiceCall from "./Call/VoiceCall";
import IncomingVideoCall from "./common/IncomingVideoCall";
import IncomingCall from "./common/IncomingCall";
import LeftSidebar from "./LeftSide/LeftSidebar";
import useAuthBootstrap from "@/hooks/useAuthBootstrap";

function Main () {
  const router = useRouter();
  const [
    {
      smWindows,
      showSmChatList,
      userInfo,
      currentChatUser,
      messagesSearch,
      voiceCall,
      videoCall,
      incomingVoiceCall,
      incomingVideoCall
    }, dispatch
  ] = useStateProvider();
  // console.log("userInfo from main page::::::::::-",userInfo)
  useEffect( () => {
    const handleResize = () => {
      if ( window.innerWidth <= 768 ) {
        dispatch( {
          type: reducerCases.SET_SM_WINDOWS_TRUE,
          smWindows: true,
        } );
        dispatch( {
          type: reducerCases.SET_SHOW_SM_CHATLIST,
          showSmChatList: true,
        } );
      } else {
        dispatch( {
          type: reducerCases.SET_SM_WINDOWS_TRUE,
          smWindows: false,
        } );
        dispatch( {
          type: reducerCases.SET_SHOW_SM_CHATLIST,
          showSmChatList: false,
        } );
      }
    };

    handleResize(); // Call it initially to set the state based on the current window size
    window.addEventListener( 'resize', handleResize );

    return () => {
      window.removeEventListener( 'resize', handleResize );
    };
  }, [ dispatch ] );
  // console.log("smWindows from main page::::::::::-",smWindows)
  // console.log("currentChatUser from main page::::::::::-",currentChatUser)
  const [ socketEvent, setSocketEvent ] = useState( false );
  const socket = useRef();
  const currentChatUserRef = useRef(currentChatUser);

  useAuthBootstrap(dispatch, userInfo, router);

  useEffect(() => {
    currentChatUserRef.current = currentChatUser;
  }, [currentChatUser]);

  // Setting socket when user add
  useEffect( () => {
    if ( userInfo ) {
      socket.current = io( HOST );
      socket.current.emit( "add-user", userInfo.id );
      dispatch( { type: reducerCases.SET_SOCKET, socket } );
    }
  }, [ userInfo ] );

  useEffect( () => {
    if ( socket.current && !socketEvent ) {
      socket.current.on( "msg-recieve", ( data ) => {
        const chatUser = currentChatUserRef.current;
        // Only add to messages if the message is for the currently open chat
        // console.log("Crrent Chat User:", chatUser, "Data: ", data)
        if (
          (chatUser &&
            (data.message.sender === chatUser._id || data.message.sender === chatUser.id)) ||
          (chatUser &&
            (data.message.receiver === chatUser._id || data.message.receiver === chatUser.id))
        ) {
          dispatch( {
            type: reducerCases.ADD_MESSAGE,
            newMessage: {
              ...data.message,
            }
          } );
        } else {
          // Update chat list preview for the sender (or receiver)
          dispatch({
            type: reducerCases.UPDATE_CONTACT_PREVIEW,
            message: data.message,
          });
          // Show a notification (for now, just log)
          // console.log("New message from:", data.message.sender, data.message.message);
        }
      });

      // Listen for delivery receipts
      socket.current.on("delivered", ({ messageId }) => {
        dispatch({
          type: reducerCases.BULK_UPDATE_MESSAGE_STATUS,
          ids: [messageId],
          status: "delivered",
        });
      });

      // Listen for read receipts
      socket.current.on("read", ({ messageIds }) => {
        dispatch({
          type: reducerCases.BULK_UPDATE_MESSAGE_STATUS,
          ids: messageIds,
          status: "read",
        });
      });

      // videoCall and voiceCall section
      socket.current.on( "incoming-voice-call", ( { from, roomId, callType } ) => {
        dispatch( {
          type: reducerCases.SET_INCOMING_VOICE_CALL,
          incomingVoiceCall: { ...from, roomId, callType },
        } );
      } );
      socket.current.on( "incoming-video-call", ( { from, roomId, callType } ) => {
        dispatch( {
          type: reducerCases.SET_INCOMING_VIDEO_CALL,
          incomingVideoCall: { ...from, roomId, callType },
        } );
      } );
      socket.current.on( "voice-call-rejected", () => {
        dispatch( {
          type: reducerCases.END_CALL,
        } );
      } );
      socket.current.on( "video-call-rejected", () => {
        dispatch( {
          type: reducerCases.END_CALL,
        } );
      } );

      socket.current.on( "online-users", ( { onlineUsers } ) => {
        dispatch( {
          type: reducerCases.SET_ONLINE_USERS,
          onlineUsers,
        } )
      } )
      setSocketEvent( true );
    }
  }, [ socket.current ] );

  useEffect( () => {
    // console.log("currentChatUser::::::::::", currentChatUser);
    const getMessages = async () => {
      await setAxiosAuthToken();
      const { data: { messages }, } = await axios.get( `${GET_MESSAGES_ROUTE}/${userInfo.id}/${currentChatUser._id}` );
      dispatch( { type: reducerCases.SET_MESSAGES, messages } );
    }
    if ( currentChatUser?._id ) {
      getMessages();
    }
  }, [ currentChatUser ] )

  useEffect(() => {
    if (socket.current) {
      socket.current.on("reconnect", () => {
        if (userInfo) {
          socket.current.emit("add-user", userInfo.id);
        }
      });
    }
  }, [userInfo, socket.current]);

  return (
    <>

      { incomingVideoCall && <IncomingVideoCall /> }
      { incomingVoiceCall && <IncomingCall /> }

      { videoCall && (
        <div className=" h-screen w-screen max-h-full overflow-hidden">
          <VideoCall />
        </div>
      ) }
      { voiceCall && (
        <div className=" h-screen w-screen max-h-full overflow-hidden">
          <VoiceCall />
        </div>
      ) }

      { !videoCall && !voiceCall && (
        <div className="flex h-screen w-screen max-h-screen max-w-full overflow-hidden">

          <LeftSidebar />
          <ChatList />
          { currentChatUser && !showSmChatList ? (
            <>
              <div className={ `${messagesSearch ? " grid grid-cols-2" : " grid-cols-2"} w-full` }>
                <Chat />
                { messagesSearch && <SearchMessages /> }
              </div>
            </>
          ) : (
            <Empty />
          ) }
        </div>
      ) }
    </>
  )
}

export default Main;
