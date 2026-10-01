import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

export const MESSAGE_TYPES = ["text", "image", "audio", "file", "call", "system"];
export const MESSAGE_STATUSES = ["sent", "delivered", "read"];

const messageSchema = new mongoose.Schema(
    {
        conversation: { type: ObjectId, ref: "Conversation", required: true },
        sender: { type: ObjectId, ref: "User", default: null },
        // Direct chats only; kept so legacy clients can keep reading `receiver`.
        receiver: { type: ObjectId, ref: "User", default: null },
        // Participants (minus the sender) at send time; drives delivery/read state.
        recipients: [{ type: ObjectId, ref: "User" }],
        deliveredTo: [{ type: ObjectId, ref: "User" }],
        readBy: [{ type: ObjectId, ref: "User" }],
        type: { type: String, enum: MESSAGE_TYPES, default: "text" },
        // Text for text/system/call messages; the storage key for media.
        message: { type: String, default: "" },
        file: {
            name: String,
            size: Number,
            mime: String,
        },
        messageStatus: { type: String, enum: MESSAGE_STATUSES, default: "sent" },
        replyTo: { type: ObjectId, ref: "Message", default: null },
        reactions: [{ user: { type: ObjectId, ref: "User" }, emoji: String, _id: false }],
        editedAt: { type: Date, default: null },
        deletedAt: { type: Date, default: null },
        deletedFor: [{ type: ObjectId, ref: "User" }],
    },
    { timestamps: true },
);

messageSchema.index({ conversation: 1, _id: -1 });
messageSchema.index({ recipients: 1, conversation: 1 });
messageSchema.index({ message: 1 }, { partialFilterExpression: { type: { $in: ["image", "audio", "file"] } } });

export const Message = mongoose.model("Message", messageSchema);

// Aggregation-pipeline update that recomputes messageStatus from recipients/deliveredTo/readBy.
export const recomputeStatusPipeline = [
    {
        $set: {
            messageStatus: {
                $cond: [
                    { $setIsSubset: ["$recipients", "$readBy"] },
                    "read",
                    { $cond: [{ $setIsSubset: ["$recipients", { $setUnion: ["$deliveredTo", "$readBy"] }] }, "delivered", "sent"] },
                ],
            },
        },
    },
];
