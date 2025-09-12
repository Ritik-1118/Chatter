import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            default: "text",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("GroupMessage", groupMessageSchema);
