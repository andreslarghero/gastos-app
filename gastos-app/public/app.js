const API_BASE = "http://localhost:3001";

// Configurá estas credenciales (anon key) para Supabase Auth en el navegador.
// Nota: la anon key es pública por diseño, no uses service_role en frontend.
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
const supabase =
  typeof window !== "undefined" &&
  window.supabase &&
  typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true },
      })
    : null;

const form = document.getElementById("expenseForm");
const amountEl = document.getElementById("amount");
const categoryEl = document.getElementById("category");
const descriptionEl = document.getElementById("description");
const submitBtn = document.getElementById("submitBtn");
const refreshBtn = document.getElementById("refreshBtn");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("expensesList");
const emptyEl = document.getElementById("emptyState");
const totalEl = document.getElementById("totalValue");
const chartCanvas = document.getElementById("categoryChart");

const appSection = document.getElementById("appSection");
const userBar = document.getElementById("userBar");
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const loginEmailEl = document.getElementById("loginEmail");
const loginPasswordEl = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const registerForm = document.getElementById("registerForm");
const registerEmailEl = document.getElementById("registerEmail");
const registerPasswordEl = document.getElementById("registerPassword");
const registerBtn = document.getElementById("registerBtn");
const authStatusEl = document.getElementById("authStatus");

/** @type {import("chart.js").Chart | null} */
let categoryChart = null;

const CATEGORY_ORDER = ["comida", "transporte", "entretenimiento", "otros"];
const CATEGORY_LABELS = {
  comida: "Comida",
  transporte: "Transporte",
  entretenimiento: "Entretenimiento",
  otros: "Otros",
};
const CATEGORY_COLORS = {
  comida: "rgba(239, 68, 68, 0.9)", // rojo
  transporte: "rgba(59, 130, 246, 0.9)", // azul
  entretenimiento: "rgba(168, 85, 247, 0.9)", // violeta
  otros: "rgba(148, 163, 184, 0.85)", // gris
};

function setStatus(message, type = "muted") {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message || "";
}

function setAuthStatus(message, type = "muted") {
  if (!authStatusEl) return;
  authStatusEl.className = `status ${type}`;
  authStatusEl.textContent = message || "";
}

async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data?.session || null;
}

async function getAccessToken() {
  const session = await getSession();
  return session?.access_token || null;
}

async function getUserEmail() {
  const session = await getSession();
  return session?.user?.email || null;
}

function isLoginPage() {
  return window.location.pathname.endsWith("/login.html");
}

function redirectToLogin() {
  window.location.href = "/login.html";
}

function redirectToApp() {
  window.location.href = "/";
}

function setAuthedUI(isAuthed) {
  if (appSection) appSection.hidden = !isAuthed;
  if (userBar) userBar.hidden = !isAuthed;

  if (welcomeText) {
    welcomeText.textContent = "Bienvenido, usuario";
    getUserEmail().then((email) => {
      welcomeText.textContent = email ? `Bienvenido, ${email}` : "Bienvenido, usuario";
    });
  }
}

function parsePositiveAmount(value) {
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
}

function normalizeCategory(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, " ");
}

function toAppCategory(value) {
  const c = normalizeCategory(value);
  if (c.startsWith("comida") || c.includes("alimento") || c.includes("restaurant")) return "comida";
  if (c.startsWith("transporte") || c.includes("uber") || c.includes("taxi") || c.includes("nafta")) {
    return "transporte";
  }
  if (c.startsWith("entretenimiento") || c.includes("ocio") || c.includes("cine") || c.includes("juego")) {
    return "entretenimiento";
  }
  return "otros";
}

function categoryColor(category) {
  return CATEGORY_COLORS[toAppCategory(category)];
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0.00";
  // Pesos con símbolo $ y formato español (MX).
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-MX");
}

