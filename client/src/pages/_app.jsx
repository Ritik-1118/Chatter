import { StateProvider } from "@/context/StateContext";
import reducer, { initialState } from "@/context/StateReducers";
import "@/styles/globals.css";
import Head from "next/head";
import { ThemeProvider } from "@/context/ThemeContext";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function App ( { Component, pageProps } ) {
  const router = useRouter();
  const [ isRouteChanging, setIsRouteChanging ] = useState( false );

  useEffect( () => {
    const handleStart = () => setIsRouteChanging( true );
    const handleDone = () => setIsRouteChanging( false );

    router.events.on( "routeChangeStart", handleStart );
    router.events.on( "routeChangeComplete", handleDone );
    router.events.on( "routeChangeError", handleDone );

    return () => {
      router.events.off( "routeChangeStart", handleStart );
      router.events.off( "routeChangeComplete", handleDone );
      router.events.off( "routeChangeError", handleDone );
    };
  }, [ router.events ] );

  return (
    <ThemeProvider>
      <StateProvider initialState={ initialState } reducer={ reducer }>
        <Head>
          <title>ChatApp</title>
          <link rel="shortcut icon" href="/favicon.ico" />
        </Head>
        <div className="app-shell">
          { isRouteChanging && <div className="route-progress" aria-hidden="true" /> }
          <Component { ...pageProps } />
        </div>
      </StateProvider>
    </ThemeProvider>
  )
}
