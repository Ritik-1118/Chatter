# 💬 Chatter - Real-Time Chat App

Welcome to **Chatter**, a modern, full-featured real-time chat application built with **Next.js**, **Node.js**, **Socket.IO**, and **Tailwind CSS**. Chatter supports messaging, voice and video calls, media sharing, and a beautiful, responsive interface.

---

## 🚀 Features

- **Real-Time Messaging:** Instant 1-on-1 chat with live updates.
- **Voice & Video Calls:** High-quality voice and video calls powered by WebRTC.
- **Media Sharing:** Send images, audio, emojies and more in your conversations.
- **Online Presence:** See who’s online and available to chat.
- **Message Status:** Delivered, read, and sent indicators for every message.
- **Search:** Quickly find messages and contacts.
- **User Profiles:** Custom avatars, status, and onboarding.
- **Dark & Light Themes:** Seamless theme switching for your comfort.
- **Mobile Responsive:** Fully optimized for all devices.

---

## 🖥️ Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS, Firebase Auth
- **Backend:** Node.js, Express, MongoDB, Prisma, Socket.IO
- **Real-Time:** Socket.IO, WebRTC (Zego)
- **ORM:** Prisma (PostgreSQL support)
- **Media:** Multer for uploads

---

## 📦 Project Structure

```
chatter-Chat App/
  ├── client/   # Next.js frontend
  └── server/   # Node.js/Express backend
```

---

## ⚡ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Ritik-1118/Chatter.git
cd Chatter
```

### 2. Setup the Backend

```bash
cd server
npm install
# Setup your .env file
npm start
```

- MongoDB and PostgreSQL (Prisma) supported.
- Configure your database URLs in `.env`.

### 3. Setup the Frontend

```bash
cd client
npm install
# Setup your .env for Firebase and API endpoints
npm run dev
```
---

## 🛠️ Environment Variables

- **Backend:**  
  - `MONGOURL` (MongoDB connection string)
  - `DATABASE_URL` (PostgreSQL for Prisma)
  - `ZEGO_APP_ID`, `ZEGO_SERVER_ID` (WebRTC)
- **Frontend:**  
  - `NEXT_PUBLIC_FIREBASE_API_KEY`, etc. (Firebase config)
  - `NEXT_PUBLIC_API_URL` (API endpoint)

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Feel free to check the [issues page](https://github.com/Ritik-1118/Chatter/issues).

---

## 📄 License

This project is [MIT](LICENSE) licensed.

---

> _Made with ❤️ for seamless conversations!_