function escapeText(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function computeCategoryTotals(expenses) {
  const totals = {
    comida: 0,
    transporte: 0,
    entretenimiento: 0,
    otros: 0,
  };

  if (!Array.isArray(expenses)) return totals;

  for (const e of expenses) {
    const key = toAppCategory(e.category);
    totals[key] += Number(e.amount) || 0;
  }
  return totals;
}

function upsertCategoryChart(expenses) {
  if (!chartCanvas || typeof Chart === "undefined") return;

  const totals = computeCategoryTotals(expenses);
  const values = CATEGORY_ORDER.map((k) => totals[k]);
  const labels = CATEGORY_ORDER.map((k) => CATEGORY_LABELS[k]);
  const colors = CATEGORY_ORDER.map((k) => CATEGORY_COLORS[k]);

  if (!categoryChart) {
    categoryChart = new Chart(chartCanvas, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: "rgba(2, 6, 23, 0.6)",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        animation: { duration: 350 },
        plugins: {
          legend: {
            labels: {
              color: "rgba(229, 231, 235, 0.86)",
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: "circle",
            },
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw) || 0;
                return `${ctx.label}: ${formatMoney(value)}`;
              },
            },
          },
        },
      },
    });
    return;
  }

  categoryChart.data.labels = labels;
  categoryChart.data.datasets[0].data = values;
  categoryChart.data.datasets[0].backgroundColor = colors;
  categoryChart.update();
}

function renderExpenses(expenses) {
  listEl.innerHTML = "";

  if (!Array.isArray(expenses) || expenses.length === 0) {
    emptyEl.hidden = false;
    totalEl.textContent = formatMoney(0);
    upsertCategoryChart([]);
    return;
  }

  emptyEl.hidden = true;

  let total = 0;
  for (const e of expenses) {
    total += Number(e.amount) || 0;
    const li = document.createElement("li");
    li.className = "item item-anim";
    li.style.setProperty("--cat", categoryColor(e.category));
    li.dataset.id = String(e.id ?? "");
    li.innerHTML = `
      <div class="item-main">
        <div class="item-title">
          <span class="pill">${escapeText(CATEGORY_LABELS[toAppCategory(e.category)])}</span>
          <span class="desc">${escapeText(e.description ?? "")}</span>
        </div>
        <div class="meta">${escapeText(formatDate(e.date))}</div>
      </div>
      <div class="item-right">
        <div class="amt">${escapeText(formatMoney(e.amount))}</div>
        <div class="item-actions">
          <button class="btn-secondary" type="button" data-action="delete">
            Eliminar
          </button>
        </div>
      </div>
    `;
    listEl.appendChild(li);
  }

  totalEl.textContent = formatMoney(total);
  upsertCategoryChart(expenses);
}

async function fetchExpenses() {
  setStatus("Cargando…");
  try {
    const token = await getAccessToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    const res = await fetch(`${API_BASE}/expenses`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => null);

    if (!res.ok || !body || body.ok !== true) {
      const details = body?.details || body?.error || `HTTP ${res.status}`;
      throw new Error(details);
    }

    renderExpenses(body.data);
    setStatus("");
  } catch (err) {
    renderExpenses([]);
    setStatus(
      err instanceof Error
        ? `No se pudieron cargar los gastos: ${err.message}`
        : "No se pudieron cargar los gastos.",
      "error"
    );
  }
}

async function createExpense({ amount, category, description }) {
  const token = await getAccessToken();
  if (!token) throw new Error("No autorizado.");

  const res = await fetch(`${API_BASE}/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, category, description }),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.ok !== true) {
    const details = body?.details || body?.error || `HTTP ${res.status}`;
    throw new Error(details);
  }
  return body.data;
}

async function deleteExpense(id) {
  const token = await getAccessToken();
  if (!token) throw new Error("No autorizado.");

  const res = await fetch(`${API_BASE}/expenses/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.ok !== true) {
    const details = body?.details || body?.error || `HTTP ${res.status}`;
    throw new Error(details);
  }
  return body.data;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  setStatus("");

  const amountRaw = amountEl.value;
  const category = categoryEl.value.trim();
  const description = descriptionEl.value.trim();

  if (!amountRaw || !category || !description) {
    setStatus("Completá todos los campos.", "error");
    return;
  }

  const amount = parsePositiveAmount(amountRaw);
  if (amount === null) {
    setStatus("El monto debe ser un número mayor a 0.", "error");
    return;
  }

  submitBtn.disabled = true;
  refreshBtn.disabled = true;
  setStatus("Guardando…");

  try {
    await createExpense({ amount, category, description });
    form.reset();
    setStatus("Gasto agregado correctamente", "success");
    await fetchExpenses();
  } catch (err) {
    setStatus(
      err instanceof Error ? `No se pudo guardar: ${err.message}` : "No se pudo guardar.",
      "error"
    );
  } finally {
    submitBtn.disabled = false;
    refreshBtn.disabled = false;
  }
});

