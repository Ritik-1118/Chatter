// E2E shim for "firebase/app": no network, no real project needed.
const apps = [];
export function initializeApp(options) {
    const app = { name: "[DEFAULT]", options };
    apps.push(app);
    return app;
}
export const getApps = () => apps;
export const getApp = () => apps[0];
