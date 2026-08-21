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

// Ekspor instance dan metode ke objek global (window)
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

// Listener status login Firebase
window.fbOnAuth(window.auth, (user) => {
  window.currentUser = user;
  
  const loginMenuItem = document.getElementById('menuLoginBtn');
  const dashboardMenuItem = document.getElementById('menuDashboardBtn');

  if (user) {
    // 1. Jika User Sudah Login
    if (loginMenuItem) {
      const name = user.displayName ? user.displayName.split(' ')[0] : 'User';
      loginMenuItem.innerHTML = `🚪 Logout (${name})`;
    }
    // Tampilkan Menu Dashboard
    if (dashboardMenuItem) {
      dashboardMenuItem.style.display = 'flex';
    }
  } else {
    // 2. Jika User Belum Login / Logout
    if (loginMenuItem) {
      loginMenuItem.innerHTML = `🔑 Login dengan Google`;
    }
    // Sembunyikan Menu Dashboard
    if (dashboardMenuItem) {
      dashboardMenuItem.style.display = 'none';
    }
  }

  // Muat/Render Ulang Riwayat Menonton
  if (typeof window.renderContinueWatching === 'function') {
    window.renderContinueWatching();
  }
});
