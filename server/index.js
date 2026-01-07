import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDb from "./utils/mongoDb.js"
import AuthRoutes from "./routes/AuthRoutes.js";
import MessageRoutes from "./routes/MessageRoutes.js"
import { Server } from "socket.io";
import Message from "./models/message-model.js";
import AuthMiddleware from "./middlewares/AuthMiddleware.js";
import { firebaseAdmin } from "./utils/firebaseAdmin.js";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express()

app.use(cors());
app.use(express.json());

app.use("/uploads/recordings", express.static("uploads/recordings"));
app.use("/uploads/images", express.static("uploads/images"));

app.use("/api/auth", AuthMiddleware, AuthRoutes);
app.use("/api/messages", AuthMiddleware, MessageRoutes);

const port = process.env.PORT || 8000;
// Ensure upload directories exist in all environments
const uploadDirs = [
    path.join(process.cwd(), "uploads", "images"),
    path.join(process.cwd(), "uploads", "recordings"),
];
uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

connectDb();
const server = app.listen(port,()=>{
    console.log(`Server is running on PORT:${port}`);
}) 
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://chatter-web.vercel.app",
      "https://chatapp-dun-nine.vercel.app",
      "https://chatter-beta-two.vercel.app",
      "https://chatter-0.vercel.app",
    ],
    methods: ["*"], // or ["GET", "POST"], more secure
  },
});

global.onlineUsers = new Map();

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        console.log("[socket] handshake token present", Boolean(token));
        if (!token) return next(new Error("unauthorized"));
        const decoded = await firebaseAdmin.auth().verifyIdToken(token);
        socket.user = { uid: decoded.uid, email: decoded.email };
        console.log("[socket] auth ok", socket.user.email);
        return next();
    } catch (err) {
        console.error("[socket] auth error", err?.message);
        return next(new Error("unauthorized"));
    }
});

io.on("connection",(socket) =>{
    console.log("[socket] connected", socket.id, "user", socket.user?.email);
    global.chatSocket = socket;
    socket.on("add-user",(userId) =>{
        const id = userId ? userId.toString() : undefined;
        if (!id) return;
        onlineUsers.set(id,socket.id);
        console.log("[socket] add-user", { id, socketId: socket.id, onlineKeys: Array.from(onlineUsers.keys()) });
        socket.broadcast.emit("online-users",{
            onlineUsers:Array.from(onlineUsers.keys()),
        });
    });

    socket.on("signout",(id)=>{
        onlineUsers.delete(id?.toString());
        socket.broadcast.emit("online-users",{
            onlineUsers:Array.from(onlineUsers.keys()),
        });
    });

    socket.on("send-msg", async (data) => {
        const { message, from, to, tempId } = data || {};
        const toId = to ? to.toString() : undefined;
        const fromId = from ? from.toString() : undefined;
        const normalizedMessage = message ? {
            ...message,
            sender: message.sender?.toString ? message.sender.toString() : message.sender,
            receiver: message.receiver?.toString ? message.receiver.toString() : message.receiver,
            type: message.type || "text",
        } : message;
        const sendUserSocket = toId ? onlineUsers.get(toId) : undefined;

        console.log("[socket] send-msg", {
            from: fromId,
            to: toId,
            hasRecipientSocket: !!sendUserSocket,
            onlineKeys: Array.from(onlineUsers.keys()),
        });
        if (sendUserSocket) {
            // Deliver the message to the recipient
            socket.to(sendUserSocket).emit("msg-recieve", {
                from: fromId,
                message: normalizedMessage,
            });
        }

        // Ack back to sender to reconcile optimistic messages
        if (fromId) {
            const senderSocket = onlineUsers.get(fromId);
            if (senderSocket) {
                io.to(senderSocket).emit("msg-ack", {
                    tempId,
                    message: normalizedMessage,
                });
            }
        }

        // Update message status to 'delivered' in DB and notify sender
        if (normalizedMessage && normalizedMessage._id) {
            const senderSocket = fromId ? onlineUsers.get(fromId) : undefined;
            if (senderSocket) {
                io.to(senderSocket).emit("delivered", {
                    messageId: normalizedMessage._id,
                });
            }
        }
    });

    // Read receipt: recipient emits this when they open the chat
    socket.on("read-message", async (data) => {
        // data: { messageIds: [id1, id2, ...], from, to }
        if (Array.isArray(data.messageIds)) {
            await Message.updateMany(
                { _id: { $in: data.messageIds } },
                { messageStatus: "read" }
            );
            // Notify sender in real time
            const senderSocket = onlineUsers.get(data.from);
            if (senderSocket) {
                io.to(senderSocket).emit("read", {
                    messageIds: data.messageIds,
                });
            }
        }
    });

// For videoCall and voiceCall
    socket.on("outgoing-voice-call",(data)=> {
        const sendUserSocket = onlineUsers.get(data.to);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("incoming-voice-call",{
                from:data.from,
                roomId: data.roomId,
                callType: data.callType,
            });
        }
    });
    socket.on("outgoing-video-call",(data)=> {
        const sendUserSocket = onlineUsers.get(data.to);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("incoming-video-call",{
                from:data.from,
                roomId: data.roomId,
                callType: data.callType,
            });
        }
    });
    socket.on("reject-voice-call",(data)=>{
        const sendUserSocket = onlineUsers.get(data.from);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("voice-call-rejected")
        }
    });
    socket.on("reject-video-call",(data)=>{
        const sendUserSocket = onlineUsers.get(data.from);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("video-call-rejected")
        }
    });
    socket.on("accept-incoming-call",({id})=>{
        const sendUserSocket = onlineUsers.get(id);
        socket.to(sendUserSocket).emit("accept-call");
    })

    socket.on("disconnect", () => {
        // Remove the user from onlineUsers when their socket disconnects
        for (const [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
        // Optionally, broadcast updated online users
        socket.broadcast.emit("online-users",{
            onlineUsers:Array.from(onlineUsers.keys()),
        });
    });

});