import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, default: "text" },
    message: String,
    messageStatus: { type: String, default: "text" },
    createdAt: { type: Date, default: Date.now }
},{ timestamps: true });

const Message = mongoose.model('Message', messageSchema);
export default Message;