import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: { type: String, unique: true },
    name: String,
    profilePicture: { type: String, default: "" },
    about: { type: String, default: "" },
    sentMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
    receivedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }]
},{ timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;