const sidebar = document.getElementById("sidebar");
const main = document.querySelector(".main");
const collapseBtn = document.getElementById("collapseBtn");
const mobileSidebarBtn = document.getElementById("mobileSidebarBtn");
const pageTitle = document.getElementById("pageTitle");
const pageIcon = document.getElementById("pageIcon");
const sidebarIcon = document.getElementById("sidebarIcon");
const mobileSidebarIcon = document.getElementById("mobileSidebarIcon");
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
const content = document.getElementById("content");

const pageSections = {
  "Dashboard": document.querySelector(".dashboard"),
  "Overview & KPIs": document.querySelector(".dashboard"),
  "Document Catalog": document.querySelector(".catalog"),
  "My Requests": document.querySelector(".requests"),
  "All Requests": document.querySelector(".requests"),
  "Organizational Chart": document.querySelector(".org-chart"),
  "Org Chart": document.querySelector(".org-chart")
};
const registrarPlaceholder = document.querySelector(".registrar-placeholder");
const registrarPlaceholderTitle = document.getElementById("registrarPlaceholderTitle");
const registrarPlaceholderPages = new Set(["Students Directory", "CSV Bulk Import", "Official Reports", "Audit Logs"]);

function showPage(name) {
  content.classList.toggle("content-page-bg", ["Document Catalog", "My Requests", "All Requests"].includes(name));
  new Set(Object.values(pageSections).filter(Boolean)).forEach(section => { section.hidden = true; });
  if (pageSections[name]) pageSections[name].hidden = false;

  if (registrarPlaceholder) {
    registrarPlaceholder.hidden = !registrarPlaceholderPages.has(name);
    if (!registrarPlaceholder.hidden) registrarPlaceholderTitle.textContent = name;
  }
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
  "Overview & KPIs": "home",
  "Document Catalog": "description",
  "My Requests": "assignment_turned_in",
  "All Requests": "assignment",
  "Organizational Chart": "account_tree",
  "Org Chart": "account_tree",
  "Students Directory": "groups",
  "CSV Bulk Import": "upload",
  "Official Reports": "analytics",
  "Audit Logs": "verified_user",
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
  mobileSidebarIcon.textContent = sidebar.classList.contains("open") ? "left_panel_close" : "left_panel_open";
}

updateSidebarIcon();
window.addEventListener("resize", updateSidebarIcon);

function toggleSidebar() {
  if (window.innerWidth <= 800) {
    sidebar.classList.toggle("open");
    sidebarBackdrop.classList.toggle("show");
  } else {
    sidebar.classList.toggle("collapsed");
    main.classList.toggle("expanded");
  }
  updateSidebarIcon();
}

collapseBtn.addEventListener("click", toggleSidebar);
mobileSidebarBtn.addEventListener("click", toggleSidebar);

sidebarBackdrop.addEventListener("click", () => {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.remove("show");
  updateSidebarIcon();
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
      updateSidebarIcon();
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