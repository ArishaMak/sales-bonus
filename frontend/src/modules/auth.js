export async function registerUser() {
    const email = document.getElementById("regEmail").value;
    const pass = document.getElementById("regPassword").value;
    const name = document.getElementById("regName").value; // Добавлено для name

    const r = await fetch("/api/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email, password: pass, name })
    });

    const data = await r.json();

    if (!r.ok) {
        alert("Ошибка регистрации: " + data.error);
        return;
    }

    localStorage.setItem("userId", data.user.id); // data.user.id из ответа сервера
    window.location.href = "/dashboard.html"; // Исправлено на .html
}

export async function loginUser({ email, password }) {
    try {
        const r = await fetch("/api/login", { // Путь /api/login (как в server.js)
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await r.json();
        if (!r.ok) {
            throw new Error(data.error || "Ошибка входа");
        }
        localStorage.setItem("userId", data.userId);
        alert("Вход успешен!");
        window.location.href = "/dashboard.html";
        return data; // Возвращаем для формы
    } catch (err) {
        throw err;
    }
}

export function logout() {
    localStorage.removeItem("userId");
    window.location.href = "/";
}