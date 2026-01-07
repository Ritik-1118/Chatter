import axios from "axios";
import { firebaseAuth } from "./FirebaseConfig";

// Fetches the current Firebase ID token and sets it as default Authorization header for axios.
export const setAxiosAuthToken = async () => {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  return token;
};
