/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    env:{
        NEXT_PUBLIC_ZEGO_APP_ID: 19450750,
        NEXT_PUBLIC_ZEGO_SERVER_ID:"d2282e410a167993feddaa5b0f09f83c",
    },
    images:{
        domains:["https://bchatapp-jt0i.onrender.com"],
    },
};

module.exports = nextConfig;
