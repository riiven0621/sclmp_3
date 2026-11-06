import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

// Firebase Console Web SDK config; the API key is intentionally public client config.\nconst firebaseConfig = {
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

const configured = Object.values(firebaseConfig).every(value => value && !value.startsWith("YOUR_") && !value.includes("請貼上"));
if (!configured) {
  showGate("Firebase API Key 尚未設定或無效。", "請到 Google Cloud Console → APIs & Services → Credentials，取得屬於 Firebase 專案 sclmp3 且允許 Identity Toolkit API 的 Web API Key，再填入 auth.js 的 apiKey。");
  for (const button of loginButtons) button.addEventListener("click", () => showGate("Firebase API Key 尚未設定或無效。", "請先設定有效的 Web API Key，並確認該 key 未限制 Firebase Authentication 使用的 Identity Toolkit API。"));
} else {
  const auth = getAuth(initializeApp(firebaseConfig));
  const provider = new GoogleAuthProvider();
  async function login() {
    for (const button of loginButtons) button.disabled = true;
    showGate("正在連接 Google…", "請在開啟的 Google 視窗完成登入。");
    try { await signInWithPopup(auth, provider); }
    catch (error) {
      console.error("Google sign-in failed", error);
      const text = error.code === "auth/unauthorized-domain" ? "此網站網域尚未加入 Firebase Authentication 的 Authorized domains。"
        : error.code === "auth/popup-blocked" ? "登入視窗遭瀏覽器封鎖，請允許此網站開啟彈出式視窗後再試。"
        : `Google 登入失敗：${error.message}`;
      showGate(text, "登入成功後即可使用行程與任務。");
    } finally { for (const button of loginButtons) button.disabled = false; }
  }
  for (const button of loginButtons) button.addEventListener("click", login);
  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try { await signOut(auth); }
    catch (error) { console.error("Sign-out failed", error); alert(`登出失敗：${error.message}`); }
    finally { logoutButton.disabled = false; }
  });
  onAuthStateChanged(auth, user => {
    if (user) showApp(user);
    else { topLogin.hidden = true; logoutButton.hidden = true; userLabel.hidden = true; showGate("請使用 Google 帳號登入，開始使用你的行程與任務。"); }
  }, error => {
    console.error("Firebase auth state failed", error);
    showGate("無法連線到登入服務。", "請確認 Firebase 設定及網路連線後重新載入頁面。");
  });
}

