const runtimeConfig = window.__APP_CONFIG__ || {};
const API_BASE = String(runtimeConfig.apiBaseUrl || "").trim();

/** Moneda y locale para importes (presentación). No incluye conversión real. */
const MONEY_LOCALE = "es-UY";
let MONEY_CURRENCY = "UYU";

// Credenciales de Supabase configurables para navegador.
const SUPABASE_URL = String(runtimeConfig.supabaseUrl || "").trim();
const SUPABASE_ANON_KEY = String(runtimeConfig.supabaseAnonKey || "").trim();

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
const supabaseClient =
  window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true },
      })
    : null;

const form = document.getElementById("expenseForm");
const amountEl = document.getElementById("amount");
const categoryEl = document.getElementById("category");
const descriptionEl = document.getElementById("description");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const expenseFormTitleEl = document.getElementById("expenseFormTitle");
const expenseFormSubtitleEl = document.getElementById("expenseFormSubtitle");
const refreshBtn = document.getElementById("refreshBtn");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("expensesList");
const emptyEl = document.getElementById("emptyState");
const totalEl = document.getElementById("totalValue");
const chartCanvas = document.getElementById("categoryChart");
const chartSkeletonEl = document.getElementById("chartSkeleton");
const chartEmptyStateEl = document.getElementById("chartEmptyState");
const expensesSkeletonEl = document.getElementById("expensesSkeleton");
const monthSummaryTotalEl = document.getElementById("monthSummaryTotal");
const monthSummaryCountEl = document.getElementById("monthSummaryCount");
const monthSummaryTopCategoryEl = document.getElementById("monthSummaryTopCategory");
const displayCurrencySelectEl = document.getElementById("displayCurrencySelect");
const onboardingPanelEl = document.getElementById("onboardingPanel");
const onboardingDismissBtnEl = document.getElementById("onboardingDismissBtn");
const deleteConfirmModalEl = document.getElementById("deleteConfirmModal");
const deleteConfirmCancelBtnEl = document.getElementById("deleteConfirmCancelBtn");
const deleteConfirmAcceptBtnEl = document.getElementById("deleteConfirmAcceptBtn");
const expensesPanelEl = document.getElementById("expensesPanel");
const toggleExpensesPanelBtn = document.getElementById("toggleExpensesPanelBtn");
const themeToggleBtnEl = document.getElementById("themeToggleBtn");
const expenseFilterCategoryEl = document.getElementById("expenseFilterCategory");
const expenseFilterSearchEl = document.getElementById("expenseFilterSearch");
const expenseFilterResetBtn = document.getElementById("expenseFilterReset");

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
const registerAuthStatusEl = document.getElementById("registerAuthStatus");

/** @type {import("chart.js").Chart | null} */
let categoryChart = null;

/** Última lista completa desde el servidor (la vista aplica filtros encima). */
let expensesCache = [];

/** Si no es null, el formulario está editando ese id (PUT en lugar de POST). */
let editingExpenseId = null;
let editingInlineExpenseId = null;

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

let toastCounter = 0;
const toastQueue = [];
const TOAST_LIMIT = 4;

function sortExpensesNewestFirst(list) {
  const base = Array.isArray(list) ? [...list] : [];
  return base.sort((a, b) => {
    const ta = new Date(a?.date ?? "").getTime();
    const tb = new Date(b?.date ?? "").getTime();

    if (Number.isFinite(tb) && Number.isFinite(ta) && tb !== ta) return tb - ta;
    if (Number.isFinite(tb) && !Number.isFinite(ta)) return -1;
    if (!Number.isFinite(tb) && Number.isFinite(ta)) return 1;

    // Fallback estable para mantener una lista predecible.
    return (Number(b?.id) || 0) - (Number(a?.id) || 0);
  });
}

function setExpensesCache(nextExpenses) {
  expensesCache = sortExpensesNewestFirst(nextExpenses);
  refreshExpenseView();
}

function removeExpenseFromCache(id) {
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) return;
  setExpensesCache(expensesCache.filter((e) => Number(e.id) !== idNum));
}

