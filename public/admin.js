function setText(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message || "";
}

function formatDateInput(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

async function loadUsers() {
  const res = await fetch("/api/admin/users");
  const data = await res.json().catch(() => null);
  if (!res.ok) return;

  const tbody = document.querySelector("#usersTable tbody");
  if (!tbody) return;

  tbody.innerHTML = (data.users || [])
    .map(
      (u) => `
        <tr>
          <td>${u.id}</td>
          <td>${escapeHtml(u.username)}</td>
          <td>${escapeHtml(u.role)}</td>
          <td>${escapeHtml(u.departmentName)}</td>
          <td>${u.expiresAt ? escapeHtml(formatDateInput(u.expiresAt)) : ""}</td>
        </tr>
      `
    )
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.getElementById("createUserForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setText("createUserError", "");

  const form = e.currentTarget;
  const payload = {
    username: form.username.value.trim(),
    password: form.password.value,
    departmentName: form.departmentName.value.trim(),
    role: form.role.value,
    expiresAt: form.expiresAt.value || null
  };

  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setText("createUserError", data?.message || "Ошибка");
      return;
    }
    form.reset();
    await loadUsers();
  } catch {
    setText("createUserError", "Ошибка сети");
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById("uploadCertForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setText("uploadCertError", "");

  const form = e.currentTarget;
  const btn = form.querySelector('button[type="submit"]');
  if (btn) btn.disabled = true;

  try {
    const fd = new FormData(form);
    const res = await fetch("/api/admin/certificates", { method: "POST", body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setText("uploadCertError", data?.message || "Ошибка");
      return;
    }
    form.reset();
  } catch {
    setText("uploadCertError", "Ошибка сети");
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.href = "/login";
});

loadUsers().catch(() => null);

