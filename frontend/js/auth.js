const loginView = document.getElementById("loginView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginNotice = document.getElementById("loginNotice");
const forgotPassword = document.getElementById("forgotPassword");
const passwordVisibility = document.getElementById("passwordVisibility");
const loginPassword = document.getElementById("loginPassword");
const rememberMe = document.getElementById("rememberMe");
const portalApp = document.getElementById("portalApp");
const logoutBtn = document.getElementById("logoutBtn");

const seededAccounts = [
  { username: "2026-00001", password: "Password123!", name: "Juan Dela Cruz", role: "Student", id: "2026-00001" },
  { username: "cashier", password: "Password123!", name: "COLM Cashier", role: "Cashier", id: "CASHIER-001" },
  { username: "registrar", password: "Password123!", name: "COLM Registrar", role: "Registrar", id: "REGISTRAR-001" },
  { username: "admin", password: "Password123!", name: "Portal Administrator", role: "Admin", id: "ADMIN-001" }
];

const pageRole = document.body.dataset.portalRole || "";

function rolePagePath(role) {
  return `${role.toLowerCase()}.html`;
}

function showPortal(account) {
  document.getElementById("portalBrandTitle").textContent = `${account.role.toUpperCase()} PORTAL`;
  document.getElementById("studentName").textContent = account.name;
  document.getElementById("studentRole").textContent = account.role;
  document.getElementById("profileName").textContent = account.name;
  document.getElementById("profileRole").textContent = account.role;
  document.getElementById("profileId").textContent = account.id;
  document.getElementById("welcomeName").textContent = account.name.split(" ")[0];
  loginView.hidden = true;
  portalApp.hidden = false;
}

const savedUsername = localStorage.getItem("colmPortalUser") || sessionStorage.getItem("colmPortalUser");
const savedAccount = seededAccounts.find(account => account.username === savedUsername);
if (savedAccount) {
  if (!pageRole || pageRole !== savedAccount.role) {
    window.location.replace(rolePagePath(savedAccount.role));
  } else {
    showPortal(savedAccount);
  }
} else {
  localStorage.removeItem("colmPortalUser");
  sessionStorage.removeItem("colmPortalUser");
  if (pageRole) window.location.replace("login.html");
}

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  const username = loginForm.elements.username.value.trim().toLowerCase();
  const password = loginForm.elements.password.value;
  const account = seededAccounts.find(user => user.username === username && user.password === password);

  if (!account) {
    loginNotice.textContent = "";
    loginError.textContent = "Incorrect username or password. Please try again.";
    return;
  }

  if (pageRole && pageRole !== account.role) {
    loginError.textContent = `This page is for ${pageRole}. Sign in with a ${pageRole} account.`;
    return;
  }

  if (rememberMe.checked) {
    localStorage.setItem("colmPortalUser", account.username);
    sessionStorage.removeItem("colmPortalUser");
  } else {
    localStorage.removeItem("colmPortalUser");
    sessionStorage.setItem("colmPortalUser", account.username);
  }
  loginNotice.textContent = "";
  loginError.textContent = "";
  if (!pageRole) {
    window.location.href = rolePagePath(account.role);
    return;
  }
  showPortal(account);
});

forgotPassword.addEventListener("click", () => {
  loginNotice.textContent = "For password reset, contact the COLM Registrar.";
});

passwordVisibility.addEventListener("click", () => {
  const isPasswordHidden = loginPassword.type === "password";
  loginPassword.type = isPasswordHidden ? "text" : "password";
  passwordVisibility.textContent = isPasswordHidden ? "visibility_off" : "visibility";
  passwordVisibility.setAttribute("aria-label", isPasswordHidden ? "Hide password" : "Show password");
});

logoutBtn?.addEventListener("click", event => {
  event.stopPropagation();
  localStorage.removeItem("colmPortalUser");
  sessionStorage.removeItem("colmPortalUser");
  if (pageRole) {
    window.location.href = "login.html";
    return;
  }
  portalApp.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
  loginPassword.type = "password";
  passwordVisibility.textContent = "visibility";
  passwordVisibility.setAttribute("aria-label", "Show password");
  loginError.textContent = "";
  loginNotice.textContent = "";
});