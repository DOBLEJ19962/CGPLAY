document.addEventListener("DOMContentLoaded", async () => {
  // =========================
  // 0) CSS Inyectado (MISMO SCRIPT) - MÁS CHIQUITO + MÁS BONITO
  // =========================
  const css = `
  :root{
    --bg:#0b0f17;
    --panel: rgba(255,255,255,0.028);
    --border: rgba(255,255,255,0.09);
    --text: rgba(255,255,255,0.92);
    --muted: rgba(255,255,255,0.68);
    --shadow: 0 8px 22px rgba(0,0,0,0.30);
    --radius: 12px;
    --accent: #6ee7ff;
    --danger: #ff5a7a;
  }

  /* Grid compacto */
  #games{
    list-style:none;
    padding: 0;
    margin: 0;

    display:grid;
    gap: 10px;

    /* más chiquito */
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    align-items: stretch;
  }

  /* Card compacto */
  #games > li{
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow:hidden;
    background: var(--panel);
    box-shadow: var(--shadow);
    position: relative;
    transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
  }
  #games > li:hover{
    transform: translateY(-1px);
    background: rgba(255,255,255,0.04);
    border-color: rgba(110,231,255,0.18);
  }

  /* Link */
  #games .game-info{
    display:block;
    text-decoration:none;
    color: var(--text);
  }

  /* Imagen fija y más baja */
  #games .screenshot{
    width:100%;
    aspect-ratio: 16 / 10;   /* más bajita que 16:9 */
    object-fit: cover;
    display:block;
    background: rgba(255,255,255,0.04);
  }

  /* Contenido compacto */
  #games .game-body{
    padding: 10px;
    display:flex;
    flex-direction: column;
    gap: 8px;
    min-height: 120px;
  }

  #games h3{
    margin:0;
    font-size: 13px;
    font-weight: 800;
    line-height: 1.22;

    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Tags mini */
  #games .meta{
    display:flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  #games .tag{
    font-size: 10px;
    padding: 4px 7px;
    border-radius: 999px;
    background: rgba(255,255,255,0.055);
    border: 1px solid rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.78);
    white-space: nowrap;
  }
  #games .tag.accent{
    border-color: rgba(110,231,255,0.20);
    background: rgba(110,231,255,0.075);
  }

  /* Uploader más limpio (menos texto) */
  #games .uploader{
    font-size: 11px;
    color: var(--muted);
  }
  #games .uploader a{
    color: rgba(255,255,255,0.9);
    text-decoration: none;
    font-weight: 700;
  }
  #games .uploader a:hover{ text-decoration: underline; }

  /* Footer mini */
  #games .card-footer{
    margin-top: auto;
    display:flex;
    justify-content: space-between;
    align-items:center;
    gap: 8px;
  }

  #games .open-btn{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.04);
    color: var(--text);
    font-weight: 800;
    font-size: 12px;
    text-decoration:none;
  }
  #games .open-btn:hover{
    background: rgba(255,255,255,0.06);
  }

  /* Estrella más pequeña y discreta */
  #games .star{
    position:absolute;
    top: 8px;
    right: 8px;
    width: 30px;
    height: 30px;
    border-radius: 10px;
    display:flex;
    align-items:center;
    justify-content:center;
    background: rgba(11,15,23,0.62);
    border: 1px solid rgba(255,255,255,0.12);
    cursor:pointer;
    user-select:none;
    font-size: 16px;
    color: rgba(255,255,255,0.72);
    z-index: 2;
    backdrop-filter: blur(6px);
  }
  #games .star.favorite{ color: #ffd54a; }

  /* Notificación más bonita */
  .notification{
    position: fixed;
    top: 12px;
    right: 12px;
    background: rgba(11,15,23,0.92);
    color: #fff;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: var(--shadow);
    z-index: 9999;
  }

  /* Responsive */
  @media (max-width: 520px){
    #games{
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
    }
    #games .game-body{ padding: 9px; }
  }
  `;
  const styleTag = document.createElement("style");
  styleTag.textContent = css;
  document.head.appendChild(styleTag);

  // =========================
  // 1) Helpers
  // =========================
  function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2200);
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

    const star = event.currentTarget;
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

  function esc(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // =========================
  // 2) UI Elements
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
  // 3) Session: Supabase user (si no es guest)
  // =========================
  let user = null;
  let myProfile = null;

  if (!guest) {
    if (!window.sb) {
      console.error("❌ Falta window.sb. Asegúrate de incluir /js/supabase.js antes de script.js");
    } else {
      const { data: userData } = await window.sb.auth.getUser();
      user = userData?.user || null;

      if (!user) {
        window.location.href = "login.html";
        return;
      }

      const { data: prof, error: pErr } = await window.sb
        .from("profiles")
        .select("id, username, profile_picture")
        .eq("id", user.id)
        .single();

      if (pErr || !prof) {
        console.error("❌ No existe profile para este user.");
        alert("No se encontró tu perfil (profiles).");
        window.location.href = "login.html";
        return;
      }

      myProfile = prof;
    }
  }

  // =========================
  // 4) Menú usuario (arriba)
  // =========================
  if (userMenuContainer) userMenuContainer.innerHTML = "";

  if (guest) {
    const guestLink = document.createElement("a");
    guestLink.href = "login.html";
    guestLink.textContent = "Login";
    const li = document.createElement("li");
    li.appendChild(guestLink);
    userMenuContainer?.appendChild(li);

    if (profileLink) profileLink.style.display = "none";
    if (uploadLink) uploadLink.style.display = "none";
    if (logoutButton) logoutButton.style.display = "none";
  } else {
    const username = myProfile?.username || (user?.email || "User");

    const userProfileLink = document.createElement("a");
    userProfileLink.href = `profile.html?user=${encodeURIComponent(username)}`;
    userProfileLink.textContent = username;

    const li = document.createElement("li");
    li.appendChild(userProfileLink);
    userMenuContainer?.appendChild(li);

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          if (window.sb) await window.sb.auth.signOut();
        } catch (e) {}
        localStorage.removeItem("guest");
        localStorage.removeItem("username");
        window.location.href = "login.html";
      });
    }

    if (profileLink) profileLink.style.display = "block";
    if (uploadLink) uploadLink.style.display = "block";
    if (logoutButton) logoutButton.style.display = "block";
  }

  // =========================
  // 5) Notifications (compat)
  // =========================
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
        notificationCount.style.display = "inline-flex";

        data.notifications.forEach((notification) => {
          const notificationItem = document.createElement("div");
          notificationItem.classList.add("notification-item");
          notificationItem.innerHTML = `
            <img src="${esc(notification.profilePicture)}" alt="Profile Picture" class="profile-picture">
            <a href="profile.html?user=${encodeURIComponent(notification.senderUsername)}" class="notification-user">${esc(notification.senderUsername)}</a>
            <span> ${esc(notification.message)}</span>
          `;
          notificationItem.addEventListener("click", () => {
            window.location.href = notification.url;
          });
          notifications.appendChild(notificationItem);
        });
      }

      if (notificationButton && notifications) {
        notificationButton.addEventListener("click", () => {
          notifications.style.display = notifications.style.display === "none" ? "block" : "none";
        });
      }

      const clearBtn = document.getElementById("clearNotificationsButton");
      if (clearBtn) {
        clearBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          if (!confirm("¿Estás seguro de que quieres eliminar todas las notificaciones?")) return;

          const del = await fetch(`/notifications/${encodeURIComponent(username)}`, { method: "DELETE" });
          if (del.ok) {
            notifications.innerHTML =
              '<a id="clearNotificationsButton" href="#" style="display:block;padding:10px;color:red;text-align:center;">Limpiar Notificaciones</a>';
            notificationCount.style.display = "none";
          }
        });
      }
    } catch (e) {}
  }
  tryLoadNotifications();

  // =========================
  // 6) Games: display (MÁS COMPACTO)
  // =========================
  function displayGames(games) {
    const gameList = document.getElementById("games");
    if (!gameList) return;

    gameList.innerHTML = "";
    const favorites = loadFavorites();

    (games || []).forEach((game) => {
      const cover = game.cover_url || game.coverImagePath || "Logo/user.png";
      const uploader = game.owner_username || game.uploadedBy || "Unknown";

      const genre = game.genre || "";
      const platform = game.platform || "";
      const engine = game.engine || "";

      const li = document.createElement("li");

      li.innerHTML = `
        <a href="game.html?dir=${encodeURIComponent(game.dir)}" class="game-info">
          <img src="${esc(cover)}" alt="${esc(game.name)} Cover" class="screenshot" loading="lazy">
          <div class="game-body">
            <h3>${esc(game.name)}</h3>

            <div class="meta">
              ${platform ? `<span class="tag accent">${esc(platform)}</span>` : ""}
              ${genre ? `<span class="tag">${esc(genre)}</span>` : ""}
              ${engine ? `<span class="tag">${esc(engine)}</span>` : ""}
            </div>

            <div class="uploader">
              <a href="profile.html?user=${encodeURIComponent(uploader)}">@${esc(uploader)}</a>
            </div>

            <div class="card-footer">
              <span class="open-btn">Ver</span>
              <span style="font-size:11px;color:var(--muted);">
                ${game.likes ? `❤️ ${game.likes}` : ""}
              </span>
            </div>
          </div>
        </a>

        <span class="star ${favorites.includes(game.dir) ? "favorite" : ""}" data-dir="${esc(game.dir)}" title="Favorito">★</span>
      `;

      gameList.appendChild(li);

      const star = li.querySelector(".star");
      star.addEventListener("click", (event) => handleStarClick(event, game));

      const img = li.querySelector("img.screenshot");
      img.addEventListener("error", () => {
        img.src = "Logo/user.png";
      });
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

    function resetToFirst(selectEl) {
      if (!selectEl) return;
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
    const searchInput = (document.getElementById("searchInput")?.value || "").toLowerCase();
    const genreVal = document.getElementById("genreFilter")?.value || "";
    const platformVal = document.getElementById("platformFilter")?.value || "";
    const engineVal = document.getElementById("engineFilter")?.value || "";
    const relevanceVal = document.getElementById("relevanceFilter")?.value || "";
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
      filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    displayGames(filtered);
  }

  async function loadGames() {
    try {
      const r = await fetch("/games");
      if (!r.ok) throw new Error("No se pudo cargar /games");
      const games = await r.json();

      (games || []).forEach((g) => {
        g.created_at = g.created_at || g.uploadDate || null;
      });

      displayGames(games);
      populateFilters(games);

      const s = document.getElementById("searchInput");
      const gf = document.getElementById("genreFilter");
      const pf = document.getElementById("platformFilter");
      const ef = document.getElementById("engineFilter");
      const rf = document.getElementById("relevanceFilter");

      if (s) s.addEventListener("input", () => filterGames(games));
      if (gf) gf.addEventListener("change", () => filterGames(games));
      if (pf) pf.addEventListener("change", () => filterGames(games));
      if (ef) ef.addEventListener("change", () => filterGames(games));
      if (rf) rf.addEventListener("change", () => filterGames(games));
    } catch (error) {
      console.error("Error al cargar los juegos:", error);
      showNotification("Error al cargar los juegos.");
    }
  }

  loadGames();
});
