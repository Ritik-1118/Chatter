import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
    {
        reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reported: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reason: { type: String, maxlength: 500, default: "" },
    },
    { timestamps: true },
);

export const Report = mongoose.model("Report", reportSchema);
