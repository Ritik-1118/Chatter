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
      messagesByChat,
      currentChatUser,
      messagesSearch,
      onlineUsers,
      socketStatus,
      voiceCall,
      videoCall,
      incomingVoiceCall,
      incomingVideoCall
    }, dispatch
  ] = useStateProvider();

  const socket = useRef();
  const currentChatUserRef = useRef(currentChatUser);
  const onlineUsersRef = useRef(onlineUsers);
  const [ messagesLoading, setMessagesLoading ] = useState( false );
  const pendingEmits = useRef([]);

  useAuthBootstrap(dispatch, userInfo, router);

  useEffect( () => {
    const handleResize = () => {
      if ( window.innerWidth <= 768 ) {
        dispatch( { type: reducerCases.SET_SM_WINDOWS_TRUE, smWindows: true } );
        dispatch( { type: reducerCases.SET_SHOW_SM_CHATLIST, showSmChatList: true } );
      } else {
        dispatch( { type: reducerCases.SET_SM_WINDOWS_TRUE, smWindows: false } );
        dispatch( { type: reducerCases.SET_SHOW_SM_CHATLIST, showSmChatList: false } );
      }
    };

    handleResize();
    window.addEventListener( 'resize', handleResize );
    return () => window.removeEventListener( 'resize', handleResize );
  }, [ dispatch ] );

  useEffect(() => {
    currentChatUserRef.current = currentChatUser;
  }, [currentChatUser]);

  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  useEffect( () => {
    if ( !userInfo ) return;

    let isMounted = true;
    const setupSocket = async () => {
      const token = await setAxiosAuthToken();
      if ( !isMounted ) return;

      console.log("[socket] init with token", Boolean(token));
      socket.current = io( HOST, {
        auth: { token },
        reconnection: true,
      } );
      pendingEmits.current = [];

      const markStatus = ( status ) => dispatch( { type: reducerCases.SET_SOCKET_STATUS, status } );
      const flushQueue = () => {
        if ( socket.current && socket.current.connected && pendingEmits.current?.length ) {
          pendingEmits.current.forEach( ( item ) => {
            socket.current.emit( item.event, item.payload );
          } );
          pendingEmits.current = [];
        }
      };

      const emitSafe = ( event, payload ) => {
        if ( socket.current && socket.current.connected ) {
          socket.current.emit( event, payload );
        } else {
          pendingEmits.current = [ ...( pendingEmits.current || [] ), { event, payload } ];
        }
      };

      socket.current.emitSafe = emitSafe;

      const handleConnect = () => {
        console.log("[socket] connected", socket.current.id);
        markStatus( "connected" );
        socket.current.emit( "add-user", userInfo.id );
        flushQueue();
      };
      const handleConnectError = (err) => {
        console.log("[socket] connect_error", err?.message);
        markStatus( "disconnected" );
      };
      const handleReconnectAttempt = (attempt) => {
        console.log("[socket] reconnect_attempt", attempt);
        markStatus( "reconnecting" );
      };
      const handleReconnect = () => {
        console.log("[socket] reconnected", socket.current.id);
        markStatus( "connected" );
        socket.current.emit( "add-user", userInfo.id );
        flushQueue();
      };
      const handleDisconnect = (reason) => {
        console.log("[socket] disconnected", reason);
        markStatus( "disconnected" );
      };

      const handleMessageReceive = ( data ) => {
        console.log("[socket] msg-recieve", data);
        const chatUser = currentChatUserRef.current;
        if (
          (chatUser && (data.message.sender === chatUser._id || data.message.sender === chatUser.id)) ||
          (chatUser && (data.message.receiver === chatUser._id || data.message.receiver === chatUser.id))
        ) {
          const chatId = chatUser._id || chatUser.id;
          dispatch( { type: reducerCases.UPSERT_MESSAGE, chatId, message: { ...data.message } } );
        } else {
          dispatch({ type: reducerCases.UPDATE_CONTACT_PREVIEW, message: data.message });
        }
      };

      const handleDelivered = ( { messageId } ) => {
        console.log("[socket] delivered", messageId);
        dispatch({ type: reducerCases.BULK_UPDATE_MESSAGE_STATUS, ids: [messageId], status: "delivered" });
      };

      const handleAck = ({ tempId, message }) => {
        console.log("[socket] msg-ack", { tempId, message });
        if (!message) return;
        const chatId = message.receiver || message.to || currentChatUserRef.current?._id;
        if (!chatId) return;
        dispatch({ type: reducerCases.UPSERT_MESSAGE, chatId, tempId, message });
      };

      const handleRead = ( { messageIds } ) => {
        dispatch({ type: reducerCases.BULK_UPDATE_MESSAGE_STATUS, ids: messageIds, status: "read" });
      };

      const handleIncomingVoice = ( { from, roomId, callType } ) => {
        dispatch( { type: reducerCases.SET_INCOMING_VOICE_CALL, incomingVoiceCall: { ...from, roomId, callType } } );
      };
      const handleIncomingVideo = ( { from, roomId, callType } ) => {
        dispatch( { type: reducerCases.SET_INCOMING_VIDEO_CALL, incomingVideoCall: { ...from, roomId, callType } } );
      };
      const handleVoiceRejected = () => { dispatch( { type: reducerCases.END_CALL } ); };
      const handleVideoRejected = () => { dispatch( { type: reducerCases.END_CALL } ); };

      const handleOnlineUsers = ( { onlineUsers: nextOnline = [] } ) => {
        const toStrSet = (arr=[]) => new Set(arr.map((u)=>u?.toString()));
        const prev = toStrSet(onlineUsersRef.current || []);
        const next = toStrSet(nextOnline);
        if ( prev.size === next.size && [ ...prev ].every( ( u ) => next.has( u ) ) ) return;
        dispatch( { type: reducerCases.SET_ONLINE_USERS, onlineUsers: [ ...next ] } )
      };

      socket.current.on( "connect", handleConnect );
      socket.current.on( "connect_error", handleConnectError );
      socket.current.on( "reconnect_attempt", handleReconnectAttempt );
      socket.current.on( "reconnect", handleReconnect );
      socket.current.on( "disconnect", handleDisconnect );
      socket.current.on( "msg-recieve", handleMessageReceive );
      socket.current.on( "delivered", handleDelivered );
      socket.current.on( "msg-ack", handleAck );
      socket.current.on( "read", handleRead );
      socket.current.on( "incoming-voice-call", handleIncomingVoice );
      socket.current.on( "incoming-video-call", handleIncomingVideo );
      socket.current.on( "voice-call-rejected", handleVoiceRejected );
      socket.current.on( "video-call-rejected", handleVideoRejected );
      socket.current.on( "online-users", handleOnlineUsers );

      dispatch( { type: reducerCases.SET_SOCKET, socket } );

      return () => {
        if ( socket.current ) {
          socket.current.off( "connect", handleConnect );
          socket.current.off( "connect_error", handleConnectError );
          socket.current.off( "reconnect_attempt", handleReconnectAttempt );
          socket.current.off( "reconnect", handleReconnect );
          socket.current.off( "disconnect", handleDisconnect );
          socket.current.off( "msg-recieve", handleMessageReceive );
          socket.current.off( "delivered", handleDelivered );
          socket.current.off( "msg-ack", handleAck );
          socket.current.off( "read", handleRead );
          socket.current.off( "incoming-voice-call", handleIncomingVoice );
          socket.current.off( "incoming-video-call", handleIncomingVideo );
          socket.current.off( "voice-call-rejected", handleVoiceRejected );
          socket.current.off( "video-call-rejected", handleVideoRejected );
          socket.current.off( "online-users", handleOnlineUsers );
          socket.current.disconnect();
        }
      };
    };

    const cleanup = setupSocket();
    return () => {
      isMounted = false;
      if (socket.current) {
        socket.current.removeAllListeners();
        socket.current.disconnect();
      }
      if (typeof cleanup === "function") cleanup();
    };
  }, [ userInfo ] );

  useEffect( () => {
    const getMessages = async (hasCache) => {
      // Only show skeleton if no cache
      setMessagesLoading( !hasCache );
      try {
        await setAxiosAuthToken();
        const { data: { messages }, } = await axios.get( `${GET_MESSAGES_ROUTE}/${userInfo.id}/${currentChatUser._id}` );
        dispatch( { type: reducerCases.SET_MESSAGES, chatId: currentChatUser._id, messages } );
      } catch (error) {
        console.log(error);
      } finally {
        setMessagesLoading( false );
      }
    }
    if ( currentChatUser?._id ) {
      const cached = messagesByChat?.[currentChatUser._id];
      if (cached) {
        dispatch({ type: reducerCases.SET_MESSAGES, chatId: currentChatUser._id, messages: cached });
      }
      getMessages(!!cached);
    } else {
      setMessagesLoading( false );
    }
  }, [ currentChatUser ] )

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
        <main className="flex h-screen w-screen max-h-screen max-w-full overflow-hidden" role="main" aria-label="Chat interface">
          <LeftSidebar />
          <ChatList loading={ !userInfo } />
          { currentChatUser && !showSmChatList ? (
            <div className={ `${messagesSearch ? " grid grid-cols-2" : " grid-cols-2"} w-full` }>
              <Chat isMessagesLoading={messagesLoading} />
              { messagesSearch && <SearchMessages /> }
            </div>
          ) : (
            <Empty />
          ) }
        </main>
      ) }
    </>
  )
}

export default Main;
