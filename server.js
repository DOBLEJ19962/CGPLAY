// server.js
// Express + Supabase (Auth JWT + Postgres + Storage) + Upload ZIP Unity WebGL
// Bucket único: cgpbucket
//
// npm i express multer compression unzipper dotenv @supabase/supabase-js
//
// .env:
// SUPABASE_URL=...
// SUPABASE_ANON_KEY=...
// SUPABASE_SERVICE_ROLE_KEY=...
// PORT=3000

require("dotenv").config();

const express = require("express");
const path = require("path");
const multer = require("multer");
const compression = require("compression");
const unzipper = require("unzipper");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const port = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Falta .env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const BUCKET = "cgpbucket";

// Supabase clients
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static front
app.use(express.static(path.join(__dirname, "public")));

// Unity WebGL: COOP/COEP (threads/wasm)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});

// Multer in-memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 }, // 300MB
});

/**
 * Auth middleware: expects Authorization: Bearer <access_token>
 */
async function requireUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Falta Authorization: Bearer <token>" });
    }

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ success: false, message: "Token inválido" });
    }

    req.user = data.user;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error validando usuario" });
  }
}

function safeDirName(gameName) {
  const clean = String(gameName || "game")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "");
  return `${Date.now()}-${clean || "game"}`;
}

function safeRelPath(p) {
  return String(p || "")
    .replace(/^(\.\.[/\\])+/, "")
    .replace(/^[/\\]+/, "")
    .replace(/\\/g, "/");
}

