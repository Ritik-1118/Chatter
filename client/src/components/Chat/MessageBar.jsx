import { useStateProvider } from "@/context/StateContext";
import reducer from "@/context/StateReducers";
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

  const PhotoPickerChange = async ( e ) => {
    try {
      const file = e.target.files[ 0 ];
      const formData = new FormData();
      formData.append( "image", file );
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
        socket.current.emit( "send-msg", {
          to: currentChatUser?._id,
          from: userInfo?.id,
          message: response.data.message,
        } );
        dispatch( {
          type: reducerCases.ADD_MESSAGE,
          newMessage: {
            ...response.data.message,
          },
          fromSelf: true,
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
    try {
      // console.log("CurrentUser:- ",currentChatUser);
      // console.log("userInfo:- ",userInfo);
      // console.log("Message =",message);
      const { data } = await axios.post( ADD_MESSAGE_ROUTE, {
        to: currentChatUser?._id,
        from: userInfo?.id,
        message,
      } );
      // console.log("response ######################",{data})
      socket.current.emit( "send-msg", {
        to: currentChatUser?._id,
        from: userInfo?.id,
        message: data.message,
      } );
      dispatch( {
        type: reducerCases.ADD_MESSAGE,
        newMessage: {
          ...data.message,
          messageStatus: "sent",
        },
        fromSelf: true,
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
        <>
          <div className=" flex gap-6">
            <BsEmojiSmile className={ `cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` } title="Emojis" id="emoji-open" onClick={ handleEmojiModel } />
            { showEmojiPicker && <div className=" absolute bottom-24 left-16 z-40" ref={ emojiPickerRef }><EmojiPicker onEmojiClick={ handleEmojiClick } theme={ theme } /></div> }
            <ImAttachment className={ `cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` } title="Attach files" onClick={ () => setGrabPhoto( true ) } />
          </div>
          <div className=" w-full rounded-lg h-10 flex items-center">
            <textarea
              ref={textareaRef}
              placeholder="Type a message"
              className={`text-sm focus:outline-none rounded-lg px-5 py-2 w-full resize-none ${theme === 'dark' ? 'bg-dark-surface text-dark-primary-text' : 'bg-light-surface text-light-primary-text'}`}
              style={{ minHeight: '40px', maxHeight: '120px', lineHeight: '1.5', overflowY: 'hidden', boxSizing: 'border-box' }}
              onChange={ ( e ) => {
                setMessage( e.target.value );
                // Auto-expand textarea
                e.target.style.height = '40px';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              } }
              value={ message }
              onKeyDown={handleInputKeyDown}
              rows={1}
            />
          </div>
          <div className=" flex w-10 items-center justify-center">
            <button>
              { message?.length ? (
                <MdSend className={ `cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` } title="Send message" onClick={ sendMessage } />
              ) : (
                <FaMicrophone className={ `cursor-pointer text-xl ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` } title="Record" onClick={ () => setShowAudioRecorder( true ) } />
              )
              }
            </button>
          </div>
        </>
      ) }
      { grabPhoto && <PhotoPicker onChange={ PhotoPickerChange } /> }
      { showAudioRecorder && <CaptureAudio hide={ setShowAudioRecorder } /> }

    </div>
  )
}

export default MessageBar;
