import { Head, Html, Main, NextScript } from "next/document";
import { themeBootScript } from "@/context/ThemeContext";

export default function Document() {
    return (
        <Html lang="en" className="dark">
            <Head>
                <link rel="icon" href="/favicon.ico" />
                <meta name="theme-color" content="#121212" />
                <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
            </Head>
            <body>
                <Main />
                <NextScript />
                <div id="photo-picker-element" />
            </body>
        </Html>
    );
}
