import {Router} from "express";
import rateLimit from "express-rate-limit";
const router = Router();
import { checkUser, generateToken, getAllUsers, onBoardUser } from "../controllers/AuthController.js";

const tokenLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

router.post("/check-user", checkUser);
router.post("/onboard-user",onBoardUser);
router.get("/get-contacts",getAllUsers);
router.get("/generate-token/:userId", tokenLimiter, generateToken);

export default router;