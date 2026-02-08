// public/game.js
document.addEventListener("DOMContentLoaded", () => {
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

  // Menu user
  userMenuContainer.innerHTML = "";

  if (sessionUser) {
    const a = document.createElement("a");
    a.href = `profile.html?user=${encodeURIComponent(sessionUser)}`;
    a.textContent = sessionUser;

    const li = document.createElement("li");
    li.appendChild(a);
    userMenuContainer.appendChild(li);

    logoutButton.addEventListener("click", () => {
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

  // ✅ 1 SOLO juego (no traigas toda la lista)
  fetch(`/games/${encodeURIComponent(dir)}`)
    .then((r) => {
      if (!r.ok) throw new Error("Juego no encontrado");
      return r.json();
    })
    .then((game) => {
      // DB columns reales
      const cover = game.cover_url || "";
      const owner = game.owner_username || "user";
      const download = game.downloadable_url || "#";
      const shots = Array.isArray(game.screenshots) ? game.screenshots : [];

      // ✅ IMPORTANT: reproduce desde TU DOMINIO
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

  function interactWithGame(type) {
    fetch(`/game/${encodeURIComponent(dir)}/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.game) {
          document.getElementById("likeCount").textContent = data.game.likes || 0;
          document.getElementById("dislikeCount").textContent = data.game.dislikes || 0;
          document.getElementById("viewCount").textContent = data.game.views || 0;
        }
      })
      .catch(console.warn);
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

  function deleteGame(dir) {
    fetch(`/games/${encodeURIComponent(dir)}`, { method: "DELETE" })
      .then((r) => {
        if (r.ok) {
          alert("Juego eliminado correctamente.");
          window.location.href = "index.html";
        } else {
          alert("Error al eliminar el juego.");
        }
      })
      .catch(console.warn);
  }

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
