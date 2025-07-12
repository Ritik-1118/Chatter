import React from "react";
import { IoClose } from "react-icons/io5"
import Image from "next/image";

function PhotoLibrary ( { setImage, hidePhotoLibrary } ) {
  const images = [
    "/avatars/1.png",
    "/avatars/2.png",
    "/avatars/3.png",
    "/avatars/4.png",
    "/avatars/5.png",
    "/avatars/6.png",
    "/avatars/7.png",
    "/avatars/8.png",
    "/avatars/9.png",
  ]
  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md h-[300px] mx-4 rounded-2xl shadow-2xl bg-light-secondary-background dark:bg-dark-secondary-background border border-light-divider dark:border-dark-divider p-4 flex flex-col items-center animate-fade-in">
        {/* Close Button */}
        <button
          className="absolute top-4 right-4 text-3xl text-light-accent dark:text-dark-accent hover:bg-light-surface dark:hover:bg-dark-surface rounded-full p-2 transition-colors duration-200 focus:outline-none"
          onClick={ () => hidePhotoLibrary( false ) }
          aria-label="Close"
        >
          <IoClose />
        </button>
        {/* Title */}
        <h2 className="text-2xl font-bold mb-4 text-light-primary-text dark:text-dark-primary-text">Choose an Avatar</h2>
        {/* Avatar Grid */}
        <div className="grid grid-cols-3 gap-4 w-full px-1 py-2 overflow-x-hidden overflow-y-auto max-h-[320px] scrollbar-thin scrollbar-thumb-light-scrollbar dark:scrollbar-thumb-dark-scrollbar">
          { images.map( ( image, index ) =>
            <button
              key={image}
              onClick={ () => {
                setImage( images[ index ] );
                hidePhotoLibrary( false );
              } }
              className="flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent hover:scale-110 transition-transform duration-200 bg-light-surface dark:bg-dark-surface shadow-md p-1"
              tabIndex={0}
              aria-label={`Select avatar ${index + 1}`}
            >
              <div className="h-14 w-14 relative rounded-full overflow-hidden">
                <Image src={ image } alt="avatar" fill className="object-cover" />
              </div>
            </button>
          ) }
        </div>
      </div>
    </div>
  )
}

export default PhotoLibrary;
