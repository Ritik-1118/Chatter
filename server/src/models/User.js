import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        firebaseUid: { type: String, index: { unique: true, sparse: true } },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true, minlength: 3, maxlength: 50 },
        about: { type: String, default: "", maxlength: 140 },
        profilePicture: { type: String, default: "/default_avatar.png" },
        lastSeen: { type: Date, default: null },
        blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

userSchema.index({ name: 1 });

// Shape other users may see: never includes email or block lists.
userSchema.methods.toPublic = function toPublic() {
    return {
        id: this._id.toString(),
        _id: this._id.toString(),
        name: this.deletedAt ? "Deleted user" : this.name,
        about: this.deletedAt ? "" : this.about,
        profilePicture: this.deletedAt ? "/default_avatar.png" : this.profilePicture,
    };
};

// Shape returned to the user themself.
userSchema.methods.toSelf = function toSelf() {
    return {
        ...this.toPublic(),
        email: this.email,
        blockedUsers: (this.blockedUsers || []).map(String),
        createdAt: this.createdAt,
    };
};

export const User = mongoose.model("User", userSchema);
export const PUBLIC_USER_FIELDS = "name about profilePicture lastSeen deletedAt";
