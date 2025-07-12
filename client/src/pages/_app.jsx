import { StateProvider } from "@/context/StateContext";
import reducer, { initialState } from "@/context/StateReducers";
import "@/styles/globals.css";
import Head from "next/head";
import { ThemeProvider } from "@/context/ThemeContext";

export default function App ( { Component, pageProps } ) {
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
