import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Kredensial Firebase Proyek Anda
const firebaseConfig = {
  apiKey: "AIzaSyC0fPxoN63hX6QsXnCet-xXhLhOLkUnWS4",
  authDomain: "donghu-91808.firebaseapp.com",
  databaseURL: "https://donghu-91808-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "donghu-91808",
  storageBucket: "donghu-91808.firebasestorage.app",
  messagingSenderId: "181024131291",
  appId: "1:181024131291:web:4c3cca5e5e0eda475a24fe",
  measurementId: "G-QFQ77XRGQ8"
};

// Inisialisasi Firebase App
const app = initializeApp(firebaseConfig);

// Ekspor instance dan metode ke objek global (window) agar bisa dipanggil dari HTML manapun
window.db = getDatabase(app);
window.auth = getAuth(app);
window.googleProvider = new GoogleAuthProvider();
window.fbRef = ref;
window.fbGet = get;
window.fbSet = set;
window.fbTransaction = runTransaction;
window.fbSignIn = signInWithPopup;
window.fbSignOut = signOut;
window.fbOnAuth = onAuthStateChanged;

window.currentUser = null;

// Listener global status autentikasi user
window.fbOnAuth(window.auth, (user) => {
  window.currentUser = user;
  const loginBtn = document.getElementById('loginBtnText');
  const userAvatar = document.getElementById('userAvatar');
  
  if (user) {
    if (loginBtn) loginBtn.innerText = user.displayName ? user.displayName.split(' ')[0] : 'User';
    if (userAvatar) {
      userAvatar.src = user.photoURL || 'https://via.placeholder.com/32';
      userAvatar.style.display = 'block';
    }
  } else {
    if (loginBtn) loginBtn.innerText = 'Login';
    if (userAvatar) userAvatar.style.display = 'none';
  }

  // Jika fungsi renderContinueWatching tersedia di halaman saat ini, panggil otomatis
  if (typeof window.renderContinueWatching === 'function') {
    window.renderContinueWatching();
  }
});
