import { firebaseAdmin } from "../utils/firebaseAdmin.js";

// Verifies Firebase ID token from Authorization: Bearer <token>
// Attaches { uid, email } to req.user.
const AuthMiddleware = async (req, res, next) => {
	try {
		const authHeader = req.headers.authorization || "";
		const [scheme, token] = authHeader.split(" ");
		if (scheme !== "Bearer" || !token) {
			return res.status(401).json({ message: "Missing or invalid Authorization header" });
		}

		const decoded = await firebaseAdmin.auth().verifyIdToken(token);
		if (!decoded || !decoded.email) {
			return res.status(401).json({ message: "Invalid token" });
		}

		req.user = { uid: decoded.uid, email: decoded.email };
		return next();
	} catch (error) {
		console.error("AuthMiddleware error", error);
		return res.status(401).json({ message: "Unauthorized" });
	}
};

export default AuthMiddleware;
