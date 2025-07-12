import React, { useEffect } from "react";
import { useRef } from "react";

function ContextMenu ( { options, cordinates, setContextMenu } ) {
  const contextMenuRef = useRef( null );
  // console.log("cordinates:- ",cordinates)
  useEffect( () => {
    const handleOutsideClick = ( event ) => {
      if ( event.target.id !== "context-opener" ) {
        if ( contextMenuRef.current && !contextMenuRef.current.contains( event.target ) ) {
          setContextMenu( false )
        }
      }
    };
    document.addEventListener( "click", handleOutsideClick );
    return () => {
      document.removeEventListener( "click", handleOutsideClick );
    }
  }, [] )
  const handleClick = ( e, callback ) => {
    e.stopPropagation();
    setContextMenu( false );
    callback();
  };
  return (
    <div
      className={ `bg-dropdown-background fixed py-2 z-50 shadow-xl border border-white/60` }
      ref={ contextMenuRef }
      style={ {
        top: cordinates.y,
        left: cordinates.x,
        background: '#222',
      } }
    >
      <ul>
        {
          options.map( ( { name, callback } ) => (
            <li key={ name } onClick={ ( e ) => handleClick( e, callback ) } className="px-5 py-2 cursor-pointer hover:bg-background-default-hover">
              <span className=" text-white">{ name }</span>
            </li>
          ) )
        }
      </ul>
    </div>
  )
}

export default ContextMenu;
