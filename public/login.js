function setModalOpen(open) {
  const modal = document.getElementById("loginModal");
  if (!modal) return;
  modal.style.display = open ? "block" : "none";
  modal.setAttribute("aria-hidden", open ? "false" : "true");
}

function setError(message) {
  const el = document.getElementById("loginError");
  if (!el) return;
  el.textContent = message || "";
}

document.getElementById("openLogin")?.addEventListener("click", () => {
  setError("");
  setModalOpen(true);
});

document.getElementById("closeLogin")?.addEventListener("click", () => {
  setModalOpen(false);
});

setModalOpen(true);

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setError("");

  const form = e.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value;
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.message || "Ошибка входа");
      return;
    }
    window.location.href = "/app";
  } catch {
    setError("Ошибка сети");
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

