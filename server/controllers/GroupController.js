import Group from "../models/group-model.js";
import User from "../models/user-model.js";

export const createGroup = async (req, res, next) => {
    try {
        const { name, members, admin } = req.body;
        let group = await Group.create({
            name,
            members,
            admin,
        });
        await User.updateMany(
            { _id: { $in: members } },
            { $push: { groups: group._id } }
        );
        group = await group.populate("members admin");
        res.status(201).json({ group });
    } catch (error) {
        next(error);
    }
};

export const getUserGroups = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId).populate("groups");
        res.status(200).json({ groups: user.groups });
    } catch (error) {
        next(error);
    }
};

export const getGroupMembers = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const group = await Group.findById(groupId).populate("members");
        res.status(200).json({ members: group.members });
    } catch (error) {
        next(error);
    }
};

export const addGroupMember = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        await Group.findByIdAndUpdate(groupId, {
            $push: { members: userId },
        });
        await User.findByIdAndUpdate(userId, {
            $push: { groups: groupId },
        });
        res.status(200).send("Member added successfully.");
    } catch (error) {
        next(error);
    }
};
