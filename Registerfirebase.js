import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

/* 🔽 ADDED: Firestore import (AS REQUESTED) */
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBERjheukFQoN3K8Gi3jzv3Tmh9hnYz6mo",
    authDomain: "paulivbook.firebaseapp.com",
    projectId: "paulivbook",
    storageBucket: "paulivbook.firebasestorage.app",
    messagingSenderId: "413150157712",
    appId: "1:413150157712:web:76676d39bc36cde0ea3115",
    measurementId: "G-MVSX75BD6M",
    databaseURL: "https://paulivbook-default-rtdb.asia-southeast1.firebasedatabase.app"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app); // Firebase Authentication
const db = getDatabase(app); // Firebase Realtime Database

/* 🔽 ADDED: Firestore initialization */
const firestore = getFirestore(app);

const submitButton = document.getElementById("submit");

submitButton.addEventListener("click", async (event) => {
  event.preventDefault();

  // Get values from the form fields
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // Validate form fields
  if (username && email && password) {
    try {
      // First, create the user with email and password using Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Now, store the user data (username and email) in Firebase Realtime Database
      const userRef = ref(db, 'users/' + user.uid);  // Use the user's UID as the key
      await set(userRef, {
        username: username,
        email: email
      });

      /* 🔽 ADDED: Store same data in Firestore */
      await setDoc(doc(firestore, "users", user.uid), {
        username: username,
        email: email
      });

      window.location.href="Home.html";

    } catch (error) {
      console.error("Error during sign-up:", error);
      alert("Error during registration: " + error.message);
    }
  } else {
    alert("Please fill in all fields.");
  }
});