function ensureToastContainer() {
  let el = document.getElementById("toastContainer");
  if (!el) {
    el = document.createElement("div");
    el.id = "toastContainer";
    el.className = "toast-container";
    el.setAttribute("aria-live", "polite");
    el.setAttribute("aria-relevant", "additions");
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, type) {
  if (!message) return;

  const container = ensureToastContainer();
  const toast = document.createElement("div");
  const toastId = `toast_${toastCounter++}`;
  toast.id = toastId;

  const normalizedType = type === "success" ? "success" : "error";
  toast.className = `toast toast--${normalizedType}`;
  toast.classList.add("toast--show");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;

  container.appendChild(toast);
  toastQueue.push(toast);

  while (toastQueue.length > TOAST_LIMIT) {
    const oldest = toastQueue.shift();
    if (oldest?.parentElement) oldest.parentElement.removeChild(oldest);
  }

  // Auto-dismiss (no blocking).
  const duration = normalizedType === "error" ? 3600 : 2600;
  window.setTimeout(() => {
    toast.classList.add("toast--hide");
    window.setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
      const idx = toastQueue.indexOf(toast);
      if (idx >= 0) toastQueue.splice(idx, 1);
    }, 200);
  }, duration);
}

function setStatus(message, type = "muted") {
  // Para operaciones de gastos mostramos toast; para mensajes neutrales (cargando/limpiando)
  // mantenemos el estado inline para no cambiar la UX existente.
  if (type === "success" || type === "error") {
    showToast(message || "", type);
    // Evita duplicación visual (toast + status inline).
    if (statusEl) {
      statusEl.textContent = "";
      statusEl.className = "status muted";
    }
    return;
  }

  if (!statusEl) return;
  statusEl.className = `status ${type}`;
  statusEl.textContent = message || "";
}

function setAuthStatus(message, type = "muted") {
  if (!authStatusEl) return;
  authStatusEl.className = `status ${type}`;
  authStatusEl.textContent = message || "";
}

function setRegisterAuthStatus(message, type = "muted") {
  if (!registerAuthStatusEl) return;
  registerAuthStatusEl.className = `status ${type}`;
  registerAuthStatusEl.textContent = message || "";
}

// Onboarding (first-use) - ayuda liviana, no bloquea la app.
const ONBOARDING_DISMISSED_KEY = "gastos_onboarding_v1_dismissed";
const ONBOARDING_SHOWN_KEY = "gastos_onboarding_v1_shown_this_session";
let onboardingInitialized = false;
let onboardingAutoHideTimer = null;
let deleteConfirmResolve = null;
let deleteConfirmLastActiveEl = null;

function hideOnboarding() {
  if (onboardingPanelEl) onboardingPanelEl.hidden = true;
  if (onboardingAutoHideTimer) window.clearTimeout(onboardingAutoHideTimer);
  onboardingAutoHideTimer = null;
}

function closeDeleteConfirmModal(confirmed) {
  if (!deleteConfirmModalEl) return;
  deleteConfirmModalEl.hidden = true;
  document.body.style.overflow = "";
  if (deleteConfirmResolve) {
    const resolve = deleteConfirmResolve;
    deleteConfirmResolve = null;
    resolve(Boolean(confirmed));
  }
  if (deleteConfirmLastActiveEl instanceof HTMLElement) {
    deleteConfirmLastActiveEl.focus();
  }
  deleteConfirmLastActiveEl = null;
}

function openDeleteConfirmModal() {
  if (!deleteConfirmModalEl || !deleteConfirmCancelBtnEl || !deleteConfirmAcceptBtnEl) {
    return Promise.resolve(window.confirm("¿Seguro que querés eliminar este gasto?"));
  }
  if (deleteConfirmResolve) {
    closeDeleteConfirmModal(false);
  }

  deleteConfirmLastActiveEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  deleteConfirmModalEl.hidden = false;
  document.body.style.overflow = "hidden";
  deleteConfirmCancelBtnEl.focus();

  return new Promise((resolve) => {
    deleteConfirmResolve = resolve;
  });
}

