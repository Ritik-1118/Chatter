import Message from '../models/message-model.js'; 
import User from "../models/user-model.js"; 
import {renameSync} from 'fs';

// import getPrismaInstance from "../utils/PrismaClient.js";

// export const addMessage = async (req,res,next) =>{
//     try {
//         const prisma = await getPrismaInstance();
//         const {message, from, to} = req.body;
//         const getUser = onlineUsers.get(to);
//         if(message && from && to){
//             const newMessage = await prisma.messages.create({
//                 data: {
//                     message,
//                     sender:{connect:{id:parseInt(from)}},
//                     reciever:{connect:{id:parseInt(to)}},
//                     messageStatus: getUser ? "Delivered" : "sent",
//                 },
//                 include:{ sender:true, reciever:true },
//             });
//             console.log("New message created.");
//             return res.status(201).send({message: newMessage});
//         }
//         return res.status(400).send("Form,to and message is required.");
//     } catch (error) {
//         console.error(error); 
//         next(error);
//     }
// }
// export const getMessages  = async (req,res,next) =>{
//     try {
//         const prisma = getPrismaInstance();
//         const {from,to } = req.params;
//         const messages = await prisma.messages.findMany({
//             where:{
//                 OR: [
//                     {
//                         senderId: parseInt(from),
//                         recieverId: parseInt(to),
//                     },
//                     {
//                         senderId: parseInt(to),
//                         recieverId: parseInt(from),
//                     },
//                 ],
//             },
//             orderBy: {
//                 id: "asc",
//             }
//         });
//         const unreadMessages = [];
//         messages.forEach ((message,index) => {
//             if(message.messageStatus !== "read" && message.senderId == parseInt(to)){
//                 unreadMessages.push(message.id);
//                 messages[index].messageStatus = "read";
//             }
//         });
//         await prisma.messages.updateMany({
//             where:{
//                 id:{in:unreadMessages},
//             },data:{
//                 messageStatus: "read",
//             },
//         });
//         res.status(200).json({messages});
//     } catch (error) {
//         next(error);
//     }
// };
// export const addImageMessage = async (req,res,next) => {
//     try {
//         if(req.file){
//             const date = Date.now();
//             let fileName = "uploads/images/" + date + req.file.originalname;
//             renameSync(req.file.path,fileName);
//             const prisma = getPrismaInstance();
//             const {from,to} = req.query;
//             if(from && to) {
//                 const message = await prisma.messages.create({
//                     data: {
//                         message: fileName,
//                         sender:{connect:{id:parseInt(from)}},
//                         reciever:{connect:{id:parseInt(to)}},
//                         type:"image",
//                         messageStatus: "sent",
//                     },
//                 });
//                 return res.status(201).json({message});
//             }
//             return res.status(400).send("From,To is required.");
//         }
//         return res.status(400).send("Image is required.");
//     } catch (error) {
//         next(error);
//     }
// };
// export const addAudioMessage = async (req,res,next) => {
//     try {
//         if(req.file){
//             const date = Date.now();
//             let fileName = "uploads/recordings/" + date + req.file.originalname;
//             renameSync(req.file.path,fileName);
//             const prisma = getPrismaInstance();
//             const {from,to} = req.query;
//             if(from && to) {
//                 const message = await prisma.messages.create({
//                     data: {
//                         message: fileName,
//                         sender:{connect:{id:parseInt(from)}},
//                         reciever:{connect:{id:parseInt(to)}},
//                         type:"audio",
//                         messageStatus: "sent",
//                     },
//                 });
//                 return res.status(201).json({message});
//             }
//             return res.status(400).send("From,To is required.");
//         }
//         return res.status(400).send("Audio is required.");
//     } catch (error) {
//         next(error);
//     }
// };
// export const getInitialContactsWithMessages = async (req,res,next) => {
//     try {
//         const userId = parseInt(req.params.from);
//         const prisma = getPrismaInstance();
//         const user = await prisma.user.findUnique({
//             where: { id:userId },
//             include:{
//                 sentMessages:{
//                     include:{
//                         reciever:true,
//                         sender:true,
//                     },
//                     orderBy:{
//                         createdAt: "desc",
//                     },
//                 },
//                 recievedMessages: {
//                     include:{
//                         reciever:true,
//                         sender:true,
//                     },
//                     orderBy:{
//                         createdAt: "desc",
//                     },
//                 }
//             },
//         });
//         const messages = [...user.sentMessages,...user.recievedMessages];
//         messages.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
//         const users = new Map();
//         const messageStatusChange = [];

