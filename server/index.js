import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDb from "./utils/mongoDb.js"
import AuthRoutes from "./routes/AuthRoutes.js";
import MessageRoutes from "./routes/MessageRoutes.js"
import verifyFirebaseToken from "./middlewares/AuthMiddleware.js";
import { Server } from "socket.io";
import Message from "./models/message-model.js";
import admin from "./utils/firebaseAdmin.js";

dotenv.config();
const app = express()

const allowedOrigins = [
    "http://localhost:3000",
    "https://chatter-web.vercel.app",
    "https://chatapp-dun-nine.vercel.app",
    "https://chatter-beta-two.vercel.app",
    "https://chatter-0.vercel.app",
];

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST"],
}));
app.use(express.json());

app.use("/uploads/recordings", express.static("uploads/recordings"));
app.use("/uploads/images", express.static("uploads/images"));

// Public health and static assets
// Secure APIs with Firebase auth middleware
app.use("/api/auth", verifyFirebaseToken, AuthRoutes);
app.use("/api/messages", verifyFirebaseToken, MessageRoutes);

const port = process.env.PORT || 8000;
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
        methods: ["GET", "POST"],
    },
}); 

global.onlineUsers = new Map();

// Authenticate socket connections using Firebase ID token passed in handshake auth
io.use(async (socket, next) => {
    try {
        const token = socket.handshake?.auth?.token;
        if (!token) return next(new Error("Unauthorized"));
        const decoded = await admin.auth().verifyIdToken(token);
        socket.userId = decoded.uid;
        next();
    } catch (err) {
        next(new Error("Unauthorized"));
    }
});

io.on("connection",(socket) =>{
    global.chatSocket = socket;
        socket.on("add-user",() =>{
                onlineUsers.set(socket.userId,socket.id);
        socket.broadcast.emit("online-users",{
            onlineUsers:Array.from(onlineUsers.keys()),
        });
    });

    socket.on("signout",()=>{
        onlineUsers.delete(socket.userId);
        socket.broadcast.emit("online-users",{
            onlineUsers:Array.from(onlineUsers.keys()),
        });
    });

    socket.on("send-msg", async (data) => {
        const sendUserSocket = onlineUsers.get(data.to);
        if (sendUserSocket) {
            // Deliver the message to the recipient
            socket.to(sendUserSocket).emit("msg-recieve", {
                from: socket.userId,
                message: data.message,
            });
            // Update message status to 'delivered' in DB and notify sender
            if (data.message && data.message._id) {
                try {
                  await Message.findOneAndUpdate({ _id: data.message._id, receiver: data.to }, { messageStatus: "delivered" });
                } catch {}
                // Notify sender in real time
                const senderSocket = onlineUsers.get(socket.userId);
                if (senderSocket) {
                    io.to(senderSocket).emit("delivered", {
                        messageId: data.message._id,
                    });
                }
            }
        }
    });

    // Read receipt: recipient emits this when they open the chat
    socket.on("read-message", async (data) => {
        // data: { messageIds: [id1, id2, ...], from, to }
        if (Array.isArray(data.messageIds)) {
            await Message.updateMany(
                { _id: { $in: data.messageIds }, receiver: socket.userId },
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
                from:socket.userId,
                roomId: data.roomId,
                callType: data.callType,
            });
        }
    });
    socket.on("outgoing-video-call",(data)=> {
        const sendUserSocket = onlineUsers.get(data.to);
        if(sendUserSocket){
            socket.to(sendUserSocket).emit("incoming-video-call",{
                from:socket.userId,
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

    // Centralized error handler
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        console.error("Unhandled error:", err?.message || err);
        res.status(500).json({ error: "Internal Server Error" });
    });