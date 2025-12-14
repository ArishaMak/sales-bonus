import { initDashboard } from "./modules/dashboard.js";

const root = document.getElementById("app");

// Хардкод или получение userId из auth
const CURRENT_USER_ID = 1; 

export function navigate(path) {
    window.history.pushState({}, "", path);
    renderRoute(path);
}

export function renderRoute(path) {
    if (path.startsWith("/dashboard")) {
        return initDashboard(CURRENT_USER_ID, root);
    }

    // fallback — главная страница
    root.innerHTML = `<h1>Главная</h1>`;
}

window.addEventListener("popstate", () => renderRoute(window.location.pathname));
