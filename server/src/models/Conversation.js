import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const conversationSchema = new mongoose.Schema(
    {
        type: { type: String, enum: ["direct", "group"], required: true },
        participants: [{ type: ObjectId, ref: "User", required: true }],
        // Sorted "<idA>:<idB>" for direct chats so each pair has exactly one conversation.
        directKey: { type: String, index: { unique: true, sparse: true } },
        name: { type: String, trim: true, maxlength: 60 },
        description: { type: String, default: "", maxlength: 200 },
        avatarUrl: { type: String, default: "" },
        admins: [{ type: ObjectId, ref: "User" }],
        createdBy: { type: ObjectId, ref: "User" },
        lastMessage: { type: ObjectId, ref: "Message", default: null },
        lastMessageAt: { type: Date, default: null },
    },
    { timestamps: true },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.statics.directKeyFor = (a, b) => [String(a), String(b)].sort().join(":");

export const Conversation = mongoose.model("Conversation", conversationSchema);
