import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

// Firebase Console > Project settings > Your apps > Web app: paste the Web app config below.
// Enable Authentication > Sign-in method > Google and add your Pages domain to Authorized domains.
const firebaseConfig = {
  apiKey: "AIzaSyBkcNHxpnn7_GztYbXHR78qsiw-wVwQfP",
  authDomain: "sclmp3.firebaseapp.com",
  projectId: "sclmp3",
  appId: "1:261621121155:web:5dabf02088072ab4915bb6"
};

const gate = document.querySelector("#authGate");
const appShell = document.querySelector("#appShell");
const message = document.querySelector("#authMessage");
const hint = document.querySelector("#authHint");
const gateButton = document.querySelector("#gateGoogleLogin");
const topLogin = document.querySelector("#googleLogin");
const logoutButton = document.querySelector("#googleLogout");
const userLabel = document.querySelector("#authUser");
const loginButtons = [gateButton, topLogin].filter(Boolean);

function showGate(text, helper = "登入後即可使用個人行程清單與寵物夥伴。") {
  gate.hidden = false;
  appShell.hidden = true;
  message.textContent = text;
  hint.textContent = helper;
}

function showApp(user) {
  gate.hidden = true;
  appShell.hidden = false;
  topLogin.hidden = true;
  logoutButton.hidden = false;
  userLabel.hidden = false;
  userLabel.textContent = user.displayName || user.email || "已登入";
  userLabel.title = user.email || "";
}

const configured = Object.values(firebaseConfig).every(value => value && !value.startsWith("YOUR_"));
if (!configured) {
  showGate("Google 登入尚未完成設定。", "請在 auth.js 填入 Firebase Web App 設定，並於 Firebase Console 啟用 Google 登入。");
  for (const button of loginButtons) button.addEventListener("click", () => showGate("Google 登入尚未完成設定。", "請先設定 Firebase Web App，啟用 Google 登入提供者，並加入網站網域。"));
} else {
  const auth = getAuth(initializeApp(firebaseConfig));
  const provider = new GoogleAuthProvider();

  async function login() {
    for (const button of loginButtons) button.disabled = true;
    showGate("正在連接 Google…", "請在開啟的 Google 視窗完成登入。");
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google sign-in failed", error);
      const text = error.code === "auth/unauthorized-domain"
        ? "此網站網域尚未加入 Firebase Authentication 的 Authorized domains。"
        : error.code === "auth/popup-blocked"
          ? "登入視窗遭瀏覽器封鎖，請允許此網站開啟彈出式視窗後再試。"
          : `Google 登入失敗：${error.message}`;
      showGate(text, "登入成功後即可使用行程與任務。");
    } finally {
      for (const button of loginButtons) button.disabled = false;
    }
  }

  for (const button of loginButtons) button.addEventListener("click", login);
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign-out failed", error);
      alert(`登出失敗：${error.message}`);
    } finally {
      logoutButton.disabled = false;
    }
  });

  onAuthStateChanged(auth, user => {
    if (user) showApp(user);
    else {
      topLogin.hidden = true;
      logoutButton.hidden = true;
      userLabel.hidden = true;
      showGate("請使用 Google 帳號登入，開始使用你的行程與任務。");
    }
  }, error => {
    console.error("Firebase auth state failed", error);
    showGate("無法連線到登入服務。", "請確認 Firebase 設定及網路連線後重新載入頁面。");
  });
}
