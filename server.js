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
 * ✅ EXTRA: si el usuario está baneado (profiles.is_banned) lo bloquea.
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

    // ✅ Chequeo BAN (si profiles no existe, no rompe)
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("is_banned, ban_reason")
        .eq("id", req.user.id)
        .single();

      if (prof?.is_banned) {
        return res.status(403).json({
          success: false,
          message: `BANEADO: ${prof.ban_reason || "Sin motivo"}`,
        });
      }
    } catch (e) {}

    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Error validando usuario" });
  }
}

/**
 * ✅ Optional auth (para likes/dislikes sin obligar login).
 * Si hay token válido -> req.user
 * Si no -> req.user = null
 */
async function optionalUser(req, res, next) {
  req.user = null;
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return next();

    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (!error && data?.user) {
      req.user = data.user;

      // si está baneado, lo tratamos como "no user" (para no permitir notificar/accionar con ban)
      try {
        const { data: prof } = await supabaseAdmin
          .from("profiles")
          .select("is_banned")
          .eq("id", req.user.id)
          .single();
        if (prof?.is_banned) req.user = null;
      } catch (e) {}
    }
  } catch (e) {}
  next();
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
 * ================================
 * ✅ HELPERS NOTIFICATIONS (NUEVO)
 * ================================
 */

async function getProfileById(userId) {
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("username, profile_picture")
      .eq("id", userId)
      .single();
    return data || null;
  } catch (e) {
    return null;
  }
}

async function notifyGameOwner({ gameDir, ownerUsername, senderUsername, senderPicture, message }) {
  try {
    if (!ownerUsername) return;
    if (!senderUsername) return;

    // no notificarte a ti mismo
    if (ownerUsername === senderUsername) return;

    const url = `game.html?dir=${encodeURIComponent(gameDir)}`;

    const row = {
      target_username: ownerUsername,
      sender_username: senderUsername,
      sender_profile_picture: senderPicture || "Logo/user.png",
      message: message || "",
      url,
    };

    await supabaseAdmin.from("notifications").insert([row]);
  } catch (e) {
    console.warn("notifyGameOwner fail:", e?.message || e);
  }
}

/**
 * ✅ PROXY PLAY
 */
app.get("/play/:dir/*", async (req, res) => {
  try {
    const dir = req.params.dir;
    const rest = req.params[0] || "index.html";
    const fileRel = safeRelPath(rest);

    const objectPath = `games/${dir}/${fileRel}`;

    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(objectPath);
    if (error || !data) return res.status(404).send("Not found");

    const ab = await data.arrayBuffer();
    const buf = Buffer.from(ab);

    const isBr = fileRel.toLowerCase().endsWith(".br");
    let mimePath = fileRel;

    if (isBr) {
      res.setHeader("Content-Encoding", "br");
      mimePath = fileRel.slice(0, -3);
    }

    res.setHeader("Content-Type", guessMime(mimePath));
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

    return res.status(200).send(buf);
  } catch (err) {
    console.error("PLAY ERROR:", err);
    res.status(500).send("Server error");
  }
});

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
          const url = await uploadBuffer(
            BUCKET,
            `screenshots/${dir}/${Date.now()}-${f.originalname}`,
            f.buffer,
            f.mimetype
          );
          screenshots.push(url);
        }
      }

      // 3) Downloadable
      let downloadable_url = null;
      if (req.files?.downloadableFile?.[0]) {
        const f = req.files.downloadableFile[0];
        downloadable_url = await uploadBuffer(
          BUCKET,
          `downloads/${dir}/${Date.now()}-${f.originalname}`,
          f.buffer,
          f.mimetype
        );
      }

      // 4) Build Web ZIP
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

        index_url = `/play/${dir}/index.html`;
      }

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

    const { data: game, error: getErr } = await supabaseAdmin.from("games").select("id, owner_id").eq("dir", dir).single();

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
 *
 * ✅ NUEVO: Notifica al owner en likes/dislikes si hay usuario logueado (token).
 */
