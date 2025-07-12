import React, { useEffect, useState } from "react";
import Image from "next/image";
import { FaCamera } from "react-icons/fa";
import ContextMenu from "./ContextMenu";
import PhotoPicker from "./PhotoPicker";
import PhotoLibrary from "./PhotoLibrary";
import CapturePhoto from "./CapturePhoto";

function Avatar ( { type, image, setImage } ) {
  const [ hover, setHover ] = useState( false );
  const [ isContextMenuVisible, setIsContextMenuVisible ] = useState( false );
  const [ contextMenuCordinates, setContextMenuCordinates ] = useState( {
    x: 0,
    y: 0,
  } );
  const [ grabPhoto, setGrabPhoto ] = useState( false );
  const [ showPhotoLIbrary, setShowPhotoLibrary ] = useState( false );
  const [ showCapturePhoto, setShowCapturePhoto ] = useState( false );

  const showContextMenu = ( e ) => {
    e.preventDefault();
    setContextMenuCordinates( { x: e.pageX / 2 - 30, y: e.pageY / 2 - 30 } );
    setIsContextMenuVisible( true );
    console.log( "showContextMenu Clicked!" );
    console.log( "contextMenuCordinates:", contextMenuCordinates );
    console.log( "isContextMenuVisible:", isContextMenuVisible )
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

  const ContextMenuOptions = [
    {
      name: "Take photo", callback: () => {
        setShowCapturePhoto( true );
      }
    },
    {
      name: "Choose From library", callback: () => {
        setShowPhotoLibrary( true );
      }
    },
    {
      name: "Upload photo", callback: () => {
        setGrabPhoto( true );
      }
    },
    {
      name: "Remove photo", callback: () => {
        setImage( "/default_avatar.png" )
      }
    },
  ];

  const PhotoPickerChange = async ( e ) => {
    const file = e.target.files[ 0 ];
    const reader = new FileReader();
    const data = document.getElementById( "img" );
    reader.onload = function( event ) {
      data.src = event.target.result;
      data.setAttribute( "data-src", event.target.result )
    };
    reader.readAsDataURL( file );
    setTimeout( () => {
      console.log( data.src );
      setImage( data.src );
    }, 100 );
  }

  return (
    <>
      <div className="flex items-center justify-center">
        { type === "sm" && (
          <div className="relative h-10 w-10">
            <Image src={ image } alt="Avatar" className="rounded-full" fill />
          </div>
        ) }
        { type === "lg" && (
          <div className="relative h-14 w-14">
            <Image src={ image } alt="Avatar" className="rounded-full" fill />
          </div>
        ) }
        { type === "xl" && (
          <div className="relative cursor-pointer z-0"
            onMouseEnter={ () => setHover( true ) }
            onMouseLeave={ () => setHover( false ) }
          >
            <div className={ `z-10 bg-photopicker-overlay-background h-60 w-60 absolute top-0 left-0 flex items-center rounded-full justify-center flex-col text-center gap-2
                ${hover || isContextMenuVisible ? "visible" : "hidden"}
                `}
              onClick={ e => showContextMenu( e ) }
              id="context-opener"
            >
              <FaCamera className="text-2xl" id="context-opener" />
              <span id="context-opener">Change <br />profile photo</span>
            </div>
            <div className="flex items-center justify-center h-60 w-60">
              <Image src={ image } alt="Avatar" className="rounded-full" id="img" fill />
            </div>
          </div>
        ) }
      </div>
      {
        isContextMenuVisible && (
          <ContextMenu
            options={ ContextMenuOptions }
            cordinates={ contextMenuCordinates }
            setContextMenu={ setIsContextMenuVisible }
          />
        ) }
      {
        showCapturePhoto && <CapturePhoto
          setImage={ setImage }
          hide={ setShowCapturePhoto }
        />
      }
      { showPhotoLIbrary && <PhotoLibrary setImage={ setImage } hidePhotoLibrary={ setShowPhotoLibrary } /> }
      { grabPhoto && <PhotoPicker onChange={ PhotoPickerChange } /> }
    </>
  )
}

export default Avatar;
