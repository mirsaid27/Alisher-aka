const state = {
  mode: "jshir"
};

function formatDate(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function clearResults() {
  const el = document.getElementById("results");
  if (el) el.innerHTML = "";
}

function renderEmpty(message) {
  const el = document.getElementById("results");
  if (!el) return;
  el.innerHTML = `<div class="card"><div class="error">${message}</div></div>`;
}

function renderPersonBlock(person, certificates) {
  const certsHtml = certificates.length
    ? `<div class="certlist">${certificates
        .map(
          (c) => `
            <div class="cert">
              <div class="cert__meta">
                <div class="cert__title">${escapeHtml(c.title)}</div>
                <div class="cert__sub">${escapeHtml(
                  c.departmentName
                )} • ${formatDate(c.uploadedAt)} • ${formatSize(c.sizeBytes)}</div>
              </div>
              <a class="btn" href="/api/certificates/${c.id}/download">Yuklab olish</a>
            </div>
          `
        )
        .join("")}</div>`
    : `<div class="error">Сертификаты не найдены</div>`;

  return `
    <div class="card">
      <div class="card__title">Ma'lumot</div>
      <div class="kv">
        <div class="kv__k">To'liq ismi</div>
        <div>${escapeHtml(person.fullName)}</div>
        <div class="kv__k">JSHIR raqami</div>
        <div>${escapeHtml(person.jshir)}</div>
      </div>
    </div>
    <div class="card">
      <div class="card__title">Sertifikatlar (${certificates.length})</div>
      ${certsHtml}
    </div>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function search() {
  const q = document.getElementById("query")?.value?.trim() || "";
  if (!q) {
    renderEmpty("Введите запрос");
    return;
  }

  clearResults();
  const btn = document.getElementById("searchBtn");
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(
      `/api/search?mode=${encodeURIComponent(state.mode)}&q=${encodeURIComponent(q)}`
    );
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      renderEmpty(data?.message || "Ошибка поиска");
      return;
    }

    const resultsEl = document.getElementById("results");
    if (!resultsEl) return;

    if (data.mode === "jshir") {
      if (!data.person) {
        renderEmpty("Ничего не найдено");
        return;
      }
      resultsEl.innerHTML = renderPersonBlock(data.person, data.certificates || []);
      return;
    }

    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      renderEmpty("Ничего не найдено");
      return;
    }

    resultsEl.innerHTML = results
      .map((r) => renderPersonBlock({ fullName: r.fullName, jshir: r.jshir }, r.certificates || []))
      .join("");
  } catch {
    renderEmpty("Ошибка сети");
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.getElementById("searchBtn")?.addEventListener("click", search);
document.getElementById("query")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") search();
});

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = btn.getAttribute("data-mode");
    if (mode !== "jshir" && mode !== "name") return;
    state.mode = mode;
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("tab--active"));
    btn.classList.add("tab--active");
    clearResults();
  });
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  window.location.href = "/login";
});

