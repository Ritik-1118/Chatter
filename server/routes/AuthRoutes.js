import {Router} from "express";
const router = Router();
import { checkUser, generateToken, getAllUsers, onBoardUser } from "../controllers/AuthController.js";

router.post("/check-user", checkUser);
router.post("/onboard-user",onBoardUser);
router.get("/get-contacts",getAllUsers);
router.get("/generate-token/:userId", generateToken);

export default router;