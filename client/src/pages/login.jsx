import { useStateProvider } from "@/context/StateContext";
import { reducerCases } from "@/context/constants";
import { CHECK_USER_ROUTE } from "@/utils/ApiRoutes";
import { firebaseAuth } from "@/utils/FirebaseConfig";
import axios from "axios";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";
import { FcGoogle } from 'react-icons/fc';

function login() {
  const router = useRouter();
  const [{ userInfo, newUser }, dispatch] = useStateProvider();
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    // Check localStorage or system preference
    const savedTheme = typeof window !== 'undefined' && localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  useEffect(() => {
    if (userInfo?.id && !newUser) router.push("/");
  }, [userInfo, newUser]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(firebaseAuth, provider);
    const user = userCredential.user;
    const name = user.displayName;
    const uid = user.uid;
    const email = user.email;
    const profileImage = user.photoURL;
    try {
      if (email) {
        const { data } = await axios.post(CHECK_USER_ROUTE, { email });
        if (!data.status) {
          dispatch({ type: reducerCases.SET_NEW_USER, newUser: true });
          dispatch({
            type: reducerCases.SET_USER_INFO, userInfo: {
              uid, name, email, profileImage, status: "",
            },
          });
          router.push("/onboarding");
        } else {
          const { _id, name, email, profilePicture: profileImage, status } = data.data;
          dispatch({
            type: reducerCases.SET_USER_INFO,
            userInfo: {
              id: _id, name, email, profileImage, status,
            },
          });
          router.push("/");
        }
      }
    } catch (err) {
      console.log(err);
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
  };

  return (
    <div className={`relative min-h-screen w-full flex items-center justify-center overflow-hidden ${theme === 'dark' ? 'bg-dark-background' : 'bg-light-background'}`}>
      <button
        className={`absolute top-6 right-6 z-20 px-4 py-2 rounded-full shadow-md font-semibold transition-colors duration-200 focus:outline-none ${theme === 'dark' ? 'bg-dark-surface text-dark-accent border-dark-accent' : 'bg-light-surface text-light-accent border-light-accent'} border`}
        onClick={toggleTheme}
        aria-label="Toggle dark/light mode"
      >
        {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
      </button>
      {/* Animated Gradient Background */}
      <div className={`absolute inset-0 z-0 animate-gradient ${theme === 'dark' ? 'bg-dark-accent' : 'bg-light-accent'} opacity-20`} style={{ filter: 'blur(3px)' }} />
      {/* Theme toggle button can be implemented with a state or system preference, or omitted for now */}
      {/* Glassmorphic Card */}
      <div className={`relative z-10 flex flex-col items-center justify-center px-8 py-10 rounded-2xl shadow-2xl max-w-sm w-full mx-4 animate-fade-in ring-2 backdrop-blur-2xl ${theme === 'dark' ? 'bg-dark-secondary-background text-dark-primary-text border-dark-divider' : 'bg-light-secondary-background text-light-primary-text border-light-divider'} border`}>
        {/* Logo */}
        <div className="mb-4 flex flex-col items-center">
          <Image src={'/gifs/G1.gif'} alt="Chatter Logo" width={80} height={80} className={`rounded-full shadow-lg border-4 ${theme === 'dark' ? 'border-dark-accent' : 'border-light-accent'}`} />
          <span className={`mt-3 text-4xl font-extrabold drop-shadow-lg tracking-wide animate-bounce font-mono ${theme === 'dark' ? 'text-dark-accent' : 'text-light-accent'}`}>Chatter</span>
        </div>
        {/* Welcome Message */}
        <div className="mb-6 text-center">
          <h1 className={`text-2xl md:text-3xl font-bold mb-2 drop-shadow ${theme === 'dark' ? 'text-dark-primary-text' : 'text-light-primary-text'}`}>Welcome Back!</h1>
          <p className={`text-base font-medium ${theme === 'dark' ? 'text-dark-secondary-text' : 'text-light-secondary-text'}`}>Sign in to continue to your chats</p>
        </div>
        {/* Google Login Button */}
        <button
          className={`flex items-center justify-center gap-4 w-full py-3 px-5 rounded-xl transition-all duration-200 shadow-xl hover:scale-105 focus:outline-none focus:ring-2 group ${theme === 'dark' ? 'bg-dark-accent text-dark-surface border-dark-accent' : 'bg-light-accent text-light-surface border-light-accent'} border`}
          onClick={handleLogin}
        >
          <FcGoogle className="text-2xl group-hover:scale-110 transition-transform duration-200" />
          <span className="text-base font-semibold transition-colors duration-200 tracking-wide">Login with Google</span>
        </button>
      </div>
      {/* Decorative Bubbles */}
      {/* The theme-specific bubble classes were removed as per the edit hint to remove useTheme/ThemeProvider. */}
      {/* The original code had theme-specific bubble classes, but they were tied to colors.theme. */}
      {/* Since colors is no longer available, these classes are removed. */}
      {/* The original code had light/dark theme specific bubbles, but they were not tied to colors.theme. */}
      {/* The edit hint implies removing all color-specific styling, so these bubbles are also removed. */}
      <style jsx global>{`
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
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-30px); }
        }
        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite;
        }
        @keyframes float-slower {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(40px); }
        }
        .animate-float-slower {
          animation: float-slower 14s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default login;
