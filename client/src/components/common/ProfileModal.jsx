import React from "react";
import { IoClose } from "react-icons/io5";
import Avatar from "./Avatar";
import { useTheme } from '@/context/ThemeContext';
import { useStateProvider } from "@/context/StateContext";

const ProfileModal = ( { user, onClose } ) => {
  const [ { smWindows } ] = useStateProvider();

  const { theme } = useTheme();
  if ( !user ) return null;
  // console.log("user info: ", user)
  return (
    <div className={`fixed left-[4.5rem] bottom-[1.5rem] z-40 flex items-end justify-start pointer-events-none ${smWindows && "max-w-50"}`}>
      <div className={ `relative flex flex-col items-center px-8 py-10 rounded-xl shadow-2xl max-w-sm w-full animate-fade-in ring-2 backdrop-blur-2xl ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider text-dark-primary-text' : 'bg-light-secondary-background border-light-divider text-light-primary-text'} border pointer-events-auto` }>
        <button
          className="absolute top-4 right-4 text-2xl focus:outline-none"
          onClick={ onClose }
          aria-label="Close profile modal"
        >
          <IoClose />
        </button>
        <Avatar type="xl" image={ user.profileImage || "/default_avatar.png" } />
        <div className="mt-6 flex flex-col items-center gap-2 w-full">
          <span className={ `text-2xl font-bold ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` }>{ user.name }</span>
          <span className={ `text-base break-all ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>{ user.email }</span>
          { user.status && (
            <span className={ `mt-2 text-center text-sm px-4 py-2 rounded-lg ${theme === 'dark' ? 'bg-dark-surface text-dark-primary-text' : 'bg-light-surface text-light-primary-text'}` }>{ user.status }</span>
          ) }
        </div>
      </div>
      <style jsx global>{ `
                @keyframes fade-in {
                    from { opacity: 0; transform: translateY(40px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fade-in 1.2s cubic-bezier(0.4,0,0.2,1) both;
                }
            `}</style>
    </div>
  );
};

export default ProfileModal; 