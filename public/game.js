// public/game.js
document.addEventListener("DOMContentLoaded", async () => {
  const sessionUser = localStorage.getItem("username");
  const guest = localStorage.getItem("guest");

  const profileLink = document.getElementById("profileLink");
  const uploadLink = document.getElementById("uploadLink");
  const logoutButton = document.getElementById("logoutButton");
  const userMenuContainer = document.getElementById("userMenuContainer");

  const deleteButton = document.getElementById("deleteButton");
  const playButton = document.getElementById("playButton");
  const gameIframe = document.getElementById("gameIframe");
  const reportButton = document.getElementById("reportButton");
  const favoriteButton = document.getElementById("favoriteButton");

  // Comments UI
  const commentList = document.getElementById("commentList");
  const commentInput = document.getElementById("commentInput");
  const commentButton = document.getElementById("commentButton");

  // Menu user
  userMenuContainer.innerHTML = "";

  if (sessionUser) {
    const a = document.createElement("a");
    a.href = `profile.html?user=${encodeURIComponent(sessionUser)}`;
    a.textContent = sessionUser;

    const li = document.createElement("li");
    li.appendChild(a);
    userMenuContainer.appendChild(li);

    logoutButton.addEventListener("click", async () => {
      try {
        if (window.sb) await window.sb.auth.signOut();
      } catch (e) {}
      localStorage.removeItem("username");
      localStorage.removeItem("guest");
      window.location.href = "login.html";
    });

    profileLink.style.display = "block";
    uploadLink.style.display = "block";
    logoutButton.style.display = "block";
  } else if (guest) {
    const a = document.createElement("a");
    a.href = "login.html";
    a.textContent = "Login";

    const li = document.createElement("li");
    li.appendChild(a);
    userMenuContainer.appendChild(li);

    profileLink.style.display = "none";
    uploadLink.style.display = "none";
    logoutButton.style.display = "none";
  } else {
    const a = document.createElement("a");
    a.href = "login.html";
    a.textContent = "Login";

    const li = document.createElement("li");
    li.appendChild(a);
    userMenuContainer.appendChild(li);

    profileLink.style.display = "none";
    uploadLink.style.display = "none";
    logoutButton.style.display = "none";
  }

  // Dir
  const urlParams = new URLSearchParams(window.location.search);
  const dir = urlParams.get("dir");
  if (!dir) {
    alert("No se especificó ningún juego.");
    window.location.href = "index.html";
    return;
  }

  // =========================
  // ✅ TOKEN helper (NUEVO)
  // =========================
  async function getTokenOrNull() {
    try {
      if (!window.sb) return null;
      const { data } = await window.sb.auth.getSession();
      return data?.session?.access_token || null;
    } catch (e) {
      return null;
    }
  }

  // ✅ View count (una vista al abrir)
  interactWithGame("view");

  // ✅ 1 SOLO juego
  fetch(`/games/${encodeURIComponent(dir)}`)
    .then((r) => {
      if (!r.ok) throw new Error("Juego no encontrado");
      return r.json();
    })
    .then(async (game) => {
      const cover = game.cover_url || "";
      const owner = game.owner_username || "user";
      const download = game.downloadable_url || "#";
      const shots = Array.isArray(game.screenshots) ? game.screenshots : [];

      const playUrl = `/play/${dir}/index.html`;

      // Pintar detalles
      document.getElementById("gameScreenshot").src = cover;
      document.getElementById("gameName").textContent = game.name || "";
      document.getElementById("gameDescription").textContent = game.description || "";
      document.getElementById("gamePlatform").textContent = game.platform || "";
      document.getElementById("gameGenre").textContent = game.genre || "";
      document.getElementById("gameEngine").textContent = game.engine || "";

      document.getElementById("uploadedBy").innerHTML =
        `<a href="profile.html?user=${encodeURIComponent(owner)}">${owner}</a>`;

      document.getElementById("downloadLink").href = download;

      document.getElementById("likeCount").textContent = game.likes || 0;
      document.getElementById("dislikeCount").textContent = game.dislikes || 0;
      document.getElementById("viewCount").textContent = game.views || 0;

      // Play Web (itch style)
      playButton.style.display = "block";
      playButton.onclick = () => togglePlayGame(playUrl);

      // Delete solo dueño (por username)
      if (sessionUser && sessionUser === owner) {
        deleteButton.style.display = "block";
        deleteButton.onclick = () => {
          if (confirm("¿Estás seguro de que deseas eliminar el juego?")) {
            deleteGame(game.dir);
          }
        };
      } else {
        deleteButton.style.display = "none";
      }

      // Report
      reportButton.onclick = () => {
        const reason = prompt("Escribe el motivo del reporte:");
        if (reason) reportGame(game.dir, owner, sessionUser || "guest", reason);
      };

      // Screenshots
      const screenshotGallery = document.getElementById("screenshotGallery");
      screenshotGallery.innerHTML = "";
      shots.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        screenshotGallery.appendChild(img);
      });

      // Favoritos
      updateFavoriteButtonState(dir);
      favoriteButton.addEventListener("click", () => toggleFavoriteGame(dir));

      // ✅ Comments
      await loadComments(dir);
      setupCommenting(dir);
    })
    .catch((err) => {
      console.error(err);
      alert("Juego no encontrado.");
      window.location.href = "index.html";
    });

  function togglePlayGame(url) {
    const current = gameIframe.src || "";
    const same = current.includes(url);

    if (same) {
      gameIframe.src = "";
      gameIframe.style.display = "none";
      playButton.textContent = "Jugar";
    } else {
      // ✅ cuenta vista también cuando le das play (opcional)
      interactWithGame("view");

      gameIframe.src = url;
      gameIframe.style.display = "block";
      playButton.textContent = "Pausar";
    }
  }

  document.getElementById("fullScreenButton").onclick = () => {
    if (!document.fullscreenElement) {
      gameIframe.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  document.getElementById("likeButton").onclick = () => interactWithGame("like");
  document.getElementById("dislikeButton").onclick = () => interactWithGame("dislike");

  // =========================
  // ✅ Interact (LIKE/DISLIKE/VIEW) con token si existe (NUEVO)
  // =========================
  async function interactWithGame(type) {
    try {
      const token = await getTokenOrNull();

      const r = await fetch(`/game/${encodeURIComponent(dir)}/interact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type }),
      });

      const data = await r.json().catch(() => ({}));

      if (data.success && data.game) {
        document.getElementById("likeCount").textContent = data.game.likes || 0;
        document.getElementById("dislikeCount").textContent = data.game.dislikes || 0;
        document.getElementById("viewCount").textContent = data.game.views || 0;
      }
    } catch (e) {
      console.warn(e);
    }
  }

  function reportGame(gameDir, reportedUser, reportedBy, reason) {
    fetch("/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameDir, reportedUser, reportedBy, reason }),
    })
      .then((r) => r.json())
      .then((data) => alert(data.success ? "Reporte enviado" : "Error al enviar el reporte"))
      .catch((e) => console.error("report error:", e));
  }

  async function deleteGame(dirToDelete) {
    try {
      // ✅ Necesitamos token
      if (!window.sb) {
        alert("Falta Supabase en el front. Incluye js/supabase.js en game.html");
        return;
      }

      const { data: sData } = await window.sb.auth.getSession();
      const token = sData?.session?.access_token;

      if (!token) {
        alert("No hay sesión/token. Vuelve a loguearte.");
        return;
      }

      const r = await fetch(`/games/${encodeURIComponent(dirToDelete)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (r.ok) {
        alert("Juego eliminado correctamente.");
        window.location.href = "index.html";
      } else {
        const j = await r.json().catch(() => ({}));
        alert(j.message || "Error al eliminar el juego.");
      }
    } catch (e) {
      console.warn(e);
      alert("Error al eliminar el juego.");
    }
  }

  // =========================
  // COMMENTS
  // =========================
  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function loadComments(gameDir) {
    if (!commentList) return;
    commentList.innerHTML = "Cargando comentarios...";

    try {
      const r = await fetch(`/comments/${encodeURIComponent(gameDir)}`);
      const j = await r.json();
      const comments = j?.comments || [];

      if (!comments.length) {
        commentList.innerHTML = "<div>Sin comentarios todavía.</div>";
        return;
      }

      commentList.innerHTML = "";
      comments.forEach((c) => {
        const el = document.createElement("div");
        const when = c.created_at ? new Date(c.created_at).toLocaleString() : "";
        el.innerHTML = `<b>@${esc(c.username)}</b> <span style="opacity:.65;font-size:12px;">${esc(
          when
        )}</span><br>${esc(c.comment)}`;
        commentList.appendChild(el);
      });
    } catch (e) {
      console.error("loadComments error:", e);
      commentList.innerHTML = "<div>Error cargando comentarios.</div>";
    }
  }

  function setupCommenting(gameDir) {
    if (!commentButton || !commentInput) return;

    // guest no comenta
    if (guest || !window.sb) {
      commentInput.disabled = true;
      commentInput.placeholder = "Inicia sesión para comentar";
      commentButton.disabled = true;
      return;
    }

    commentButton.onclick = async () => {
      const text = (commentInput.value || "").trim();
      if (!text) return;

      const { data: sData } = await window.sb.auth.getSession();
      const token = sData?.session?.access_token;
      if (!token) {
        alert("Inicia sesión para comentar.");
        return;
      }

      commentButton.disabled = true;

      try {
        const r = await fetch(`/comments/${encodeURIComponent(gameDir)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ comment: text }),
        });

        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          alert(j.message || "Error comentando");
          return;
        }

        commentInput.value = "";
        await loadComments(gameDir);
      } catch (e) {
        console.error("comment error:", e);
        alert("Error comentando");
      } finally {
        commentButton.disabled = false;
      }
    };
  }

  // =========================
  // Favoritos (tu lógica)
  // =========================
  function loadFavorites() {
    const favorites = localStorage.getItem("favorites");
    return favorites ? JSON.parse(favorites) : [];
  }
  function saveFavorites(favorites) {
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }
  function addFavorite(gameDir) {
    const favorites = loadFavorites();
    favorites.push(gameDir);
    saveFavorites(favorites);
  }
  function removeFavorite(gameDir) {
    let favorites = loadFavorites();
    favorites = favorites.filter((fav) => fav !== gameDir);
    saveFavorites(favorites);
  }
  function updateFavoriteButtonState(gameDir) {
    const favorites = loadFavorites();
    favoriteButton.textContent = favorites.includes(gameDir)
      ? "Eliminar de Favoritos"
      : "Añadir a Favoritos";
  }
  function toggleFavoriteGame(gameDir) {
    const favorites = loadFavorites();
    if (favorites.includes(gameDir)) {
      removeFavorite(gameDir);
      favoriteButton.textContent = "Añadir a Favoritos";
      alert("Juego eliminado de favoritos");
    } else {
      addFavorite(gameDir);
      favoriteButton.textContent = "Eliminar de Favoritos";
      alert("Juego añadido a favoritos");
    }
  }
});