refreshBtn?.addEventListener("click", () => {
  fetchExpenses();
});

listEl?.addEventListener("click", async (e) => {
  const btn = e.target instanceof HTMLElement ? e.target.closest("button") : null;
  if (!btn) return;
  if (btn.dataset.action !== "delete") return;

  const li = btn.closest("li");
  const id = li?.dataset?.id;
  if (!id) return;

  const ok = window.confirm("¿Seguro que querés eliminar este gasto?");
  if (!ok) return;

  btn.disabled = true;
  setStatus("Eliminando…");

  try {
    await deleteExpense(id);
    if (li) {
      li.classList.remove("item-anim");
      li.classList.add("item-out");
      li.addEventListener(
        "animationend",
        () => {
          li.remove();
        },
        { once: true }
      );
    }
    await fetchExpenses();
    setStatus("Gasto eliminado correctamente", "success");
  } catch (err) {
    btn.disabled = false;
    setStatus(
      err instanceof Error ? `No se pudo eliminar: ${err.message}` : "No se pudo eliminar.",
      "error"
    );
  }
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthStatus("");

  const email = String(loginEmailEl?.value || "").trim();
  const password = String(loginPasswordEl?.value || "");
  if (!email || !password) {
    setAuthStatus("Completá email y contraseña.", "error");
    return;
  }

  loginBtn.disabled = true;
  registerBtn.disabled = true;
  setAuthStatus("Iniciando sesión…");

  try {
    if (!supabase) throw new Error("Supabase no está configurado en el frontend.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.session) {
      throw new Error(error?.message || "Credenciales inválidas.");
    }
    // Persistencia: Supabase guarda la sesión en localStorage automáticamente.
    setAuthStatus("");
    redirectToApp();
  } catch (err) {
    setAuthStatus(
      err instanceof Error ? `No se pudo iniciar sesión: ${err.message}` : "No se pudo iniciar sesión.",
      "error"
    );
  } finally {
    loginBtn.disabled = false;
    registerBtn.disabled = false;
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthStatus("");

  const email = String(registerEmailEl?.value || "").trim();
  const password = String(registerPasswordEl?.value || "");
  if (!email || !password) {
    setAuthStatus("Completá email y contraseña.", "error");
    return;
  }

  loginBtn.disabled = true;
  registerBtn.disabled = true;
  setAuthStatus("Creando cuenta…");

  try {
    if (!supabase) throw new Error("Supabase no está configurado en el frontend.");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);

    if (data?.session) {
      setAuthStatus("");
      redirectToApp();
      return;
    }

    setAuthStatus(
      "Cuenta creada. Revisá tu email si Supabase requiere confirmación, y luego iniciá sesión.",
      "success"
    );
  } catch (err) {
    setAuthStatus(
      err instanceof Error ? `No se pudo registrar: ${err.message}` : "No se pudo registrar.",
      "error"
    );
  } finally {
    loginBtn.disabled = false;
    registerBtn.disabled = false;
  }
});

logoutBtn?.addEventListener("click", () => {
  if (!supabase) {
    redirectToLogin();
    return;
  }
  supabase.auth
    .signOut()
    .catch(() => {})
    .finally(() => {
      redirectToLogin();
    });
});

// Inicialización
if (!supabase) {
  if (isLoginPage()) {
    setAuthStatus("Falta configurar Supabase en el frontend.", "error");
  } else {
    setStatus("Falta configurar Supabase en el frontend.", "error");
  }
} else {
  getSession().then((session) => {
    const authed = Boolean(session?.access_token);
    if (isLoginPage()) {
      if (authed) redirectToApp();
      return;
    }
    if (!authed) {
      redirectToLogin();
      return;
    }
    setAuthedUI(true);
    fetchExpenses();
  });
}