function initOnboardingIfNeeded() {
  if (!onboardingPanelEl || !onboardingDismissBtnEl) return;
  if (isLoginPage()) return;
  if (onboardingInitialized) return;

  onboardingInitialized = true;

  let dismissed = false;
  let alreadyShown = false;
  try {
    dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
    alreadyShown = sessionStorage.getItem(ONBOARDING_SHOWN_KEY) === "1";
  } catch {
    // Si storage falla, igual intentamos no bloquear: mostramos solo 1 vez por carga.
    dismissed = false;
    alreadyShown = false;
  }

  if (dismissed || alreadyShown) {
    hideOnboarding();
    return;
  }

  onboardingPanelEl.hidden = false;

  try {
    sessionStorage.setItem(ONBOARDING_SHOWN_KEY, "1");
  } catch {
    /* ignore */
  }

  onboardingDismissBtnEl.addEventListener("click", () => {
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    } catch {
      /* ignore */
    }
    hideOnboarding();
  });

  // Auto-hide para no interferir demasiado.
  onboardingAutoHideTimer = window.setTimeout(() => {
    hideOnboarding();
  }, 15000);
}

async function getSession() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getSession();
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

async function getUserDisplayName() {
  const session = await getSession();
  const user = session?.user;
  const metadata = user?.user_metadata || {};

  const candidates = [
    metadata?.display_name,
    metadata?.full_name,
    metadata?.name,
    metadata?.username,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }

  // Fallback: evitar mostrar el email completo; usar la parte antes del "@".
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (email && email.includes("@")) return email.split("@")[0] || null;
  return null;
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

function authErrorMessage(errorLike, fallbackMessage) {
  const raw = String(errorLike?.message || errorLike || "")
    .trim()
    .toLowerCase();
  if (!raw) return fallbackMessage;

  if (
    raw.includes("invalid login credentials") ||
    raw.includes("invalid credentials") ||
    raw.includes("invalid email or password")
  ) {
    return "Credenciales inválidas. Revisá tu email y contraseña.";
  }

  if (raw.includes("email not confirmed") || raw.includes("confirm your email")) {
    return "Tu email todavía no está confirmado. Revisá tu correo e intentá nuevamente.";
  }

  if (raw.includes("already registered") || raw.includes("user already registered")) {
    return "Ya existe una cuenta asociada a ese email.";
  }

  if (raw.includes("password should be at least")) {
    return "La contraseña es demasiado corta. Debe tener al menos 6 caracteres.";
  }

  if (raw.includes("network") || raw.includes("fetch")) {
    return "No se pudo conectar con el servicio de autenticación. Probá de nuevo.";
  }

  return fallbackMessage;
}

function hasSession(session) {
  return Boolean(session?.access_token);
}

function onAuthedAppPage() {
  setAuthedUI(true);
  initOnboardingIfNeeded();
  fetchExpenses();
}

function onUnauthedAppPage() {
  redirectToLogin();
}

function handleSessionForCurrentPage(session) {
  const authed = hasSession(session);

  if (isLoginPage()) {
    if (authed) redirectToApp();
    return;
  }

  if (!authed) {
    onUnauthedAppPage();
    return;
  }

  onAuthedAppPage();
}

function setAuthedUI(isAuthed) {
  if (appSection) appSection.hidden = !isAuthed;
  if (userBar) userBar.hidden = !isAuthed;

  if (welcomeText) {
    welcomeText.textContent = "Bienvenido, usuario";
    getUserDisplayName().then((name) => {
      welcomeText.textContent = name ? `Bienvenido, ${name}` : "Bienvenido, usuario";
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

function applyExpenseFilters(list) {
  const base = Array.isArray(list) ? list : [];
  const cat = String(expenseFilterCategoryEl?.value || "").trim();
  const q = String(expenseFilterSearchEl?.value || "")
    .trim()
    .toLowerCase();

  let out = base;
  if (cat) {
    out = out.filter((e) => toAppCategory(e.category) === cat);
  }
  if (q) {
    out = out.filter((e) =>
      String(e.description ?? "")
        .toLowerCase()
        .includes(q)
    );
  }
  return out;
}

function updateEmptyStateMessage(noDataAtAll) {
  const title = document.getElementById("emptyStateTitle");
  const hint = document.getElementById("emptyStateHint");
  if (!title || !hint) return;

  const activeCategory = String(expenseFilterCategoryEl?.value || "").trim();
  const activeSearch = String(expenseFilterSearchEl?.value || "").trim();

  if (noDataAtAll) {
    title.textContent = "No hay gastos aún";
    hint.textContent = "Usá el formulario de arriba para agregar el primero.";
  } else if (activeCategory && !activeSearch) {
    title.textContent = "No hay gastos en esta categoría.";
    hint.textContent = "Probá con otra categoría o agregá un nuevo gasto.";
  } else {
    title.textContent = "Ningún gasto coincide con tus filtros";
    hint.textContent =
      "Probá otra categoría, otra palabra en la búsqueda, o tocá «Limpiar».";
  }
}

function isExpenseInCurrentLocalMonth(dateValue) {
  if (dateValue == null || dateValue === "") return false;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/** Resumen general: usa el mismo subconjunto filtrado de lista/total/gráfico. */
function updateMonthlySummary(filteredExpenses) {
  const totalEl = document.getElementById("monthSummaryTotal");
  const countEl = document.getElementById("monthSummaryCount");
  const topEl = document.getElementById("monthSummaryTopCategory");
  const periodEl = document.getElementById("monthSummaryPeriod");
  if (!totalEl || !countEl || !topEl) return;

  if (periodEl) {
    periodEl.textContent = "Dashboard de gastos visibles";
  }

  const list = Array.isArray(filteredExpenses) ? filteredExpenses : [];
  const sum = list.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  totalEl.textContent = formatMoney(sum);
  countEl.textContent = String(list.length);

  if (list.length === 0) {
    topEl.textContent = "—";
    return;
  }

  const byCat = computeCategoryTotals(list);
  let topKey = null;
  let topAmt = -1;
  for (const k of CATEGORY_ORDER) {
    const v = byCat[k] || 0;
    if (v > topAmt) {
      topAmt = v;
      topKey = k;
    }
  }
  topEl.textContent = topKey ? CATEGORY_LABELS[topKey] : "—";
}

/** Lista, total del hero, gráfico y resumen mensual usan el subconjunto filtrado. */
function refreshExpenseView() {
  const filtered = applyExpenseFilters(expensesCache);
  if (
    editingInlineExpenseId != null &&
    !filtered.some((e) => Number(e.id) === editingInlineExpenseId)
  ) {
    editingInlineExpenseId = null;
  }
  updateMonthlySummary(filtered);
  renderExpenses(filtered);
}

function setDashboardLoading(isLoading) {
  totalEl?.classList.toggle("skeleton-text", isLoading);
  monthSummaryTotalEl?.classList.toggle("skeleton-text", isLoading);
  monthSummaryCountEl?.classList.toggle("skeleton-text", isLoading);
  monthSummaryTopCategoryEl?.classList.toggle("skeleton-text", isLoading);

  if (chartSkeletonEl) chartSkeletonEl.hidden = !isLoading;
  if (chartCanvas) chartCanvas.style.opacity = isLoading ? "0" : "";
}

function setExpenseFormMode(isEdit) {
  if (expenseFormTitleEl) {
    expenseFormTitleEl.textContent = isEdit ? "Editar gasto" : "Agregar gasto";
  }
  if (expenseFormSubtitleEl) {
    expenseFormSubtitleEl.textContent = isEdit
      ? "Modificá los datos y tocá «Guardar cambios»."
      : "Registrá un movimiento en segundos.";
  }
  if (submitBtn) submitBtn.textContent = isEdit ? "Guardar cambios" : "Agregar gasto";
  if (cancelEditBtn) cancelEditBtn.hidden = !isEdit;
}

function clearExpenseEditMode() {
  editingExpenseId = null;
  form?.reset();
  setExpenseFormMode(false);
}

function beginEditExpense(idStr) {
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return;
  const row = expensesCache.find((x) => Number(x.id) === id);
  if (!row) return;

  editingExpenseId = id;
  if (amountEl) amountEl.value = String(row.amount ?? "");
  if (categoryEl) {
    const key = toAppCategory(row.category);
    categoryEl.value = CATEGORY_ORDER.includes(key) ? key : "otros";
  }
  if (descriptionEl) descriptionEl.value = String(row.description ?? "");
  setExpenseFormMode(true);
  amountEl?.focus();
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    try {
      return (0).toLocaleString(MONEY_LOCALE, {
        style: "currency",
        currency: MONEY_CURRENCY,
      });
    } catch {
      return "—";
    }
  }
  return n.toLocaleString(MONEY_LOCALE, {
    style: "currency",
    currency: MONEY_CURRENCY,
  });
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(MONEY_LOCALE);
}

function currencyLabelForHero() {
  try {
    if (typeof Intl !== "undefined" && Intl.DisplayNames) {
      const dn = new Intl.DisplayNames(MONEY_LOCALE, { type: "currency" });
      const name = dn.of(MONEY_CURRENCY);
      if (name) return `${name} (${MONEY_CURRENCY})`;
    }
  } catch {
    /* ignore */
  }
  return MONEY_CURRENCY;
}

function syncDisplayCurrencyLabel() {
  const el = document.getElementById("displayCurrencyLabel");
  if (el) el.textContent = currencyLabelForHero();
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

function getChartThemeColors() {
  try {
    const cs = getComputedStyle(document.documentElement);
    const borderColor = (cs.getPropertyValue("--chartBorderColor") || "").trim();
    const legendColor = (cs.getPropertyValue("--chartLegendColor") || "").trim();
    return {
      borderColor: borderColor || "rgba(6, 10, 22, 0.85)",
      legendColor: legendColor || "rgba(229, 231, 235, 0.9)",
    };
  } catch {
    return {
      borderColor: "rgba(6, 10, 22, 0.85)",
      legendColor: "rgba(229, 231, 235, 0.9)",
    };
  }
}

function upsertCategoryChart(expenses) {
  if (!chartCanvas || typeof Chart === "undefined") return;

  const list = Array.isArray(expenses) ? expenses : [];
  const totals = computeCategoryTotals(list);
  const values = CATEGORY_ORDER.map((k) => totals[k]);
  const labels = CATEGORY_ORDER.map((k) => CATEGORY_LABELS[k]);
  const colors = CATEGORY_ORDER.map((k) => CATEGORY_COLORS[k]);
  const hasData = values.some((v) => Number(v) > 0);
  const { borderColor, legendColor } = getChartThemeColors();

  if (chartEmptyStateEl) chartEmptyStateEl.hidden = hasData;
  if (chartCanvas) chartCanvas.style.opacity = hasData ? "" : "0.3";

  if (!categoryChart) {
    categoryChart = new Chart(chartCanvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor,
            borderWidth: 2,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "58%",
        layout: {
          padding: { top: 8, bottom: 4, left: 6, right: 6 },
        },
        animation: { duration: 350 },
        plugins: {
          legend: {
            labels: {
              color: legendColor,
              boxWidth: 10,
              boxHeight: 10,
              padding: 14,
              font: { size: 12, weight: "500" },
              usePointStyle: true,
              pointStyle: "circle",
            },
            position: "bottom",
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw) || 0;
                const datasetValues = Array.isArray(ctx?.dataset?.data) ? ctx.dataset.data : [];
                const anyValue = datasetValues.some((v) => Number(v) > 0);
                if (!anyValue) return `${ctx.label}: sin gastos`;
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
  categoryChart.data.datasets[0].borderColor = borderColor;
  categoryChart.options.plugins.legend.labels.color = legendColor;
  categoryChart.update();
}

function renderExpenses(expenses) {
  listEl.innerHTML = "";
  // El esqueleto solo debería verse mientras se están cargando los gastos.
  // Si renderizamos (lista o vacío), garantizamos que desaparezca.
  if (expensesSkeletonEl) expensesSkeletonEl.hidden = true;

  if (!Array.isArray(expenses) || expenses.length === 0) {
    emptyEl.hidden = false;
    updateEmptyStateMessage(expensesCache.length === 0);
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

    const idNum = Number(e.id);
    const isInlineEditing = editingInlineExpenseId === idNum;
    if (isInlineEditing) li.classList.add("item-inline-editing");
    const inlineSelectedCat = toAppCategory(e.category);
    const inlineCategoryOptions = CATEGORY_ORDER.map((k) => {
      const selected = k === inlineSelectedCat ? " selected" : "";
      return `<option value="${k}"${selected}>${escapeText(
        CATEGORY_LABELS[k]
      )}</option>`;
    }).join("");

    li.innerHTML = `
      <div class="item-main">
        <div class="item-title">
          <span class="pill">${escapeText(
            CATEGORY_LABELS[toAppCategory(e.category)]
          )}</span>
          <span class="desc">${escapeText(e.description ?? "")}</span>
        </div>
        <div class="meta">${escapeText(formatDate(e.date))}</div>
      </div>
      <div class="item-right">
        <div class="amt">${escapeText(formatMoney(e.amount))}</div>
        <div class="item-actions">
          <button
            class="btn-secondary"
            type="button"
            data-action="edit-form"
          >
            Editar
          </button>
          <button class="btn-secondary" type="button" data-action="delete">
            Eliminar
          </button>
        </div>
      </div>

      <div
        class="inline-edit-panel ${
          isInlineEditing ? "" : "inline-edit-panel--collapsed"
        }"
        aria-hidden="${isInlineEditing ? "false" : "true"}"
      >
        <div class="inline-edit-grid">
          <label class="field-inline">
            <span>Monto</span>
            <input
              class="inline-amount"
              type="number"
              step="0.01"
              min="0"
              value="${escapeText(String(e.amount ?? ""))}"
              required
            />
          </label>

          <label class="field-inline">
            <span>Categoría</span>
            <select class="inline-category" required>
              ${inlineCategoryOptions}
            </select>
          </label>

          <label class="field-inline field-inline-full">
            <span>Descripción</span>
            <input
              class="inline-description"
              type="text"
              maxlength="200"
              value="${escapeText(String(e.description ?? ""))}"
              required
            />
          </label>
        </div>

        <div class="inline-edit-actions">
          <button class="btn-secondary" type="button" data-action="inline-save">
            Guardar
          </button>
          <button class="btn-secondary btn-compact" type="button" data-action="inline-cancel">
            Cancelar
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
  setStatus("Cargando gastos…");
  if (expensesSkeletonEl) expensesSkeletonEl.hidden = false;
  if (listEl) listEl.hidden = true;
  if (emptyEl) emptyEl.hidden = true;
  setDashboardLoading(true);
  try {
    const token = await getAccessToken();
    if (!token) {
      setDashboardLoading(false);
      if (expensesSkeletonEl) expensesSkeletonEl.hidden = true;
      if (listEl) listEl.hidden = false;
      if (emptyEl) emptyEl.hidden = true;
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

    setExpensesCache(Array.isArray(body.data) ? body.data : []);
    if (expensesSkeletonEl) expensesSkeletonEl.hidden = true;
    if (listEl) listEl.hidden = false;
    setDashboardLoading(false);
    setStatus("");
  } catch (err) {
    console.error("fetchExpenses failed:", err);
    setExpensesCache([]);
    if (expensesSkeletonEl) expensesSkeletonEl.hidden = true;
    if (listEl) listEl.hidden = false;
    setDashboardLoading(false);
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

async function updateExpense(id, { amount, category, description }) {
  const token = await getAccessToken();
  if (!token) throw new Error("No autorizado.");

  const res = await fetch(`${API_BASE}/expenses/${encodeURIComponent(id)}`, {
    method: "PUT",
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

form?.addEventListener("submit", async (e) => {
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
  submitBtn.classList.add("is-loading");
  refreshBtn.disabled = true;
  if (cancelEditBtn) cancelEditBtn.disabled = true;
  setStatus(editingExpenseId != null ? "Guardando cambios…" : "Guardando…");

  try {
    if (editingExpenseId != null) {
      await updateExpense(editingExpenseId, { amount, category, description });
      clearExpenseEditMode();
      setStatus("Gasto actualizado correctamente", "success");
    } else {
      await createExpense({ amount, category, description });
      form.reset();
      setStatus("Gasto agregado correctamente", "success");
    }
    await fetchExpenses();
  } catch (err) {
    setStatus(
      err instanceof Error ? `No se pudo guardar: ${err.message}` : "No se pudo guardar.",
      "error"
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-loading");
    refreshBtn.disabled = false;
    if (cancelEditBtn) cancelEditBtn.disabled = false;
  }
});

cancelEditBtn?.addEventListener("click", () => {
  clearExpenseEditMode();
  setStatus("");
});

refreshBtn?.addEventListener("click", () => {
  fetchExpenses();
});

expenseFilterCategoryEl?.addEventListener("change", () => {
  refreshExpenseView();
});

expenseFilterSearchEl?.addEventListener("input", () => {
  refreshExpenseView();
});

expenseFilterResetBtn?.addEventListener("click", () => {
  if (expenseFilterCategoryEl) expenseFilterCategoryEl.value = "";
  if (expenseFilterSearchEl) expenseFilterSearchEl.value = "";
  refreshExpenseView();
});

listEl?.addEventListener("click", async (e) => {
  const btn = e.target instanceof HTMLElement ? e.target.closest("button") : null;
  if (!btn) return;

  const li = btn.closest("li");
  const id = li?.dataset?.id;
  if (!id) return;

  if (btn.dataset.action === "edit-form") {
    editingInlineExpenseId = null;
    beginEditExpense(id);
    setStatus("");
    return;
  }

  if (btn.dataset.action === "inline-cancel") {
    editingInlineExpenseId = null;
    refreshExpenseView();
    setStatus("");
    return;
  }

  if (btn.dataset.action === "inline-save") {
    const amountInput = li?.querySelector("input.inline-amount");
    const categoryInput = li?.querySelector("select.inline-category");
    const descriptionInput = li?.querySelector("input.inline-description");

    const amountRaw = amountInput?.value ?? "";
    const categoryRaw = categoryInput?.value?.trim() ?? "";
    const category = CATEGORY_LABELS[toAppCategory(categoryRaw)] || categoryRaw;
    const description = descriptionInput?.value?.trim() ?? "";

    if (!amountRaw || !category || !description) {
      setStatus("Completá todos los campos.", "error");
      return;
    }

    const amount = parsePositiveAmount(amountRaw);
    if (amount === null) {
      setStatus("El monto debe ser un número mayor a 0.", "error");
      return;
    }

    btn.disabled = true;
    btn.classList.add("is-loading");
    setStatus("Guardando cambios…");

    try {
      await updateExpense(id, { amount, category, description });
      editingInlineExpenseId = null;
      setStatus("Gasto actualizado correctamente", "success");
      await fetchExpenses();
    } catch (err) {
      setStatus(
        err instanceof Error ? `No se pudo guardar: ${err.message}` : "No se pudo guardar.",
        "error"
      );
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }

    return;
  }

  if (btn.dataset.action !== "delete") return;

  const ok = await openDeleteConfirmModal();
  if (!ok) return;

  btn.disabled = true;
  btn.classList.add("is-loading");
  setStatus("Eliminando…");

  try {
    await deleteExpense(id);
    if (editingInlineExpenseId != null && Number(id) === editingInlineExpenseId) {
      editingInlineExpenseId = null;
    }
    if (editingExpenseId != null && Number(id) === editingExpenseId) {
      clearExpenseEditMode();
    }
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
    removeExpenseFromCache(id);
    btn.classList.remove("is-loading");
    setStatus("Gasto eliminado correctamente", "success");
  } catch (err) {
    btn.disabled = false;
    btn.classList.remove("is-loading");
    setStatus(
      err instanceof Error ? `No se pudo eliminar: ${err.message}` : "No se pudo eliminar.",
      "error"
    );
  }
});

deleteConfirmCancelBtnEl?.addEventListener("click", () => {
  closeDeleteConfirmModal(false);
});

deleteConfirmAcceptBtnEl?.addEventListener("click", () => {
  closeDeleteConfirmModal(true);
});

deleteConfirmModalEl?.addEventListener("click", (e) => {
  if (e.target === deleteConfirmModalEl) {
    closeDeleteConfirmModal(false);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !deleteConfirmModalEl || deleteConfirmModalEl.hidden) return;
  closeDeleteConfirmModal(false);
});

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthStatus("");
  setRegisterAuthStatus("");

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
    if (!supabaseClient) throw new Error("Supabase no está configurado en el frontend.");
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw new Error(error.message || "Credenciales inválidas.");
    }
    if (!data?.session) {
      throw new Error("No se recibió sesión. Revisá si tu cuenta requiere confirmar el email.");
    }
    setAuthStatus("Inicio de sesión correcto. Redirigiendo…", "success");
    setRegisterAuthStatus("");
    redirectToApp();
  } catch (err) {
    const message = authErrorMessage(err, "No se pudo iniciar sesión. Verificá tus datos.");
    setAuthStatus(message, "error");
  } finally {
    loginBtn.disabled = false;
    registerBtn.disabled = false;
  }
});

registerForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setAuthStatus("");
  setRegisterAuthStatus("");

  const email = String(registerEmailEl?.value || "").trim();
  const password = String(registerPasswordEl?.value || "");
  if (!email || !password) {
    setRegisterAuthStatus("Completá email y contraseña.", "error");
    return;
  }

  loginBtn.disabled = true;
  registerBtn.disabled = true;
  setRegisterAuthStatus("Creando cuenta…");

  try {
    if (!supabaseClient) throw new Error("Supabase no está configurado en el frontend.");
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw new Error(error.message);

    if (data?.session) {
      setAuthStatus("");
      setRegisterAuthStatus("Cuenta creada correctamente. Redirigiendo…", "success");
      redirectToApp();
      return;
    }

    const needsEmailConfirmation = !data?.session && !!data?.user;
    setRegisterAuthStatus(
      needsEmailConfirmation
        ? "Cuenta creada. Revisá tu email para confirmar la cuenta antes de iniciar sesión."
        : "Cuenta creada correctamente. Ya podés iniciar sesión.",
      "success"
    );
  } catch (err) {
    const message = authErrorMessage(err, "No se pudo registrar. Revisá los datos e intentá de nuevo.");
    setRegisterAuthStatus(message, "error");
  } finally {
    loginBtn.disabled = false;
    registerBtn.disabled = false;
  }
});

logoutBtn?.addEventListener("click", () => {
  if (!supabaseClient) {
    redirectToLogin();
    return;
  }
  supabaseClient.auth
    .signOut({ scope: "global" })
    .catch(() => {})
    .finally(() => {
      redirectToLogin();
    });
});

// Theme toggle (light/dark) - presentación solamente (persistido en localStorage).
const initialTheme = (() => {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
})();

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;

  try {
    localStorage.setItem("theme", next);
  } catch {
    /* ignore */
  }

  if (themeToggleBtnEl) {
    themeToggleBtnEl.textContent = next === "dark" ? "Modo claro" : "Modo oscuro";
  }

  // Si el dashboard está visible, refrescamos para que el chart capture colores.
  if (chartCanvas && listEl && emptyEl && expensesCache.length) {
    refreshExpenseView();
  }
}

applyTheme(initialTheme);

themeToggleBtnEl?.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(current);
});

// Sincroniza la presentación de moneda antes de renderizar la UI.
if (displayCurrencySelectEl?.value) {
  MONEY_CURRENCY = displayCurrencySelectEl.value;
}
syncDisplayCurrencyLabel();

displayCurrencySelectEl?.addEventListener("change", () => {
  if (!displayCurrencySelectEl.value) return;
  MONEY_CURRENCY = displayCurrencySelectEl.value;
  syncDisplayCurrencyLabel();
  if (appSection && listEl) refreshExpenseView();
});

if (toggleExpensesPanelBtn && expensesPanelEl) {
  toggleExpensesPanelBtn.setAttribute(
    "aria-expanded",
    String(!expensesPanelEl.hidden)
  );
  toggleExpensesPanelBtn.textContent = expensesPanelEl.hidden
    ? "Mostrar"
    : "Ocultar";

  toggleExpensesPanelBtn.addEventListener("click", () => {
    const willCollapse = !expensesPanelEl.hidden;
    expensesPanelEl.hidden = willCollapse;
    toggleExpensesPanelBtn.setAttribute(
      "aria-expanded",
      String(!willCollapse)
    );
    toggleExpensesPanelBtn.textContent = willCollapse ? "Mostrar" : "Ocultar";
  });
}

// Inicialización
if (!supabaseClient) {
  if (isLoginPage()) {
    setAuthStatus("Falta configurar Supabase en el frontend.", "error");
    setRegisterAuthStatus("Falta configurar Supabase en el frontend.", "error");
  } else {
    setStatus("Falta configurar Supabase en el frontend.", "error");
  }
} else {
  getSession()
    .then((session) => {
      handleSessionForCurrentPage(session);
    })
    .catch((err) => {
      console.error("getSession inicial:", err);
      if (isLoginPage()) {
        setAuthStatus("No se pudo comprobar la sesión. Probá recargar la página.", "error");
        setRegisterAuthStatus("No se pudo comprobar la sesión. Probá recargar la página.", "error");
      } else {
        setStatus("No se pudo comprobar la sesión. Probá recargar la página.", "error");
      }
    });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    handleSessionForCurrentPage(session || null);
  });
}


