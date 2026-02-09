// public/profile.js
document.addEventListener("DOMContentLoaded", async () => {
  const sessionUser = localStorage.getItem("username");
  const guest = localStorage.getItem("guest");

  const $ = (id) => document.getElementById(id);

  // ===== DEFAULT AVATAR (internet) =====
  const DEFAULT_AVATAR =
    "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }

  // ===== Resolve profile user =====
  const params = new URLSearchParams(window.location.search);
  const profileUser = (params.get("user") || sessionUser || "").trim();

  if (!profileUser) {
    window.location.href = "index.html";
    return;
  }

  // ===== Header menu =====
  const profileLink = $("profileLink");
  const uploadLink = $("uploadLink");
  const logoutButton = $("logoutButton");
  const userMenuContainer = $("userMenuContainer");

  if (userMenuContainer) userMenuContainer.innerHTML = "";

  if (sessionUser) {
    const a = document.createElement("a");
    a.href = `profile.html?user=${encodeURIComponent(sessionUser)}`;
    a.textContent = sessionUser;

    const li = document.createElement("li");
    li.appendChild(a);
    userMenuContainer.appendChild(li);

    if (logoutButton) {
      logoutButton.style.display = "block";
      logoutButton.onclick = async () => {
        try {
          if (window.sb) await window.sb.auth.signOut();
        } catch (e) {}
        localStorage.removeItem("username");
        localStorage.removeItem("guest");
        window.location.href = "login.html";
      };
    }

    if (profileLink) profileLink.style.display = "block";
    if (uploadLink) uploadLink.style.display = "block";
  } else {
    if (profileLink) profileLink.style.display = "none";
    if (uploadLink) uploadLink.style.display = "none";
    if (logoutButton) logoutButton.style.display = "none";
  }

  // ===== Own profile? =====
  const isOwnProfile =
    !!sessionUser && sessionUser.toLowerCase() === profileUser.toLowerCase();

  const editBtn = $("editProfileButton");
  const deleteBtn = $("deleteAccountButton");

  if (editBtn) editBtn.style.display = isOwnProfile ? "inline-flex" : "none";
  if (deleteBtn) deleteBtn.style.display = isOwnProfile ? "inline-flex" : "none";

  // ===== Load profile from Supabase =====
  async function loadProfileFromSupabase(username) {
    try {
      if (!window.sb) return null;

      const { data, error } = await window.sb
        .from("profiles")
        .select("username, phone, description, profile_picture, email")
        .eq("username", username)
        .single();

      if (error) return null;
      return data || null;
    } catch (e) {
      console.warn("loadProfileFromSupabase error:", e);
      return null;
    }
  }

  const prof = await loadProfileFromSupabase(profileUser);

  // ===== Paint profile data =====
  setText("username", profileUser);
  setText("phone", prof?.phone || "");
  setText("email", prof?.email || "");
  setText("description", prof?.description || "");

  // ===== Avatar fallback (IMPORTANT) =====
  const pic = $("profilePicture");
  if (pic) {
    const url = (prof?.profile_picture || "").trim();

    // si está vacío => default
    pic.src = url ? url : DEFAULT_AVATAR;

    // si la url falla => default
    pic.onerror = () => {
      pic.onerror = null;
      pic.src = DEFAULT_AVATAR;
    };
  }

  // ===== Load games from your server =====
  async function loadAllGames() {
    try {
      const r = await fetch("/games");
      const j = await r.json();
      return Array.isArray(j) ? j : [];
    } catch (e) {
      console.error("loadAllGames error:", e);
      return [];
    }
  }

  const allGames = await loadAllGames();
  const userGames = allGames.filter((g) => {
    const owner = (g.owner_username || "").toString().trim();
    return owner.toLowerCase() === profileUser.toLowerCase();
  });

  // ===== Sum likes/dislikes/views =====
  const totalLikes = userGames.reduce((a, g) => a + (Number(g.likes) || 0), 0);
  const totalDislikes = userGames.reduce(
    (a, g) => a + (Number(g.dislikes) || 0),
    0
  );
  const totalViews = userGames.reduce((a, g) => a + (Number(g.views) || 0), 0);

  setText("likeCount", totalLikes);
  setText("dislikeCount", totalDislikes);
  setText("viewCount", totalViews);

  // ===== Count comments for user's games =====
  async function countCommentsForDirs(dirs) {
    try {
      if (!dirs.length) return 0;
      if (!window.sb) return 0;

      const { count, error } = await window.sb
        .from("comments")
        .select("id", { count: "exact", head: true })
        .in("game_dir", dirs);

      if (error) return 0;
      return Number(count) || 0;
    } catch (e) {
      console.warn("countCommentsForDirs error:", e);
      return 0;
    }
  }

  const dirs = userGames.map((g) => g.dir).filter(Boolean);
  const totalComments = await countCommentsForDirs(dirs);
  setText("commentCount", totalComments);

  // ===== Render user games list =====
  const ul = $("userGames");
  if (ul) {
    ul.innerHTML = "";

    if (!userGames.length) {
      ul.innerHTML = `<li style="padding:12px;opacity:.7;border:1px solid rgba(255,255,255,0.10);border-radius:12px;background:rgba(255,255,255,0.02);">
        Este usuario no tiene juegos publicados todavía.
      </li>`;
    } else {
      userGames.forEach((g) => {
        const li = document.createElement("li");
        const dir = g.dir || "";
        const name = g.name || "Sin nombre";
        const cover = (g.cover_url || "").trim();

        li.innerHTML = `
          <a href="game.html?dir=${encodeURIComponent(dir)}">
            ${
              cover
                ? `<img src="${esc(cover)}" alt="" style="width:100%;height:130px;object-fit:cover;display:block;border-bottom:1px solid rgba(255,255,255,0.08);" onerror="this.style.display='none'">`
                : ""
            }
            <h4>${esc(name)}</h4>
            <div style="padding:0 12px 12px;opacity:.75;font-size:12px;display:flex;gap:10px;flex-wrap:wrap;">
              <span>👍 ${Number(g.likes) || 0}</span>
              <span>👎 ${Number(g.dislikes) || 0}</span>
              <span>👁️ ${Number(g.views) || 0}</span>
            </div>
          </a>
        `;
        ul.appendChild(li);
      });
    }
  }

  // ===== Edit profile (NO ALERT / NO placeholder) =====
  if (editBtn && isOwnProfile) {
    editBtn.onclick = () => {
      // ✅ CAMBIA ESTE NOMBRE SI TU EDITOR SE LLAMA DIFERENTE:
      window.location.href = "edit_profile.html";
      // Ej: "EditProfile.html" o "edit_profile.html" etc.
    };
  }

  // ===== Delete account =====
  if (deleteBtn && isOwnProfile) {
    deleteBtn.onclick = async () => {
      if (!confirm("¿Seguro que quieres eliminar tu cuenta y todo tu contenido?"))
        return;

      try {
        if (!window.sb) {
          alert("Falta Supabase en el front.");
          return;
        }

        const { data } = await window.sb.auth.getSession();
        const token = data?.session?.access_token;

        if (!token) {
          alert("No hay sesión/token. Vuelve a loguearte.");
          return;
        }

        const r = await fetch("/delete_me", {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          alert(j.message || "Error eliminando tu cuenta");
          return;
        }

        alert("Cuenta eliminada.");
        localStorage.removeItem("username");
        localStorage.removeItem("guest");
        window.location.href = "index.html";
      } catch (e) {
        console.error(e);
        alert("Error eliminando tu cuenta");
      }
    };
  }
});
