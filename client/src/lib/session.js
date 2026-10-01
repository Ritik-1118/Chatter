import { signOut } from "@firebase/auth";
import { reducerCases } from "@/context/constants";
import { firebaseAuth } from "./firebase";
import { disconnectSocket } from "./socket";

// Profile shape kept in state.
export const toUserInfo = (u) => ({
    id: u.id ?? u._id,
    name: u.name,
    email: u.email,
    about: u.about ?? "",
    profilePicture: u.profilePicture,
    blockedUsers: u.blockedUsers ?? [],
});

// Clears everything belonging to the signed-in user before anyone else can sign in.
export async function endSession(dispatch) {
    disconnectSocket();
    dispatch({ type: reducerCases.RESET_SESSION });
    const auth = firebaseAuth();
    if (auth) await signOut(auth).catch(() => {});
}
