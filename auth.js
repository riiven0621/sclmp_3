import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app-check.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";
import { firebaseAppCheckSiteKey, firebaseAIModel, firebaseConfig } from "./firebase-config.js?v=20261126-2";
import { mountScheduleAssistant } from "./schedule-assistant.js";

const $ = selector => document.querySelector(selector);
const authView = $("#authView");
const visitorView = $("#visitorView");
const appView = $("#appView");
const authMessage = $("#authMessage");
const visitorMessage = $("#visitorMessage");
const entryForm = $("#entryForm");
const entryOverlay = $("#entryOverlay");
const entryList = $("#entryList");
const datePicker = $("#datePicker");
const localDateKey = date => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

let auth;
let db;
let currentUser = null;
let scheduleAssistant = null;
let selectedDate = localDateKey(new Date());
let visibleEntries = [];
let stopWatchingEntries = null;
let toastTimer = null;

function setNotice(element, text, kind = "error") {
  element.textContent = text;
  element.className = `notice ${kind}`;
}

function clearNotice(element) {
  element.textContent = "";
  element.className = "notice hidden";
}

function showView(view) {
  authView.classList.toggle("hidden", view !== "auth");
  visitorView.classList.toggle("hidden", view !== "visitor");
  appView.classList.toggle("hidden", view !== "app");
}

function explainAuthError(error, target = authMessage) {
  const code = error?.code || "";
  if (code === "auth/operation-not-allowed") {
    setNotice(target, "這種登入方式尚未在 Firebase 啟用。請確認 Google 與匿名登入提供者已開啟。");
  } else if (code === "auth/popup-blocked") {
    setNotice(target, "瀏覽器封鎖了登入視窗。請允許彈出式視窗後再試一次。");
  } else if (code === "auth/unauthorized-domain") {
    setNotice(target, "目前網址尚未加入 Firebase 授權網域。請在 Firebase Authentication 的授權網域加入 riiven0621.github.io。");
  } else if (/requests-from-referer|referer.*blocked|referrer.*blocked/i.test(error?.message || "")) {
    setNotice(target, "Firebase API Key 尚未允許這個網址來源。請確認 HTTP 參照網址限制包含 https://riiven0621.github.io/*。");
  } else {
    console.error("Authentication error", error);
    setNotice(target, `登入失敗：${error?.message || "請檢查網路或 Firebase 設定。"}`);
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "long" }).format(date);
}

