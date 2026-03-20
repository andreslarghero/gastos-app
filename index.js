require("dotenv").config();

const express = require("express");
const path = require("path");
const supabase = require("./supabaseClient");

const app = express();
app.use(express.json());

app.get("/app-config.js", (_req, res) => {
  const appConfig = {
    apiBaseUrl: process.env.PUBLIC_API_BASE_URL || "",
    supabaseUrl: process.env.PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: process.env.PUBLIC_SUPABASE_ANON_KEY || "",
  };

  res.type("application/javascript");
  res.send(`window.__APP_CONFIG__ = ${JSON.stringify(appConfig)};`);
});

app.use(express.static(path.join(__dirname, "public")));

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "No autorizado." });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ ok: false, error: "Sesión inválida." });
    }

    req.user = data.user;
    return next();
  } catch (err) {
    console.error("requireAuth error:", err);
    return res.status(500).json({
      ok: false,
      error: "Error inesperado del servidor.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
}

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get("/", (_req, res) => {
  res.status(200).sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Email inválido." });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        ok: false,
        error: "La contraseña debe tener al menos 6 caracteres.",
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      return res.status(400).json({
        ok: false,
        error: "No se pudo registrar.",
        details: error.message,
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Error inesperado del servidor.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || email.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Email inválido." });
    }
    if (typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ ok: false, error: "Contraseña inválida." });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return res.status(401).json({
        ok: false,
        error: "No se pudo iniciar sesión.",
        details: error.message,
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Error inesperado del servidor.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.post("/expenses", requireAuth, async (req, res) => {
  try {
    const { amount, category, description } = req.body ?? {};

    const parsedAmount =
      typeof amount === "number"
        ? amount
        : typeof amount === "string"
          ? Number(amount)
          : NaN;

    if (!Number.isFinite(parsedAmount)) {
      return res.status(400).json({
        ok: false,
        error: "Monto inválido. Debe ser un número.",
      });
    }

    if (parsedAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto debe ser mayor a 0.",
      });
    }

    if (typeof category !== "string" || category.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Categoría inválida. No puede estar vacía.",
      });
    }

    if (
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Descripción inválida. No puede estar vacía.",
      });
    }

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        user_id: req.user.id,
        amount: parsedAmount,
        category: category.trim(),
        description: description.trim(),
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "No se pudo crear el gasto.",
        details: error.message,
      });
    }

    return res.status(201).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Error inesperado del servidor.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.put("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "ID de gasto inválido." });
    }

    const { amount, category, description } = req.body ?? {};

    const parsedAmount =
      typeof amount === "number"
        ? amount
        : typeof amount === "string"
          ? Number(amount)
          : NaN;

    if (!Number.isFinite(parsedAmount)) {
      return res.status(400).json({
        ok: false,
        error: "Monto inválido. Debe ser un número.",
      });
    }

    if (parsedAmount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "El monto debe ser mayor a 0.",
      });
    }

    if (typeof category !== "string" || category.trim().length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Categoría inválida. No puede estar vacía.",
      });
    }

    if (
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Descripción inválida. No puede estar vacía.",
      });
    }

    const { data, error } = await supabase
      .from("expenses")
      .update({
        amount: parsedAmount,
        category: category.trim(),
        description: description.trim(),
      })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("*")
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "No se pudo actualizar el gasto.",
        details: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({ ok: false, error: "Gasto no encontrado." });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Error inesperado del servidor.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/expenses", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("user_id", req.user.id)
      .order("date", { ascending: false });

    if (error) {
      console.error("GET /expenses supabase error:", error);
      return res.status(500).json({
        ok: false,
        error: "No se pudieron cargar los gastos.",
        details: error.message,
      });
    }

    const expenses = Array.isArray(data) ? data : [];
    return res.status(200).json({ ok: true, data: expenses });
  } catch (err) {
    console.error("GET /expenses unexpected error:", err);
    return res.status(500).json({
      ok: false,
      error: "Error inesperado del servidor.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.delete("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: "ID de gasto inválido." });
    }

    const { data, error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "No se pudo eliminar el gasto.",
        details: error.message,
      });
    }

    if (!data) {
      return res.status(404).json({ ok: false, error: "Gasto no encontrado." });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Error inesperado del servidor.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/test-db", async (_req, res) => {
  try {
    const { data, error } = await supabase.from("expenses").select("*");

    if (error) {
      return res.status(500).json({
        ok: false,
        error: "Failed to fetch expenses.",
        details: error.message,
      });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Unexpected server error.",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

const port = Number(process.env.PORT) || 3001;

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

