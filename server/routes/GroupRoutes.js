import { Router } from "express";
import {
    createGroup,
    getUserGroups,
    getGroupMembers,
    addGroupMember,
} from "../controllers/GroupController.js";

const router = Router();

router.post("/create-group", createGroup);
router.get("/get-user-groups/:userId", getUserGroups);
router.get("/get-group-members/:groupId", getGroupMembers);
router.post("/add-group-member/:groupId", addGroupMember);

export default router;
