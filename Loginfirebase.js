import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-analytics.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyBERjheukFQoN3K8Gi3jzv3Tmh9hnYz6mo",
    authDomain: "paulivbook.firebaseapp.com",
    projectId: "paulivbook",
    storageBucket: "paulivbook.firebasestorage.app",
    messagingSenderId: "413150157712",
    appId: "1:413150157712:web:76676d39bc36cde0ea3115",
    measurementId: "G-MVSX75BD6M"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
  const auth = getAuth(app); // REQUIRED

  const submit = document.getElementById("submit");

submit.addEventListener("click", (event) => {
  event.preventDefault()
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      alert("Welcome...");
      window.location.href = "Home.html";
    })
    .catch((error) => {
      alert(error.message);
    });
});