app.post("/game/:dir/interact", optionalUser, async (req, res) => {
  try {
    const dir = req.params.dir;
    const type = (req.body?.type || "").toString();

    const { data: game, error } = await supabaseAdmin
      .from("games")
      .select("dir, name, owner_username, likes, dislikes, views")
      .eq("dir", dir)
      .single();

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

    // ✅ Notificaciones SOLO en like/dislike y solo si hay usuario logueado
    if ((type === "like" || type === "dislike") && req.user) {
      const senderProfile = await getProfileById(req.user.id);
      const senderUsername = senderProfile?.username || (req.user.email || "user");
      const senderPic = senderProfile?.profile_picture || "Logo/user.png";

      const msg =
        type === "like"
          ? `@${senderUsername} le dio ❤️ Like a tu juego: ${game.name}`
          : `@${senderUsername} le dio 👎 Dislike a tu juego: ${game.name}`;

      await notifyGameOwner({
        gameDir: dir,
        ownerUsername: game.owner_username,
        senderUsername,
        senderPicture: senderPic,
        message: msg,
      });
    }

    res.json({ success: true, game: updated });
  } catch (err) {
    console.error("INTERACT ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

//
// =====================================================
// ✅ COMMENTS (Supabase table: comments)
// ✅ NUEVO: notifica al dueño cuando comentan
// =====================================================
//

/**
 * GET /comments/:dir  (público)
 */
app.get("/comments/:dir", async (req, res) => {
  try {
    const dir = req.params.dir;
    const { data, error } = await supabaseAuth
      .from("comments")
      .select("*")
      .eq("game_dir", dir)
      .order("created_at", { ascending: true });

    if (error) throw error;
    res.json({ success: true, comments: data || [] });
  } catch (err) {
    console.error("GET COMMENTS ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

/**
 * POST /comments/:dir  (requiere login)
 * body: { comment: "..." }
 */
app.post("/comments/:dir", requireUser, async (req, res) => {
  try {
    const dir = req.params.dir;
    const text = (req.body?.comment || "").toString().trim();
    if (!text) return res.status(400).json({ success: false, message: "Comentario vacío" });

    const senderProfile = await getProfileById(req.user.id);
    const username = senderProfile?.username || (req.user.email || "user");
    const senderPic = senderProfile?.profile_picture || "Logo/user.png";

    const payload = { game_dir: dir, username, comment: text };
    const { data: insertedComment, error } = await supabaseAdmin.from("comments").insert([payload]).select().single();
    if (error) throw error;

    // ✅ buscar el juego para saber owner
    const { data: game } = await supabaseAdmin
      .from("games")
      .select("name, owner_username")
      .eq("dir", dir)
      .single();

    if (game?.owner_username) {
      // recorta el comentario en el preview
      const preview = text.length > 80 ? text.slice(0, 80) + "…" : text;
      const msg = `@${username} comentó en tu juego: ${game.name} — “${preview}”`;

      await notifyGameOwner({
        gameDir: dir,
        ownerUsername: game.owner_username,
        senderUsername: username,
        senderPicture: senderPic,
        message: msg,
      });
    }

    res.json({ success: true, comment: insertedComment });
  } catch (err) {
    console.error("POST COMMENT ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

//
// =====================================================
// ✅ REPORTS (Supabase table: reports)
// =====================================================
//

/**
 * POST /report
 * body: { gameDir, reportedUser, reportedBy, reason }
 */
app.post("/report", async (req, res) => {
  try {
    const gameDir = (req.body?.gameDir || "").toString().trim();
    const reason = (req.body?.reason || "").toString().trim();
    const reportedUser = (req.body?.reportedUser || "").toString().trim() || null;
    const reportedBy = (req.body?.reportedBy || "").toString().trim() || null;

    if (!gameDir) return res.status(400).json({ success: false, message: "Falta gameDir" });
    if (!reason) return res.status(400).json({ success: false, message: "Falta reason" });

    const payload = { game_dir: gameDir, reported_user: reportedUser, reported_by: reportedBy, reason };
    const { data, error } = await supabaseAdmin.from("reports").insert([payload]).select().single();
    if (error) throw error;

    res.json({ success: true, report: data });
  } catch (err) {
    console.error("REPORT ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

/**
 * GET /reports (admin panel)
 */
app.get("/reports", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from("reports").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error("GET REPORTS ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

/**
 * DELETE /reports/:id
 */
app.delete("/reports/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabaseAdmin.from("reports").delete().eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE REPORT ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

//
// =====================================================
// ✅ NOTIFICATIONS (Supabase table: notifications)
// =====================================================
//

/**
 * GET /notifications/:username
 */
app.get("/notifications/:username", async (req, res) => {
  try {
    const username = (req.params.username || "").toString();
    if (!username) return res.json({ notifications: [] });

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("target_username", username)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const notifications = (data || []).map((n) => ({
      id: n.id,
      senderUsername: n.sender_username,
      profilePicture: n.sender_profile_picture || "Logo/user.png",
      message: n.message,
      url: n.url,
      created_at: n.created_at,
    }));

    res.json({ notifications });
  } catch (err) {
    console.error("GET NOTIFS ERROR:", err);
    res.status(500).json({ notifications: [] });
  }
});

/**
 * DELETE /notifications/:username
 */
app.delete("/notifications/:username", async (req, res) => {
  try {
    const username = (req.params.username || "").toString();
    if (!username) return res.json({ success: true });

    const { error } = await supabaseAdmin.from("notifications").delete().eq("target_username", username);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE NOTIFS ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

/**
 * POST /send_notification
 * body: { users: [username], message: "..." }
 */
app.post("/send_notification", async (req, res) => {
  try {
    const users = Array.isArray(req.body?.users) ? req.body.users : [];
    const message = (req.body?.message || "").toString().trim();
    if (!users.length) return res.status(400).json({ success: false, message: "users vacío" });
    if (!message) return res.status(400).json({ success: false, message: "message vacío" });

    const rows = users.map((u) => ({
      target_username: String(u),
      sender_username: "Administración",
      sender_profile_picture: "Logo/user.png",
      message,
      url: "index.html",
    }));

    const { error } = await supabaseAdmin.from("notifications").insert(rows);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("SEND NOTIF ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

//
// =====================================================
// ✅ USERS (admin panel) + BAN / UNBAN  (profiles.is_banned)
// =====================================================
//

/**
 * GET /users
 */
app.get("/users", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("username, email, is_banned, ban_reason, banned_at, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const out = (data || []).map((u) => ({
      username: u.username,
      email: u.email || "",
      banned: !!u.is_banned,
      ban_reason: u.ban_reason || "",
      banned_at: u.banned_at || null,
    }));

    res.json(out);
  } catch (err) {
    console.error("GET USERS ERROR:", err);
    res.status(500).json([]);
  }
});

/**
 * POST /ban_user
 * body: { users: [username], reason: "..." }
 */
app.post("/ban_user", async (req, res) => {
  try {
    const users = Array.isArray(req.body?.users) ? req.body.users : [];
    const reason = (req.body?.reason || "").toString().trim();

    if (!users.length) return res.status(400).json({ success: false, message: "users vacío" });
    if (!reason) return res.status(400).json({ success: false, message: "reason vacío" });

    const { data: profs, error: pErr } = await supabaseAdmin.from("profiles").select("id, username").in("username", users);
    if (pErr) throw pErr;

    const nowISO = new Date().toISOString();

    for (const p of profs || []) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(p.id, { ban_duration: "87600h" });
      } catch (e) {
        console.warn("Auth ban fail:", p.username, e?.message || e);
      }

      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ is_banned: true, ban_reason: reason, banned_at: nowISO })
        .eq("id", p.id);

      if (upErr) console.warn("Profile ban mark fail:", p.username, upErr?.message || upErr);

      await supabaseAdmin.from("notifications").insert([
        {
          target_username: p.username,
          sender_username: "Administración",
          sender_profile_picture: "Logo/user.png",
          message: `Has sido baneado. Motivo: ${reason}`,
          url: "index.html",
        },
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("BAN USER ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

/**
 * POST /unban_user
 * body: { users: [username] }
 */
app.post("/unban_user", async (req, res) => {
  try {
    const users = Array.isArray(req.body?.users) ? req.body.users : [];
    if (!users.length) return res.status(400).json({ success: false, message: "users vacío" });

    const { data: profs, error: pErr } = await supabaseAdmin.from("profiles").select("id, username").in("username", users);
    if (pErr) throw pErr;

    for (const p of profs || []) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(p.id, { ban_duration: "none" });
      } catch (e) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(p.id, { ban_duration: null });
        } catch (e2) {
          console.warn("Auth unban fail:", p.username, e2?.message || e2);
        }
      }

      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update({ is_banned: false, ban_reason: null, banned_at: null })
        .eq("id", p.id);

      if (upErr) console.warn("Profile unban mark fail:", p.username, upErr?.message || upErr);

      await supabaseAdmin.from("notifications").insert([
        {
          target_username: p.username,
          sender_username: "Administración",
          sender_profile_picture: "Logo/user.png",
          message: `Tu ban fue removido. Ya puedes usar CGPlay.`,
          url: "index.html",
        },
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("UNBAN USER ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

//
// =====================================================
// ✅ DELETE ME (profile.js ya lo llama)
// =====================================================
//

app.delete("/delete_me", requireUser, async (req, res) => {
  try {
    const user = req.user;

    const { data: myGames, error: gErr } = await supabaseAdmin.from("games").select("dir").eq("owner_id", user.id);
    if (gErr) throw gErr;

    for (const g of myGames || []) {
      const dir = g.dir;
      await removePrefixRecursive(`covers/${dir}`);
      await removePrefixRecursive(`screenshots/${dir}`);
      await removePrefixRecursive(`downloads/${dir}`);
      await removePrefixRecursive(`games/${dir}`);

      await supabaseAdmin.from("games").delete().eq("dir", dir);
      await supabaseAdmin.from("comments").delete().eq("game_dir", dir);
      await supabaseAdmin.from("reports").delete().eq("game_dir", dir);
    }

    const { data: prof } = await supabaseAdmin.from("profiles").select("username").eq("id", user.id).single();
    const username = prof?.username || null;

    if (username) {
      await supabaseAdmin.from("notifications").delete().eq("target_username", username);
    }

    await supabaseAdmin.from("profiles").delete().eq("id", user.id);
    await supabaseAdmin.auth.admin.deleteUser(user.id);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ME ERROR:", err);
    res.status(500).json({ success: false, message: String(err?.message || err) });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(port, () => {
  console.log(`✅ Servidor listo: http://localhost:${port}`);
});
