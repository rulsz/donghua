import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, remove, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

const app = initializeApp(firebaseConfig);

window.db = getDatabase(app);
window.auth = getAuth(app);
window.fbRef = ref;
window.fbGet = get;
window.fbSet = set;
window.fbRemove = remove;
window.fbTransaction = runTransaction;
window.fbSignIn = signInWithEmailAndPassword;
window.fbSignUp = createUserWithEmailAndPassword;
window.fbSignOut = signOut;
window.fbOnAuth = onAuthStateChanged;
window.fbUpdateProfile = updateProfile;
window.fbUpdatePassword = updatePassword;

window.currentUser = null;

// Listener status login
window.fbOnAuth(window.auth, (user) => {
  window.currentUser = user;
  
  const loginMenuItem = document.getElementById('menuLoginBtn');
  const dashboardMenuItem = document.getElementById('menuDashboardBtn');

  if (user) {
    if (loginMenuItem) {
      const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
      loginMenuItem.innerHTML = `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Keluar (${displayName})`;
    }
    if (dashboardMenuItem) dashboardMenuItem.style.display = 'flex';
  } else {
    if (loginMenuItem) {
      loginMenuItem.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Masuk / Daftar`;
    }
    if (dashboardMenuItem) dashboardMenuItem.style.display = 'none';
  }

  if (typeof window.renderContinueWatching === 'function') {
    window.renderContinueWatching();
  }
  if (typeof window.updateCommentAuthUI === 'function') {
    window.updateCommentAuthUI();
  }
});