// 👇 IMPORTANT: Unity usa .br; el Content-Type debe ser el de "sin .br"
function guessMime(filePath) {
  const p = (filePath || "").toLowerCase();
  if (p.endsWith(".html")) return "text/html; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".wasm")) return "application/wasm";
  if (p.endsWith(".data")) return "application/octet-stream";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".mp4")) return "video/mp4";
  if (p.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

async function uploadBuffer(bucket, objectPath, buffer, contentType) {
  const { error } = await supabaseAdmin.storage.from(bucket).upload(objectPath, buffer, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

// ✅ Borra recursivo
async function removePrefixRecursive(prefix) {
  async function walk(folder) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(folder, {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

    if (error) throw error;
    if (!data || data.length === 0) return;

    const filesToRemove = [];
    const subfolders = [];

    for (const item of data) {
      if (!item?.name) continue;
      const isFolder = item.id == null && item.metadata == null;
      if (isFolder) subfolders.push(`${folder}/${item.name}`);
      else filesToRemove.push(`${folder}/${item.name}`);
    }

    if (filesToRemove.length) {
      const { error: remErr } = await supabaseAdmin.storage.from(BUCKET).remove(filesToRemove);
      if (remErr) throw remErr;
    }

    for (const sf of subfolders) await walk(sf);

    const { data: again } = await supabaseAdmin.storage.from(BUCKET).list(folder, { limit: 1000, offset: 0 });
    const leftover = (again || []).map((x) => `${folder}/${x.name}`);
    if (leftover.length) {
      const { error: rem2 } = await supabaseAdmin.storage.from(BUCKET).remove(leftover);
      if (rem2) throw rem2;
    }
  }

  await walk(prefix);
}

/**
 * ✅ PROXY PLAY
 * Sirve archivos del build Unity WebGL desde TU DOMINIO:
 * /play/<dir>/index.html
 * /play/<dir>/Build/xxx.loader.js
 * /play/<dir>/Build/xxx.wasm.br
 */
app.get("/play/:dir/*", async (req, res) => {
  try {
    const dir = req.params.dir;
    const rest = req.params[0] || "index.html"; // lo que viene después de /play/:dir/
    const fileRel = safeRelPath(rest);

    const objectPath = `games/${dir}/${fileRel}`;

    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(objectPath);
    if (error || !data) {
      return res.status(404).send("Not found");
    }

    // data es Blob en supabase-js v2
    const ab = await data.arrayBuffer();
    const buf = Buffer.from(ab);

    // Headers correctos para Unity + .br
    const isBr = fileRel.toLowerCase().endsWith(".br");
    let mimePath = fileRel;

    if (isBr) {
      res.setHeader("Content-Encoding", "br");
      // quitar ".br" para el mime real
      mimePath = fileRel.slice(0, -3);
    }

    res.setHeader("Content-Type", guessMime(mimePath));
    res.setHeader("Cache-Control", "public, max-age=3600");

    // Para COEP require-corp (mismo origen ya ayuda, pero esto evita dramas)
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    return res.status(200).send(buf);
  } catch (err) {
    console.error("PLAY ERROR:", err);
    res.status(500).send("Server error");
  }
});

// (opcional) si alguien entra /play/dir sin archivo
app.get("/play/:dir", (req, res) => {
  res.redirect(`/play/${req.params.dir}/index.html`);
});

/**
 * POST /upload
 */
app.post(
  "/upload",
  requireUser,
  upload.fields([
    { name: "gameFile", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
    { name: "screenshots", maxCount: 10 },
    { name: "downloadableFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const user = req.user;
      const gameName = req.body.gameName;
      if (!gameName) return res.status(400).json({ success: false, message: "Falta gameName" });

      const dir = safeDirName(gameName);

      // 1) Cover
      let cover_url = null;
      if (req.files?.coverImage?.[0]) {
        const f = req.files.coverImage[0];
        cover_url = await uploadBuffer(BUCKET, `covers/${dir}/${Date.now()}-${f.originalname}`, f.buffer, f.mimetype);
      }

      // 2) Screenshots
      const screenshots = [];
      if (req.files?.screenshots?.length) {
        for (const f of req.files.screenshots) {
          const url = await uploadBuffer(BUCKET, `screenshots/${dir}/${Date.now()}-${f.originalname}`, f.buffer, f.mimetype);
          screenshots.push(url);
        }
      }

      // 3) Downloadable
      let downloadable_url = null;
      if (req.files?.downloadableFile?.[0]) {
        const f = req.files.downloadableFile[0];
        downloadable_url = await uploadBuffer(BUCKET, `downloads/${dir}/${Date.now()}-${f.originalname}`, f.buffer, f.mimetype);
      }

      // 4) Build Web ZIP -> subir cada archivo a storage
      // y guardamos index_url como /play/<dir>/index.html (NO el publicUrl)
      let index_url = null;

      if (req.files?.gameFile?.[0]) {
        const zipBuffer = req.files.gameFile[0].buffer;
        const directory = await unzipper.Open.buffer(zipBuffer);

        for (const file of directory.files) {
          if (file.type !== "File") continue;

          const rel = safeRelPath(file.path);
          if (!rel) continue;
          if (rel.includes("..")) continue;

          const objectPath = `games/${dir}/${rel}`;
          const contentType = guessMime(rel.endsWith(".br") ? rel.slice(0, -3) : rel);

          const content = await file.buffer();
          await uploadBuffer(BUCKET, objectPath, content, contentType);
        }

        // 👇 importante: reproducimos desde el proxy en tu dominio
        index_url = `/play/${dir}/index.html`;
      }

      // owner_username: si tu front manda username ok, si no usa email
      let owner_username = (req.body.username || user.email || "user").toString();

      const payload = {
        owner_id: user.id,
        owner_username,
        name: gameName,
        description: req.body.gameDescription || "",
        platform: req.body.platform || null,
        genre: req.body.genre || null,
        engine: req.body.engine || null,
        dir,
        cover_url,
        index_url,
        downloadable_url,
        screenshots,
      };

      const { data: inserted, error } = await supabaseAdmin.from("games").insert([payload]).select().single();
      if (error) throw error;

      res.json({ success: true, game: inserted });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ success: false, message: String(err?.message || err) });
    }
  }
);

/**
 * GET /games (público)
 */
app.get("/games", async (req, res) => {
  try {
    const { data, error } = await supabaseAuth.from("games").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

/**
 * GET /games/:dir (público) - 1 juego
 */
app.get("/games/:dir", async (req, res) => {
  try {
    const dir = req.params.dir;
    const { data, error } = await supabaseAuth.from("games").select("*").eq("dir", dir).single();
    if (error || !data) return res.status(404).json({ success: false, message: "Juego no encontrado" });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

/**
 * DELETE /games/:dir (solo dueño)
 */
app.delete("/games/:dir", requireUser, async (req, res) => {
  try {
    const dir = req.params.dir;
    const user = req.user;

    const { data: game, error: getErr } = await supabaseAdmin
      .from("games")
      .select("id, owner_id")
      .eq("dir", dir)
      .single();

    if (getErr) return res.status(404).json({ success: false, message: "Juego no encontrado" });
    if (game.owner_id !== user.id) return res.status(403).json({ success: false, message: "No autorizado" });

    await removePrefixRecursive(`covers/${dir}`);
    await removePrefixRecursive(`screenshots/${dir}`);
    await removePrefixRecursive(`downloads/${dir}`);
    await removePrefixRecursive(`games/${dir}`);

    const { error: delErr } = await supabaseAdmin.from("games").delete().eq("dir", dir);
    if (delErr) throw delErr;

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE GAME ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

/**
 * POST /game/:dir/interact
 * body: { type: "like" | "dislike" | "view" }
 */
app.post("/game/:dir/interact", async (req, res) => {
  try {
    const dir = req.params.dir;
    const type = (req.body?.type || "").toString();

    const { data: game, error } = await supabaseAdmin.from("games").select("*").eq("dir", dir).single();
    if (error || !game) return res.status(404).json({ success: false, message: "Juego no encontrado" });

    const patch = {};
    if (type === "like") patch.likes = (game.likes || 0) + 1;
    else if (type === "dislike") patch.dislikes = (game.dislikes || 0) + 1;
    else if (type === "view") patch.views = (game.views || 0) + 1;
    else return res.status(400).json({ success: false, message: "type inválido" });

    const { data: updated, error: upErr } = await supabaseAdmin
      .from("games")
      .update(patch)
      .eq("dir", dir)
      .select()
      .single();

    if (upErr) throw upErr;
    res.json({ success: true, game: updated });
  } catch (err) {
    console.error("INTERACT ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`✅ Servidor listo: http://localhost:${port}`);
});
