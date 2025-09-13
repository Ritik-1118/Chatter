import admin from "../utils/firebaseAdmin.js";
import User from "../models/user-model.js";

export async function verifyFirebaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [, token] = authHeader.split(" ");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!admin?.auth) {
      return res.status(500).json({ error: "Auth not configured" });
    }
    const decoded = await admin.auth().verifyIdToken(token);
    // Attach minimal user context to request and resolved app user id (Mongo)
    let appUserId;
    if (decoded.email) {
      const user = await User.findOne({ email: decoded.email }).select("_id email");
      if (user) appUserId = user._id.toString();
    }
    req.user = { firebaseUid: decoded.uid, email: decoded.email, name: decoded.name, appUserId };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export default verifyFirebaseToken;
