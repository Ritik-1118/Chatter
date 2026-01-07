import { useStateProvider } from "@/context/StateContext";
import { reducerCases } from "@/context/constants";
import { ADD_IMAGE_MESSAGE_ROUTE, ADD_MESSAGE_ROUTE } from "@/utils/ApiRoutes";
import axios from "axios";
import EmojiPicker from "emoji-picker-react";
import React, { useEffect, useRef, useState } from "react";
import { BsEmojiSmile } from "react-icons/bs";
import { FaMicrophone } from "react-icons/fa";
import { ImAttachment } from "react-icons/im";
import { MdSend } from "react-icons/md";
import PhotoPicker from "../common/PhotoPicker";
import dynamic from "next/dynamic";
const CaptureAudio = dynamic( () => import( "../common/CaptureAudio" ), {
  ssr: false,
} );
import { useTheme } from '@/context/ThemeContext';
import { setAxiosAuthToken } from "@/utils/authHeaders";

function MessageBar () {
  const [ { userInfo, currentChatUser, socket, userContacts }, dispatch ] = useStateProvider();
  const [ message, setMessage ] = useState( "" );
  const [ showEmojiPicker, setShowEmojiPicker ] = useState( false );
  const emojiPickerRef = useRef( null );
  const [ grabPhoto, setGrabPhoto ] = useState( false );
  const [ showAudioRecorder, setShowAudioRecorder ] = useState( false );
  const { theme } = useTheme();
  const [enterToSend, setEnterToSend] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('enterToSend');
    if (saved !== null) setEnterToSend(saved === 'true');
  }, []);

  const handleInputKeyDown = (e) => {
    if (enterToSend && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (message.trim().length > 0) {
        sendMessage();
      }
    }
  };

  const emitSafe = (event, payload) => {
    if (socket?.current?.emitSafe) socket.current.emitSafe(event, payload);
    else if (socket?.current) socket.current.emit(event, payload);
  };

  const PhotoPickerChange = async ( e ) => {
    try {
      const file = e.target.files[ 0 ];
      const formData = new FormData();
      formData.append( "image", file );
      await setAxiosAuthToken();
      const response = await axios.post( ADD_IMAGE_MESSAGE_ROUTE, formData, {
        headers: {
          "Content-Type": "Multipart/form-data",
        },
        params: {
          from: userInfo.id,
          to: currentChatUser._id,
        },
      } );
      if ( response.status === 201 ) {
        const chatId = currentChatUser?._id;
        const messagePayload = { ...response.data.message, messageStatus: "sent" };
        emitSafe( "send-msg", {
          to: chatId,
          from: userInfo?.id,
          message: messagePayload,
        } );
        dispatch( {
          type: reducerCases.UPSERT_MESSAGE,
          chatId,
          message: messagePayload,
        } );
      }
    } catch ( error ) {
      console.log( error );
    }
  };

  useEffect( () => {
    const handleOutsideClick = ( event ) => {
      if ( event.target.id !== "emoji-open" ) {
        if ( emojiPickerRef.current && !emojiPickerRef.current.contains( event.target ) ) {
          setShowEmojiPicker( false );
        }
      }
    };
    document.addEventListener( "click", handleOutsideClick );
    return () => {
      document.removeEventListener( "click", handleOutsideClick );
    };
  }, [] );

  const handleEmojiModel = () => {
    setShowEmojiPicker( !showEmojiPicker );
  };

  const handleEmojiClick = ( emoji ) => {
    setMessage( ( prevMessage ) => ( prevMessage += emoji.emoji ) );
  };

  const sendMessage = async () => {
    const chatId = currentChatUser?._id;
    if (!chatId || !message.trim()) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      tempId,
      sender: userInfo?.id,
      receiver: chatId,
      message,
      type: "text",
      createdAt: new Date().toISOString(),
      messageStatus: "pending",
    };

    dispatch({
      type: reducerCases.UPSERT_MESSAGE,
      chatId,
      message: optimistic,
    });

    try {
      await setAxiosAuthToken();
      const { data } = await axios.post( ADD_MESSAGE_ROUTE, {
        to: chatId,
        from: userInfo?.id,
        message,
      } );

      const confirmed = { ...data.message, messageStatus: "sent" };
      dispatch({
        type: reducerCases.UPSERT_MESSAGE,
        chatId,
        tempId,
        message: confirmed,
      });

      emitSafe( "send-msg", {
        to: chatId,
        from: userInfo?.id,
        message: confirmed,
        tempId,
      } );

      // --- NEW: Add to chat list if not present ---
      const alreadyInContacts = userContacts.some(
        ( c ) => c._id === currentChatUser._id || c.id === currentChatUser._id
      );
      if ( !alreadyInContacts ) {
        dispatch( {
          type: reducerCases.SET_USER_CONTACTS,
          userContacts: [
            {
              ...currentChatUser,
              lastMessage: message,
              // add any other fields you want to show in the chat list
            },
            ...userContacts,
          ],
        } );
      }
      // --- END NEW ---

      setMessage( "" );
      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
    } catch ( error ) {
      console.log( error )
      dispatch({
        type: reducerCases.UPSERT_MESSAGE,
        chatId,
        tempId,
        message: { ...optimistic, messageStatus: "failed" },
      });
    }
  };

  useEffect( () => {
    if ( grabPhoto ) {
      const data = document.getElementById( "photo-picker" );
      data.click();
      document.body.onfocus = ( e ) => {
        setTimeout( () => {
          setGrabPhoto( false )
        }, 1000 );
      }
    }
  }, [ grabPhoto ] );

  return (
    <div className={ `h-20 px-4 flex items-center gap-6 relative ${theme === 'dark' ? 'bg-dark-secondary-background' : 'bg-light-secondary-background'}` }>
      { !showAudioRecorder && (
        <form className="flex items-center gap-6 w-full" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
          <div className=" flex gap-3" aria-label="Message tools">
            <button
              type="button"
              id="emoji-open"
              aria-label="Insert emoji"
              aria-expanded={showEmojiPicker}
              onClick={ handleEmojiModel }
              className={`p-2 rounded-full focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${theme === 'dark' ? 'focus-visible:outline-dark-accent' : 'focus-visible:outline-light-accent'}`}
            >
              <BsEmojiSmile className={ `text-xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` } />
            </button>
            { showEmojiPicker && <div className=" absolute bottom-24 left-12 z-40" ref={ emojiPickerRef }><EmojiPicker onEmojiClick={ handleEmojiClick } theme={ theme } /></div> }
            <button
              type="button"
              aria-label="Attach a photo"
              onClick={ () => setGrabPhoto( true ) }
              className={`p-2 rounded-full focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${theme === 'dark' ? 'focus-visible:outline-dark-accent' : 'focus-visible:outline-light-accent'}`}
            >
              <ImAttachment className={ `text-xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` } />
            </button>
          </div>
          <div className=" w-full rounded-lg h-10 flex items-center">
            <label htmlFor="message-box" className="sr-only">Type a message</label>
            <textarea
              id="message-box"
              ref={textareaRef}
              placeholder="Type a message"
              className={`text-sm focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-lg px-5 py-2 w-full resize-none ${theme === 'dark' ? 'bg-dark-surface text-dark-primary-text focus-visible:outline-dark-accent' : 'bg-light-surface text-light-primary-text focus-visible:outline-light-accent'}`}
              style={{ minHeight: '40px', maxHeight: '120px', lineHeight: '1.5', overflowY: 'hidden', boxSizing: 'border-box' }}
              onChange={ ( e ) => {
                setMessage( e.target.value );
                e.target.style.height = '40px';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              } }
              value={ message }
              onKeyDown={handleInputKeyDown}
              rows={1}
              aria-label="Message input"
            />
          </div>
          <div className=" flex w-10 items-center justify-center">
            { message?.length ? (
              <button
                type="submit"
                aria-label="Send message"
                className="p-2 rounded-full focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <MdSend className={ `text-xl ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` } />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Record audio message"
                onClick={ () => setShowAudioRecorder( true ) }
                className="p-2 rounded-full focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <FaMicrophone className={ `text-xl ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` } />
              </button>
            )}
          </div>
        </form>
      ) }
      { grabPhoto && <PhotoPicker onChange={ PhotoPickerChange } /> }
      { showAudioRecorder && <CaptureAudio hide={ setShowAudioRecorder } /> }

    </div>
  )
}

export default MessageBar;
