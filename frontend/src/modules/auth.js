// frontend/src/modules/auth.js

export async function loginUser({ email, password }) {
  try {
    const r = await fetch("/api/login", { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await r.json();

    if (!r.ok) {
      throw new Error(data.error || "Ошибка входа");
    }

    // Сохраняем ID пользователя
    localStorage.setItem("userId", data.userId);
    localStorage.setItem("userName", data.name);

    return data;
  } catch (err) {
    console.error("Auth error:", err);
    throw err;
  }
}