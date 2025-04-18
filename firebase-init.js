// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration (consider moving to a secure place later)
const firebaseConfig = {
  apiKey: "AIzaSyBryQ92Qu9VpKyU18mO91LWps2gYowQ1G4",
  authDomain: "rell-66fd5.firebaseapp.com",
  databaseURL: "https://rell-66fd5-default-rtdb.firebaseio.com", // Can be removed if only using Firestore
  projectId: "rell-66fd5",
  storageBucket: "rell-66fd5.appspot.com", // Corrected storage bucket domain
  messagingSenderId: "485436015393",
  appId: "1:485436015393:web:5e472f0d0e3e33be4d7460"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore and get references to the services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Export the instances for use in other modules
export { app, auth, db, storage }; 