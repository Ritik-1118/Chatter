/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    // Only public, non-secret values may be exposed to the browser (NEXT_PUBLIC_*).
    // Call credentials are issued per user by the API (GET /api/auth/generate-token).
};

module.exports = nextConfig;
