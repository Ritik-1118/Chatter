import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import { firebaseAuth } from "@/utils/FirebaseConfig";
import { setAxiosAuthToken } from "@/utils/authHeaders";
import { CHECK_USER_ROUTE } from "@/utils/ApiRoutes";
import { reducerCases } from "@/context/constants";

// Bootstraps auth: verifies Firebase session, hydrates user info, and redirects to login when missing.
const useAuthBootstrap = (dispatch, userInfo, router) => {
  const [redirectLogin, setRedirectLogin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      if (!currentUser) {
        setRedirectLogin(true);
        return;
      }

      if (!userInfo && currentUser.email) {
        await setAxiosAuthToken();
        const { data } = await axios.post(CHECK_USER_ROUTE, { email: currentUser.email });
        if (!data.status) {
          setRedirectLogin(true);
          return;
        }
        if (data?.data) {
          const { _id, name, email, profilePicture: profileImage, status } = data.data;
          dispatch({
            type: reducerCases.SET_USER_INFO,
            userInfo: { id: _id, name, email, profileImage, status },
          });
        }
      }
    });

    return () => unsubscribe();
  }, [dispatch, userInfo]);

  useEffect(() => {
    if (redirectLogin) router.push("/login");
  }, [redirectLogin, router]);

  return redirectLogin;
};

export default useAuthBootstrap;
