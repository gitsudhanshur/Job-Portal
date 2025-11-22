// ✅ Import Firebase v9 Modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvIWc3SUO63tGG25pE_sTiYL5bTEnIDlk",
  authDomain: "job-portal-701ee.firebaseapp.com",
  projectId: "job-portal-701ee",
  storageBucket: "job-portal-701ee.appspot.com", // 🔥 FIXED
  messagingSenderId: "196370777827",
  appId: "1:196370777827:web:e2120018a1dc050d70e7d6",
  measurementId: "G-C2XLHGZND9"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export { ref, uploadBytes, getDownloadURL };
