import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { SettingsProvider } from "@/context/SettingsContext";
import { StateProvider } from "@/context/StateContext";
import reducer, { initialState } from "@/context/StateReducers";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import "@/styles/globals.css";

export default function App({ Component, pageProps }) {
    const router = useRouter();
    const [routeChanging, setRouteChanging] = useState(false);

    useEffect(() => {
        const start = () => setRouteChanging(true);
        const done = () => setRouteChanging(false);
        router.events.on("routeChangeStart", start);
        router.events.on("routeChangeComplete", done);
        router.events.on("routeChangeError", done);
        return () => {
            router.events.off("routeChangeStart", start);
            router.events.off("routeChangeComplete", done);
            router.events.off("routeChangeError", done);
        };
    }, [router.events]);

    return (
        <ThemeProvider>
            <SettingsProvider>
                <ToastProvider>
                    <StateProvider initialState={initialState} reducer={reducer}>
                        <Head>
                            <title>Chatter</title>
                            <meta name="viewport" content="width=device-width, initial-scale=1" />
                        </Head>
                        <div className="app-shell">
                            {routeChanging && <div className="route-progress" aria-hidden="true" />}
                            <Component {...pageProps} />
                        </div>
                    </StateProvider>
                </ToastProvider>
            </SettingsProvider>
        </ThemeProvider>
    );
}
