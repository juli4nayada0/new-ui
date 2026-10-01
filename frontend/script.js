const sidebar = document.getElementById("sidebar");
const main = document.querySelector(".main");
const collapseBtn = document.getElementById("collapseBtn");
const pageTitle = document.getElementById("pageTitle");
const pageIcon = document.getElementById("pageIcon");
const sidebarIcon = document.getElementById("sidebarIcon");
const navItems = document.querySelectorAll(".nav-item");
const profileMenu = document.getElementById("profileMenu");
const profileDropdown = document.getElementById("profileDropdown");
const themeBtn = document.getElementById("themeBtn");
const themeIcon = document.getElementById("themeIcon");
const searchControl = document.getElementById("searchControl");
const searchToggle = document.getElementById("searchToggle");
const searchInput = document.getElementById("searchInput");
const dashboardDate = document.getElementById("dashboardDate");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const loginView = document.getElementById("loginView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const loginNotice = document.getElementById("loginNotice");
const forgotPassword = document.getElementById("forgotPassword");
const passwordVisibility = document.getElementById("passwordVisibility");
const loginPassword = document.getElementById("loginPassword");
const portalApp = document.getElementById("portalApp");
const logoutBtn = document.getElementById("logoutBtn");

const seededAccounts = [
  { username: "2026-00001", password: "Password123!", name: "Juan Dela Cruz", role: "Student", id: "2026-00001" },
  { username: "cashier", password: "Password123!", name: "COLM Cashier", role: "Cashier", id: "CASHIER-001" },
  { username: "registrar", password: "Password123!", name: "COLM Registrar", role: "Registrar", id: "REGISTRAR-001" },
  { username: "admin", password: "Password123!", name: "Portal Administrator", role: "Admin", id: "ADMIN-001" }
];

function showPortal(account) {
  document.getElementById("studentName").textContent = account.name;
  document.getElementById("studentRole").textContent = account.role;
  document.getElementById("profileName").textContent = account.name;
  document.getElementById("profileRole").textContent = account.role;
  document.getElementById("profileId").textContent = account.id;
  document.getElementById("welcomeName").textContent = account.name.split(" ")[0];
  loginView.hidden = true;
  portalApp.hidden = false;
}

const savedUsername = sessionStorage.getItem("colmPortalUser");
const savedAccount = seededAccounts.find(account => account.username === savedUsername);
if (savedAccount) {
  showPortal(savedAccount);
} else {
  sessionStorage.removeItem("colmPortalUser");
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

  sessionStorage.setItem("colmPortalUser", account.username);
  loginNotice.textContent = "";
  loginError.textContent = "";
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

logoutBtn.addEventListener("click", event => {
  event.stopPropagation();
  sessionStorage.removeItem("colmPortalUser");
  portalApp.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
  loginPassword.type = "password";
  passwordVisibility.textContent = "visibility";
  passwordVisibility.setAttribute("aria-label", "Show password");
  loginError.textContent = "";
  loginNotice.textContent = "";
});

const pageSections = {
  "Dashboard": document.querySelector(".dashboard"),
  "Document Catalog": document.querySelector(".catalog"),
  "My Requests": document.querySelector(".requests"),
  "Organizational Chart": document.querySelector(".org-chart")
};

function showPage(name) {
  Object.entries(pageSections).forEach(([pageName, el]) => {
    if (el) el.hidden = pageName !== name;
  });
}

themeIcon.textContent = document.body.classList.contains("dark") ? "light_mode" : "dark_mode";
dashboardDate.textContent = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric"
}).format(new Date());

const pageIcons = {
  Dashboard: "dashboard",
  "Document Catalog": "description",
  "My Requests": "assignment_turned_in",
  "Organizational Chart": "account_tree",
  FAQs: "quiz",
  "Help Center": "support_agent",
  "Contact Registrar": "mail",
  Settings: "settings"
};

function updateSidebarIcon() {
  const isOpen = window.innerWidth <= 800
    ? sidebar.classList.contains("open")
    : !sidebar.classList.contains("collapsed");
  sidebarIcon.textContent = isOpen ? "left_panel_close" : "left_panel_open";
}

updateSidebarIcon();
window.addEventListener("resize", updateSidebarIcon);

collapseBtn.addEventListener("click", () => {
  if (window.innerWidth <= 800) {
    sidebar.classList.toggle("open");
    sidebarBackdrop.classList.toggle("show");
  } else {
    sidebar.classList.toggle("collapsed");
    main.classList.toggle("expanded");
  }
  updateSidebarIcon();
});

sidebarBackdrop.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.remove("show");
});

navItems.forEach(item => {
  item.addEventListener("click", e => {
    e.preventDefault();
    navItems.forEach(i => i.classList.remove("active"));
    item.classList.add("active");
    pageTitle.textContent = item.dataset.page;
    pageIcon.textContent = pageIcons[item.dataset.page];
    showPage(item.dataset.page);

    if (window.innerWidth <= 800) {
      sidebar.classList.remove("open");
      sidebarBackdrop.classList.remove("show");
    }
  });
});

document.querySelectorAll("[data-page-action]").forEach(action => {
  action.addEventListener("click", e => {
    e.preventDefault();
    const destination = Array.from(navItems).find(item => item.dataset.page === action.dataset.pageAction);
    destination?.click();
  });
});

profileMenu.addEventListener("click", e => {
  e.stopPropagation();
  profileDropdown.classList.toggle("show");
});

document.addEventListener("click", () => {
  profileDropdown.classList.remove("show");
});

function setSearchOpen(isOpen) {
  searchControl.classList.toggle("open", isOpen);
  searchToggle.setAttribute("aria-expanded", String(isOpen));
  searchToggle.setAttribute("aria-label", isOpen ? "Close search" : "Open search");
  searchInput.hidden = !isOpen;

  if (isOpen) {
    searchInput.focus();
  }
}

searchToggle.addEventListener("click", () => {
  setSearchOpen(!searchControl.classList.contains("open"));
});

document.addEventListener("click", e => {
  if (!searchControl.contains(e.target)) {
    setSearchOpen(false);
  }
});

searchInput.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    setSearchOpen(false);
    searchToggle.focus();
  }
});

themeBtn.addEventListener("click", e => {
  e.stopPropagation();
  document.body.classList.toggle("dark");
  themeIcon.textContent = document.body.classList.contains("dark") ? "light_mode" : "dark_mode";
});

searchInput.addEventListener("input", () => {
  // Ready for connecting to your real search functionality.
  console.log("Search:", searchInput.value);
});