//         messages.forEach((msg)=>{
//             const isSender = msg.senderId === userId;
//             const calculatedId = isSender ? msg.recieverId : msg.senderId;
//             if(msg.messageStatus === "sent" ){
//                 messageStatusChange.push(msg.id)
//             }
//             const {
//                 id,
//                 type,
//                 message,
//                 messageStatus,
//                 createdAt,
//                 senderId,
//                 recieverId,
//             } = msg;
//             if(!users.get(calculatedId)){
//                 let user = {
//                     messageId: id,
//                     type,
//                     message,
//                     messageStatus,
//                     createdAt,
//                     senderId,
//                     recieverId,
//                 };
//                 if (isSender) {
//                     user = {
//                         ... user,
//                         ... msg.reciever,
//                         totalUnreadMessages: 0,
//                     };
//                 } else {
//                     user = {
//                     ... user,
//                     ... msg.sender,
//                     totalUnreadMessages: messageStatus !== "read" ? 1 : 0,
//                     };
//                 }
//                 users.set(calculatedId,{...user});
//             }else if(messageStatus !== "read" && !isSender){
//                 const user = users.get(calculatedId);
//                 users.set(calculatedId, {
//                     ... user,
//                     totalUnreadMessages: user.totalUnreadMessages + 1,
//                 });
//             }
//         });
//         if(messageStatusChange.length){
//             await prisma.messages.updateMany({
//                 where:{
//                     id:{in:messageStatusChange},
//                 },data:{
//                     messageStatus: "delivered",
//                 },
//             });
//         }

//         return res.status(200).json({
//             users:Array.from(users.values()),
//             onlineUsers:Array.from(onlineUsers.keys()),
//         })

//     } catch (error) {
//         next(error);
//     };
// };


