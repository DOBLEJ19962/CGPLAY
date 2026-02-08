document.addEventListener("DOMContentLoaded", async () => {
  // =========================
  // 0) Helpers
  // =========================
  function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
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
    if (!favorites.includes(gameDir)) favorites.push(gameDir);
    saveFavorites(favorites);
  }

  function removeFavorite(gameDir) {
    let favorites = loadFavorites();
    favorites = favorites.filter((fav) => fav !== gameDir);
    saveFavorites(favorites);
  }

  function handleStarClick(event, game) {
    event.preventDefault();
    event.stopPropagation();

    const star = event.target;
    const isFavorite = star.classList.contains("favorite");

    if (isFavorite) {
      star.classList.remove("favorite");
      showNotification(`Quitaste "${game.name}" de tus favoritos`);
      removeFavorite(game.dir);
    } else {
      star.classList.add("favorite");
      showNotification(`Añadiste "${game.name}" a tus favoritos`);
      addFavorite(game.dir);
    }
  }

  // =========================
  // 1) UI Elements
  // =========================
  const guest = localStorage.getItem("guest");

  const profileLink = document.getElementById("profileLink");
  const uploadLink = document.getElementById("uploadLink");
  const logoutButton = document.getElementById("logoutButton");
  const userMenuContainer = document.getElementById("userMenuContainer");

  const notificationButton = document.getElementById("notificationButton");
  const notificationCount = document.getElementById("notificationCount");
  const notifications = document.getElementById("notifications");

  // =========================
  // 2) Session: Supabase user (si no es guest)
  // =========================
  let user = null;
  let myProfile = null;

  // Si hay guest => no obligamos login
  if (!guest) {
    // Si no existe window.sb => te falta incluir supabase.js en el HTML
    if (!window.sb) {
      console.error("❌ Falta window.sb. Asegúrate de incluir /js/supabase.js antes de script.js");
      // Igual cargamos juegos públicos
    } else {
      const { data: userData, error: uErr } = await window.sb.auth.getUser();
      user = userData?.user || null;

      // Si no hay user y no eres guest => te mando a login
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      // Traer profile para username real
      const { data: prof, error: pErr } = await window.sb
        .from("profiles")
        .select("id, username, profile_picture")
        .eq("id", user.id)
        .single();

      if (pErr || !prof) {
        console.error("❌ No existe profile para este user. Crea row en profiles al registrarte.");
        alert("No se encontró tu perfil (profiles).");
        window.location.href = "login.html";
        return;
      }

      myProfile = prof;
    }
  }

  // =========================
  // 3) Menú usuario (arriba) - FIX
  // =========================
  userMenuContainer.innerHTML = "";

  if (guest) {
    // Invitado
    const guestLink = document.createElement("a");
    guestLink.href = "login.html";
    guestLink.textContent = "Login";
    const li = document.createElement("li");
    li.appendChild(guestLink);
    userMenuContainer.appendChild(li);

    profileLink.style.display = "none";
    uploadLink.style.display = "none";
    logoutButton.style.display = "none";
  } else {
    // Logueado (Supabase)
    const username = myProfile?.username || (user?.email || "User");

    const userProfileLink = document.createElement("a");
    userProfileLink.href = `profile.html?user=${encodeURIComponent(username)}`;
    userProfileLink.textContent = username;

    const li = document.createElement("li");
    li.appendChild(userProfileLink);
    userMenuContainer.appendChild(li);

    // Logout
    logoutButton.addEventListener("click", async () => {
      try {
        if (window.sb) await window.sb.auth.signOut();
      } catch (e) {
        console.warn(e);
      }
      localStorage.removeItem("guest");
      localStorage.removeItem("username"); // por si existe viejo
      window.location.href = "login.html";
    });

    profileLink.style.display = "block";
    uploadLink.style.display = "block";
    logoutButton.style.display = "block";
  }

  // =========================
  // 4) Notifications (si tú todavía usas sistema viejo por endpoint)
  // =========================
  // OJO: tu sistema viejo usa /notifications/:username en server, pero ahora no lo tienes en el server nuevo.
  // Para no romper, lo intentamos SOLO si hay user y si el endpoint existe.
  async function tryLoadNotifications() {
    if (guest) return;

    const username = myProfile?.username;
    if (!username) return;

    try {
      const r = await fetch(`/notifications/${encodeURIComponent(username)}`);
      if (!r.ok) return;

      const data = await r.json();
      if (data.notifications && data.notifications.length > 0) {
        notificationCount.textContent = data.notifications.length;
        notificationCount.style.display = "inline";

        data.notifications.forEach((notification) => {
          const notificationItem = document.createElement("div");
          notificationItem.classList.add("notification-item");
          notificationItem.innerHTML = `
            <img src="${notification.profilePicture}" alt="Profile Picture" class="profile-picture">
            <a href="profile.html?user=${notification.senderUsername}" class="notification-user">${notification.senderUsername}</a>
            <span> ${notification.message}</span>
          `;
          notificationItem.addEventListener("click", () => {
            window.location.href = notification.url;
          });
          notifications.appendChild(notificationItem);
        });
      }

      notificationButton.addEventListener("click", () => {
        notifications.style.display = notifications.style.display === "none" ? "block" : "none";
      });

      const clearBtn = document.getElementById("clearNotificationsButton");
      if (clearBtn) {
        clearBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          if (!confirm("¿Estás seguro de que quieres eliminar todas las notificaciones?")) return;

          const del = await fetch(`/notifications/${encodeURIComponent(username)}`, { method: "DELETE" });
          if (del.ok) {
            notifications.innerHTML =
              '<a id="clearNotificationsButton" href="#" style="display: block; padding: 10px; color: red; text-align: center;">Limpiar Notificaciones</a>';
            notificationCount.style.display = "none";
          }
        });
      }
    } catch (e) {
      // si no existe endpoint, no hacemos nada
    }
  }
  tryLoadNotifications();

  // =========================
  // 5) Games: load + display
  // =========================
  function displayGames(games) {
    const gameList = document.getElementById("games");
    gameList.innerHTML = "";
    const favorites = loadFavorites();

    (games || []).forEach((game) => {
      const cover = game.cover_url || game.coverImagePath || "Logo/user.png"; // fallback
      const uploader = game.owner_username || game.uploadedBy || "Unknown";

      const gameItem = document.createElement("li");
      gameItem.innerHTML = `
        <a href="game.html?dir=${encodeURIComponent(game.dir)}" class="game-info">
          <img src="${cover}" alt="${game.name} Cover" class="screenshot">
          <h3>${game.name}</h3>
          <p>Subido por: <a href="profile.html?user=${encodeURIComponent(uploader)}">${uploader}</a></p>
          <p>Género: ${game.genre || ""}</p>
          <p>Plataforma: ${game.platform || ""}</p>
          <p>Motor: ${game.engine || ""}</p>
        </a>
        <span class="star ${favorites.includes(game.dir) ? "favorite" : ""}" data-dir="${game.dir}">★</span>
      `;

      gameList.appendChild(gameItem);

      const star = gameItem.querySelector(".star");
      star.addEventListener("click", (event) => handleStarClick(event, game));
    });
  }

  function populateFilters(games) {
    const genres = new Set();
    const platforms = new Set();
    const engines = new Set();

    (games || []).forEach((game) => {
      if (game.genre) genres.add(game.genre);
      if (game.platform) platforms.add(game.platform);
      if (game.engine) engines.add(game.engine);
    });

    const genreFilter = document.getElementById("genreFilter");
    const platformFilter = document.getElementById("platformFilter");
    const engineFilter = document.getElementById("engineFilter");

    // evita duplicar options si llamas varias veces
    function resetToFirst(selectEl) {
      const first = selectEl.querySelector("option");
      selectEl.innerHTML = "";
      if (first) selectEl.appendChild(first);
    }

    resetToFirst(genreFilter);
    resetToFirst(platformFilter);
    resetToFirst(engineFilter);

    genres.forEach((genre) => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      genreFilter.appendChild(option);
    });

    platforms.forEach((platform) => {
      const option = document.createElement("option");
      option.value = platform;
      option.textContent = platform;
      platformFilter.appendChild(option);
    });

    engines.forEach((engine) => {
      const option = document.createElement("option");
      option.value = engine;
      option.textContent = engine;
      engineFilter.appendChild(option);
    });
  }

  function filterGames(allGames) {
    const searchInput = (document.getElementById("searchInput").value || "").toLowerCase();
    const genreVal = document.getElementById("genreFilter").value;
    const platformVal = document.getElementById("platformFilter").value;
    const engineVal = document.getElementById("engineFilter").value;
    const relevanceVal = document.getElementById("relevanceFilter").value;
    const favorites = loadFavorites();

    let filtered = (allGames || []).filter((game) => {
      const uploader = (game.owner_username || game.uploadedBy || "").toLowerCase();
      const name = (game.name || "").toLowerCase();

      const matchesSearch = name.includes(searchInput) || uploader.includes(searchInput);
      const matchesGenre = !genreVal || game.genre === genreVal;
      const matchesPlatform = !platformVal || game.platform === platformVal;
      const matchesEngine = !engineVal || game.engine === engineVal;

      return matchesSearch && matchesGenre && matchesPlatform && matchesEngine;
    });

    if (relevanceVal === "favorites") {
      filtered = filtered.filter((g) => favorites.includes(g.dir));
    } else if (relevanceVal === "mostPopular") {
      filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else if (relevanceVal === "leastPopular") {
      filtered.sort((a, b) => (a.likes || 0) - (b.likes || 0));
    } else if (relevanceVal === "newest") {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    displayGames(filtered);
  }

  async function loadGames() {
    try {
      const r = await fetch("/games");
      const games = await r.json();

      // Normaliza fechas (tu viejo código usaba uploadDate, ahora es created_at)
      (games || []).forEach((g) => {
        g.created_at = g.created_at || g.uploadDate || null;
      });

      displayGames(games);
      populateFilters(games);

      document.getElementById("searchInput").addEventListener("input", () => filterGames(games));
      document.getElementById("genreFilter").addEventListener("change", () => filterGames(games));
      document.getElementById("platformFilter").addEventListener("change", () => filterGames(games));
      document.getElementById("engineFilter").addEventListener("change", () => filterGames(games));
      document.getElementById("relevanceFilter").addEventListener("change", () => filterGames(games));
    } catch (error) {
      console.error("Error al cargar los juegos:", error);
    }
  }

  // ✅ finalmente carga juegos
  loadGames();
});
