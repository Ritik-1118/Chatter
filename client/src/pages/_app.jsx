import { StateProvider } from "@/context/StateContext";
import reducer, { initialState } from "@/context/StateReducers";
import "@/styles/globals.css";
import Head from "next/head";
import { ThemeProvider } from "@/context/ThemeContext";
import axios from "axios";
import { firebaseAuth } from "@/utils/FirebaseConfig";
import { onAuthStateChanged, getIdToken } from "firebase/auth";

export default function App ( { Component, pageProps } ) {
  // Register a global axios interceptor to attach Firebase ID token
  if (typeof window !== 'undefined' && !axios.__chatterInterceptor) {
    axios.interceptors.request.use(async (config) => {
      try {
        const user = firebaseAuth.currentUser;
        if (user) {
          const token = await getIdToken(user, true);
          config.headers = config.headers || {};
          config.headers["Authorization"] = `Bearer ${token}`;
        }
      } catch {}
      return config;
    });
    axios.__chatterInterceptor = true;
  }
  return (
    <ThemeProvider>
      <StateProvider initialState={ initialState } reducer={ reducer }>
        <Head>
          <title>ChatApp</title>
          <link rel="shortcut icon" href="/favicon.ico" />
        </Head>
        <Component { ...pageProps } />
      </StateProvider>
    </ThemeProvider>
  )
}