export const addMessage = async (req, res, next) => {
    try {
        console.log(req.body);
        const { message, from, to } = req.body;
        const getUser = onlineUsers.get(to);
        if (message && from && to) {
            const senderUser = await User.findById(from);
            const receiverUser = await User.findById(to);
            if (!senderUser || !receiverUser) {
                return res.status(404).send("Sender or receiver user not found.");
            }
            const newMessage = await Message.create({
                message,
                sender: senderUser._id,
                receiver: receiverUser._id,
                messageStatus: getUser ? "Delivered" : "sent",
            });
            await User.findByIdAndUpdate(from, { $push: { sentMessages: newMessage._id } });
            await User.findByIdAndUpdate(to, { $push: { receivedMessages: newMessage._id } });
            // console.log("New message created.");
            // console.log(newMessage)
            return res.status(201).send({ message: newMessage });
        }
        return res.status(400).send("From, to, and message are required.");
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const getMessages = async (req, res, next) => {
    try {
        const { from, to } = req.params;
        const messages = await Message.find({
            $or: [
                { sender: from, receiver: to },
                { sender: to, receiver: from },
            ]
        }).sort({ _id: "asc" });

        const unreadMessages = [];
        messages.forEach((message, index) => {
            if (message.messageStatus !== "read" && message.sender == to) {
                unreadMessages.push(message._id);
                messages[index].messageStatus = "read";
            }
        });
        await Message.updateMany({ _id: { $in: unreadMessages } }, { messageStatus: "read" });
        res.status(200).json({ messages });
    } catch (error) {
        next(error);
    }
};
export const addImageMessage = async (req, res, next) => {
    try {
        if (req.file) {
            const date = Date.now();
            const fileName = "uploads/images/" + date + req.file.originalname;
            renameSync(req.file.path, fileName);

            const { from, to } = req.query;
            // console.log(from, to)
            if (from && to) {
                const message = await Message.create({
                    message: fileName,
                    sender: from,
                    receiver: to,
                    type: "image",
                    messageStatus: "sent",
                });
                await User.findByIdAndUpdate(from, { $push: { sentMessages: message._id } });
                await User.findByIdAndUpdate(to, { $push: { receivedMessages: message._id } });
                return res.status(201).json({ message });
            }
            return res.status(400).send("From and To are required.");
        }
        return res.status(400).send("Image is required.");
    } catch (error) {
        next(error);
    }
};
export const addAudioMessage = async (req, res, next) => {
    try {
        if (req.file) {
            const date = Date.now();
            const fileName = "uploads/recordings/" + date + req.file.originalname;
            renameSync(req.file.path, fileName);

            const { from, to } = req.query;
            if (from && to) {
                const message = await Message.create({
                    message: fileName,
                    sender: from,
                    receiver: to,
                    type: "audio",
                    messageStatus: "sent",
                });
                await User.findByIdAndUpdate(from, { $push: { sentMessages: message._id } });
                await User.findByIdAndUpdate(to, { $push: { receivedMessages: message._id } });
                return res.status(201).json({ message });
            }
            return res.status(400).send("From and To are required.");
        }
        return res.status(400).send("Audio is required.");
    } catch (error) {
        next(error);
    }
};
export const getInitialContactsWithMessages = async (req, res, next) => {
    try {
        const userId = req.params.from;
        // console.log("userId = ============",req.params)
        // console.log("userId = ============",req.params.from)
        const user = await User.findById(userId)
            .populate({
                path: 'sentMessages',
                populate: { path: 'sender receiver' },
                options: { sort: { createdAt: 'desc' } }
            })
            .populate({
                path: 'receivedMessages',
                populate: { path: 'sender receiver' },
                options: { sort: { createdAt: 'desc' } }
            });
        // console.log("user = ============",user)
        // console.log("sentMessages = ============",user.sentMessages)
        // console.log("sentMessages.sender = ============",user.sentMessages.receiver)
        const messages = [...user.sentMessages, ...user.receivedMessages];
        // console.log("messages:-----------",messages);
        messages.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        const users = new Map();
        const messageStatusChange = [];
        
        messages.forEach((msg) => {
            const isSender = msg.sender._id.toString() === userId.toString();
            const calculatedId = isSender ? msg.receiver._id.toString() : msg.sender._id.toString();
            
            if (msg.messageStatus === "sent") {
                messageStatusChange.push(msg._id);
            }
            
            const { _id, type, message, messageStatus, createdAt, sender, receiver } = msg;
            
            if (!users.get(calculatedId)) {
                let user = {
                    messageId: _id,
                    type,
                    message,
                    messageStatus,
                    createdAt,
                    sender: sender._id,
                    receiver: receiver._id,
                };
                
                if (isSender) {
                    user = {
                        ...user,
                        ...receiver.toObject(),
                        totalUnreadMessages: 0,
                    };
                } else {
                    user = {
                        ...user,
                        ...sender.toObject(),
                        totalUnreadMessages: messageStatus !== "read" ? 1 : 0,
                    };
                }
                
                users.set(calculatedId, { ...user });
            } else if (messageStatus !== "read" && !isSender) {
                const user = users.get(calculatedId);
                users.set(calculatedId, {
                    ...user,
                    totalUnreadMessages: user.totalUnreadMessages + 1,
                });
            }
        });
        
        if (messageStatusChange.length) {
            await Message.updateMany({ _id: { $in: messageStatusChange } }, { messageStatus: "delivered" });
        }
        
        return res.status(200).json({
            users: Array.from(users.values()),
            onlineUsers: Array.from(onlineUsers.keys()),
        });
    } catch (error) {
        next(error);
    }
};

