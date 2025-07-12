import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useStateProvider } from "@/context/StateContext";
import Input from "@/components/common/Input";
import Avatar from "@/components/common/Avatar";
import axios from "axios";
import { reducerCases } from "@/context/constants";
import { ONBOARD_USER_ROUTE } from "@/utils/ApiRoutes";
import { useRouter } from "next/router";

function onboarding () {

  const router = useRouter();
  const [ { userInfo, newUser }, dispatch ] = useStateProvider();
  const [ name, setName ] = useState( userInfo?.name || "" );
  const [ about, setAbout ] = useState( "" );
  const [ image, setImage ] = useState( "/default_avatar.png" );
  const [ theme, setTheme ] = useState( 'dark' );

  useEffect( () => {
    // Check localStorage or system preference
    const savedTheme = typeof window !== 'undefined' && localStorage.getItem( 'theme' );
    if ( savedTheme ) {
      setTheme( savedTheme );
      document.documentElement.classList.toggle( 'dark', savedTheme === 'dark' );
    } else {
      const prefersDark = window.matchMedia && window.matchMedia( '(prefers-color-scheme: dark)' ).matches;
      setTheme( prefersDark ? 'dark' : 'light' );
      document.documentElement.classList.toggle( 'dark', prefersDark );
    }
  }, [] );

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme( newTheme );
    if ( typeof window !== 'undefined' ) {
      localStorage.setItem( 'theme', newTheme );
      document.documentElement.classList.toggle( 'dark', newTheme === 'dark' );
    }
  };

  useEffect( () => {
    if ( !newUser && !userInfo?.email ) router.push( "/login" );
    else if ( !newUser && userInfo?.email ) router.push( "/" );
  }, [ newUser, userInfo, router ] )

  const onboardUserHandler = async () => {
    if ( validateDetails() ) {
      const email = userInfo.email;
      try {
        const { data } = await axios.post( ONBOARD_USER_ROUTE, { email, name, about, image, } );
        // console.log("ONBOARD Data is:::::::::::::::::::::: ",{data});
        if ( data.status ) {
          dispatch( { type: reducerCases.SET_NEW_USER, newUser: false } );
          dispatch( {
            type: reducerCases.SET_USER_INFO,
            userInfo: {
              id: data.user._id,
              name,
              email,
              profileImage: image,
              status: about,
            },
          } );
          router.push( "/" );
        }
      } catch ( error ) {
        console.log( error );
      }
    }
  };
  const validateDetails = () => {
    if ( name.length < 3 ) {
      return false;
    }
    return true
  };
  return (
    <div className={ `relative min-h-screen w-full flex items-center justify-center overflow-hidden ${theme === 'dark' ? 'bg-dark-background' : 'bg-light-background'}` }>
      <button
        className={ `absolute top-6 right-6 z-20 px-4 py-2 rounded-full shadow-md font-semibold transition-colors duration-200 focus:outline-none ${theme === 'dark' ? 'bg-dark-surface text-dark-accent border-dark-accent' : 'bg-light-surface text-light-accent border-light-accent'} border` }
        onClick={ toggleTheme }
        aria-label="Toggle dark/light mode"
      >
        { theme === 'dark' ? '🌙 Dark' : '☀️ Light' }
      </button>
      {/* Animated Gradient Background */ }
      <div className={ `absolute inset-0 z-0 animate-gradient ${theme === 'dark' ? 'bg-dark-accent' : 'bg-light-accent'} opacity-20` } style={ { filter: 'blur(3px)' } } />
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-2xl mx-4 animate-fade-in">
        {/* Logo and Title */ }
        <div className="flex flex-col items-center mb-6">
          <Image src={ "/gifs/G1.gif" } alt="Chatter Logo" width={ 90 } height={ 90 } className={ `rounded-full shadow-lg mb-2 border-4 ${theme === 'dark' ? 'border-dark-accent' : 'border-light-accent'}` } />
          <span className={ `text-4xl font-extrabold tracking-wide font-mono mb-2 ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}` }>Chatter</span>
          <h2 className={ `text-2xl font-semibold mb-1 ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}` }>Create your profile</h2>
          <p className={ `text-base ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>Let others know who you are!</p>
        </div>
        {/* Card */ }
        <div className={ `flex flex-col md:flex-row w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-fade-in ${theme === 'dark' ? 'bg-dark-secondary-background border-dark-divider' : 'bg-light-secondary-background border-light-divider'} border` }>
          {/* Avatar Section */ }
          <div className={ `flex flex-col items-center justify-center gap-4 py-10 px-8 md:w-1/2 ${theme === 'dark' ? 'bg-dark-surface border-dark-divider' : 'bg-light-surface border-light-divider'} border-r` }>
            <Avatar type={ "xl" } image={ image } setImage={ setImage } />
            <span className={ `mt-2 text-base font-medium ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}` }>Choose your avatar</span>
          </div>
          {/* Form Section */ }
          <div className="flex flex-col justify-center gap-6 py-10 px-8 md:w-1/2">
            <Input name="Display Name" state={ name } setState={ setName } label />
            <Input name="about" state={ about } setState={ setAbout } label />
            <button
              className={ `w-full py-3 px-6 rounded-xl font-semibold shadow-lg transition-all duration-200 text-lg mt-2 hover:scale-105 focus:outline-none ${theme === 'dark' ? 'bg-dark-accent text-dark-surface border-dark-accent' : 'bg-light-accent text-light-surface border-light-accent'} border` }
              onClick={ onboardUserHandler }
            >
              Create Profile
            </button>
          </div>
        </div>
      </div>
      <style jsx global>{ `
          @keyframes gradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          .animate-gradient {
            animation: gradient 12s ease-in-out infinite;
          }
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(40px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 1.2s cubic-bezier(0.4,0,0.2,1) both;
          }
        `}</style>
    </div>
  )
}

export default onboarding;