function updateDateHeader() {
  const today = localDateKey(new Date());
  const delta = Math.round((new Date(`${selectedDate}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
  $("#dateHeading").textContent = delta === 0 ? "今天" : formatDateLabel(selectedDate);
  $("#dateSubline").textContent = delta === 0
    ? "把重要的事，一件一件收進今天。"
    : delta < 0 ? `${Math.abs(delta)} 天前的安排` : `還有 ${delta} 天，可以先準備。`;
  datePicker.value = selectedDate;
}

function updateSummary() {
  const completed = visibleEntries.filter(entry => entry.done).length;
  const pending = visibleEntries.length - completed;
  $("#openCount").textContent = `${pending} 件`;
  $("#doneCount").textContent = `${completed} 件`;
  $("#summaryMessage").textContent = !visibleEntries.length
    ? "今天還沒有安排，留一點空白也很好。"
    : pending === 0 ? "今天的安排都完成了，做得很好。"
      : completed ? `已完成 ${completed} 件，還有 ${pending} 件，照自己的步調來。`
        : "慢慢來，先從一件重要的事開始。";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function renderEntries() {
  updateSummary();
  if (!visibleEntries.length) {
    entryList.innerHTML = '<div class="empty"><strong>這一天還沒有行程</strong>新增一件小事，替今天留下一個方向。</div>';
    return;
  }
  const sorted = [...visibleEntries].sort((first, second) => {
    if (!first.time) return second.time ? 1 : 0;
    if (!second.time) return -1;
    return first.time.localeCompare(second.time);
  });
  entryList.innerHTML = sorted.map(entry => `
    <article class="entry ${entry.done ? "done" : ""}" data-id="${escapeHtml(entry.id)}">
      <button class="entry-check" type="button" data-action="toggle" aria-label="${entry.done ? "取消完成" : "標記完成"}">${entry.done ? "✓" : ""}</button>
      <span class="entry-time ${entry.time ? "" : "untimed"}">${entry.time || "未定"}</span>
      <div class="entry-body"><div class="entry-title">${escapeHtml(entry.title)}</div>${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ""}</div>
      <div class="entry-actions"><button type="button" data-action="edit">編輯</button><button type="button" data-action="delete">刪除</button></div>
    </article>`).join("");
}

function watchSelectedDate() {
  if (stopWatchingEntries) stopWatchingEntries();
  if (!currentUser || currentUser.isAnonymous) return;
  entryList.innerHTML = '<div class="loader">正在載入行程…</div>';
  const entries = collection(db, "users", currentUser.uid, "entries");
  const selectedQuery = query(entries, where("date", "==", selectedDate));
  stopWatchingEntries = onSnapshot(selectedQuery, snapshot => {
    visibleEntries = snapshot.docs.map(entryDoc => ({ id: entryDoc.id, ...entryDoc.data() }));
    renderEntries();
  }, error => {
    console.error("Loading entries failed", error);
    entryList.innerHTML = '<div class="empty"><strong>行程暫時無法載入</strong>請確認 Firestore 資料庫已建立，且安全規則已發布。</div>';
    showToast("讀取行程失敗，請稍後再試。");
  });
}

function enterApp(user) {
  currentUser = user;
  showView("app");
  $("#accountLabel").textContent = user.displayName || user.email || "已登入帳號";
  updateDateHeader();
  watchSelectedDate();
}

function enterVisitor() {
  currentUser = auth.currentUser;
  if (stopWatchingEntries) stopWatchingEntries();
  visibleEntries = [];
  clearNotice(visitorMessage);
  showView("visitor");
}

function openEntryForm(entry = null) {
  entryForm.reset();
  $("#entryId").value = entry?.id || "";
  $("#formHeading").textContent = entry ? "編輯事項" : "新增事項";
  $("#entryTitle").value = entry?.title || "";
  $("#entryDate").value = entry?.date || selectedDate;
  $("#entryTime").value = entry?.time || "";
  $("#entryNote").value = entry?.note || "";
  $("#saveEntry").disabled = false;
  entryOverlay.classList.add("open");
  $("#entryTitle").focus();
}

function closeEntryForm() {
  entryOverlay.classList.remove("open");
}

async function runGoogleSignIn(target = authMessage) {
  clearNotice(target);
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    explainAuthError(error, target);
  }
}

async function requireGoogleUser() {
  if (!currentUser || currentUser.isAnonymous) {
    throw new Error("請先使用 Google 帳號登入。");
  }
  return currentUser;
}

$("#googleSignIn").addEventListener("click", () => runGoogleSignIn());
$("#visitorGoogleSignIn").addEventListener("click", () => runGoogleSignIn(visitorMessage));
$("#guestSignIn").addEventListener("click", async () => {
  clearNotice(authMessage);
  try {
    await signInAnonymously(auth);
  } catch (error) {
    explainAuthError(error);
  }
});
$("#signOutVisitor").addEventListener("click", () => signOut(auth).catch(error => explainAuthError(error, visitorMessage)));
$("#signOut").addEventListener("click", () => signOut(auth).catch(error => showToast(`登出失敗：${error.message}`)));

$("#addEntry").addEventListener("click", () => openEntryForm());
$("#prevDate").addEventListener("click", () => {
  const date = new Date(`${selectedDate}T00:00:00`);
  date.setDate(date.getDate() - 1);
  selectedDate = localDateKey(date);
  updateDateHeader();
  watchSelectedDate();
});
$("#nextDate").addEventListener("click", () => {
  const date = new Date(`${selectedDate}T00:00:00`);
  date.setDate(date.getDate() + 1);
  selectedDate = localDateKey(date);
  updateDateHeader();
  watchSelectedDate();
});
$("#todayButton").addEventListener("click", () => {
  selectedDate = localDateKey(new Date());
  updateDateHeader();
  watchSelectedDate();
});
datePicker.addEventListener("change", () => {
  if (!datePicker.value) return;
  selectedDate = datePicker.value;
  updateDateHeader();
  watchSelectedDate();
});

document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", closeEntryForm));
entryOverlay.addEventListener("click", event => {
  if (event.target === entryOverlay) closeEntryForm();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeEntryForm();
});

entryForm.addEventListener("submit", async event => {
  event.preventDefault();
  const saveButton = $("#saveEntry");
  saveButton.disabled = true;
  const id = $("#entryId").value;
  const entry = {
    title: $("#entryTitle").value.trim(),
    date: $("#entryDate").value,
    time: $("#entryTime").value,
    note: $("#entryNote").value.trim(),
    done: id ? Boolean(visibleEntries.find(item => item.id === id)?.done) : false,
    updatedAt: serverTimestamp()
  };
  try {
    const user = await requireGoogleUser();
    const entries = collection(db, "users", user.uid, "entries");
    if (id) {
      const old = visibleEntries.find(item => item.id === id);
      await updateDoc(doc(entries, id), { ...entry, createdAt: old.createdAt });
      showToast("事項已更新。");
    } else {
      await addDoc(entries, { ...entry, createdAt: serverTimestamp() });
      showToast("事項已儲存到你的行程。");
    }
    selectedDate = entry.date;
    closeEntryForm();
    updateDateHeader();
    watchSelectedDate();
  } catch (error) {
    console.error("Saving entry failed", error);
    showToast(error.code === "permission-denied" ? "資料庫安全規則拒絕了這項操作。" : `儲存失敗：${error.message}`);
  } finally {
    saveButton.disabled = false;
  }
});

entryList.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const row = button.closest("[data-id]");
  const entry = visibleEntries.find(item => item.id === row?.dataset.id);
  if (!entry) return;
  try {
    const user = await requireGoogleUser();
    const reference = doc(db, "users", user.uid, "entries", entry.id);
    if (button.dataset.action === "edit") {
      openEntryForm(entry);
    } else if (button.dataset.action === "toggle") {
      await updateDoc(reference, { done: !entry.done, updatedAt: serverTimestamp() });
    } else if (button.dataset.action === "delete" && window.confirm(`確定刪除「${entry.title}」嗎？`)) {
      await deleteDoc(reference);
      showToast("事項已刪除。");
    }
  } catch (error) {
    console.error("Updating entry failed", error);
    showToast(error.code === "permission-denied" ? "資料庫安全規則拒絕了這項操作。" : `操作失敗：${error.message}`);
  }
});

const hasWebConfig = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("REPLACE_")
  && firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("REPLACE_")
  && firebaseConfig.appId && !firebaseConfig.appId.startsWith("REPLACE_");

if (!hasWebConfig) {
  setNotice(authMessage, "尚未設定新 Firebase 專案的網頁應用程式資訊。", "error");
} else {
  try {
    const app = initializeApp(firebaseConfig);
    let appCheckReady = false;
    if (firebaseAppCheckSiteKey) {
      try {
        initializeAppCheck(app, {
          provider: new ReCaptchaEnterpriseProvider(firebaseAppCheckSiteKey),
          isTokenAutoRefreshEnabled: true
        });
        appCheckReady = true;
      } catch (error) {
        console.error("Firebase App Check initialization failed", error);
      }
    }
    auth = getAuth(app);
    db = getFirestore(app);
    scheduleAssistant = mountScheduleAssistant({
      app,
      db,
      modelName: firebaseAIModel,
      appCheckReady: () => appCheckReady,
      getCurrentUser: () => currentUser,
      onScheduleChanged: date => {
        if (date) selectedDate = date;
        updateDateHeader();
        watchSelectedDate();
      }
    });
    onAuthStateChanged(auth, user => {
      if (!user) {
        scheduleAssistant?.setUser(null);
        if (stopWatchingEntries) stopWatchingEntries();
        currentUser = null;
        visibleEntries = [];
        showView("auth");
      } else if (user.isAnonymous) {
        scheduleAssistant?.setUser(null);
        enterVisitor();
      } else {
        scheduleAssistant?.setUser(user);
        enterApp(user);
      }
    }, error => {
      console.error("Auth state listener failed", error);
      showView("auth");
      setNotice(authMessage, `Firebase 驗證服務無法啟動：${error.message}`);
    });
  } catch (error) {
    console.error("Firebase initialization failed", error);
    setNotice(authMessage, `Firebase 初始化失敗：${error.message}`);
  }
}

updateDateHeader();

