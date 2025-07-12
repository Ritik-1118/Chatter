import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import connectDb from "./utils/mongoDb.js"
import AuthRoutes from "./routes/AuthRoutes.js";
import MessageRoutes from "./routes/MessageRoutes.js"
import { Server } from "socket.io";
import Message from "./models/message-model.js";

dotenv.config();
const app = express()

app.use(cors());
app.use(express.json());

app.use("/uploads/recordings", express.static("uploads/recordings"));
app.use("/uploads/images", express.static("uploads/images"));

app.use("/api/auth", AuthRoutes);
app.use("/api/messages",MessageRoutes);

const port = process.env.PORT || 8000;
connectDb();
const server = app.listen(port,()=>{
    console.log(`Server is running on PORT:${port}`);
}) 
const io = new Server(server,{
    cors:{
        // origin: "http://localhost:3000",
        // origin: "chatapp-2qy43mk01-ritik-1118.vercel.app",
        origin:"*",
    },
});

global.onlineUsers = new Map();

io.on("connection",(socket) =>{
    global.chatSocket = socket;
    socket.on("add-user",(userId) =>{
        onlineUsers.set(userId,socket.id);
        socket.broadcast.emit("online-users",{
            onlineUsers:Array.from(onlineUsers.keys()),
        });
    });

    socket.on("signout",(id)=>{
        onlineUsers.delete(id);
        socket.broadcast.emit("online-users",{
            onlineUsers:Array.from(onlineUsers.keys()),
        });
    });

    socket.on("send-msg", async (data) => {
        const sendUserSocket = onlineUsers.get(data.to);
        if (sendUserSocket) {
            // Deliver the message to the recipient
            socket.to(sendUserSocket).emit("msg-recieve", {
                from: data.from,
                message: data.message,
            });
            // Update message status to 'delivered' in DB and notify sender
            if (data.message && data.message._id) {
                await Message.findByIdAndUpdate(data.message._id, { messageStatus: "delivered" });
                // Notify sender in real time
                const senderSocket = onlineUsers.get(data.from);
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

});