document.addEventListener("DOMContentLoaded", async () => {
  // =========================
  // 0) CSS Inyectado (MISMO SCRIPT) - PRO + BONITO
  // =========================
  const css = `
  :root{
    --bg:#0b0f17;
    --panel: rgba(255,255,255,0.03);
    --panel2: rgba(255,255,255,0.045);
    --border: rgba(255,255,255,0.10);
    --text: rgba(255,255,255,0.92);
    --muted: rgba(255,255,255,0.68);
    --shadow: 0 12px 34px rgba(0,0,0,0.45);
    --radius: 16px;
    --accent: #6ee7ff;
    --danger: #ff5a7a;
  }

  /* GRID tarjetas */
  #games{
    list-style:none;
    padding: 0;
    margin: 0;
    display:grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    align-items: stretch;
  }

  /* CARD */
  #games > li{
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: var(--radius);
    overflow:hidden;
    background: rgba(255,255,255,0.03);
    box-shadow: var(--shadow);
    position: relative;
    min-width: 0;
    transition: transform 140ms ease, border-color 140ms ease, background 140ms ease, box-shadow 140ms ease;
  }
  #games > li:hover{
    transform: translateY(-3px);
    border-color: rgba(110,231,255,0.18);
    background: rgba(255,255,255,0.04);
    box-shadow: 0 18px 46px rgba(0,0,0,0.55);
  }

  #games .game-info{
    display:block;
    text-decoration:none;
    color: var(--text);
  }

  #games .screenshot{
    width:100%;
    aspect-ratio: 16 / 10;
    object-fit: cover;
    display:block;
    background: rgba(255,255,255,0.04);
    transform: scale(1);
    transition: transform 220ms ease;
  }
  #games > li::before{
    content:"";
    position:absolute;
    left:0; right:0;
    top:0;
    height: 62%;
    pointer-events:none;
    background:
      linear-gradient(to bottom,
        rgba(11,15,23,0.00) 0%,
        rgba(11,15,23,0.10) 45%,
        rgba(11,15,23,0.65) 100%
      );
    opacity: 0.92;
    z-index: 1;
  }
  #games > li:hover .screenshot{ transform: scale(1.03); }

  #games .game-body{
    position: relative;
    z-index: 2;
    padding: 12px 12px 12px;
    display:flex;
    flex-direction: column;
    gap: 10px;
    min-height: 150px;
  }

  #games h3{
    margin:0;
    font-size: 14px;
    font-weight: 900;
    line-height: 1.25;
    letter-spacing: 0.2px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  #games .meta{
    display:flex;
    flex-wrap: wrap;
    gap: 7px;
  }
  #games .tag{
    font-size: 11px;
    padding: 5px 9px;
    border-radius: 999px;
    background: rgba(255,255,255,0.045);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.78);
    white-space: nowrap;
  }
  #games .tag.accent{
    border-color: rgba(110,231,255,0.24);
    background: rgba(110,231,255,0.09);
    color: rgba(255,255,255,0.90);
  }

  #games .uploader{
    font-size: 12px;
    color: var(--muted);
  }
  #games .uploader a{
    color: rgba(255,255,255,0.92);
    text-decoration:none;
    font-weight: 900;
  }
  #games .uploader a:hover{
    text-decoration: underline;
    color: rgba(110,231,255,0.95);
  }

  #games .card-footer{
    margin-top: auto;
    display:flex;
    justify-content: space-between;
    align-items:center;
    gap: 10px;
  }
  #games .open-btn{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding: 9px 12px;
    border-radius: 12px;
    border: 1px solid rgba(110,231,255,0.22);
    background: rgba(110,231,255,0.10);
    color: rgba(255,255,255,0.92);
    font-weight: 900;
    font-size: 12px;
    text-decoration:none;
  }
  #games > li:hover .open-btn{
    background: rgba(110,231,255,0.14);
  }

  #games .star{
    position:absolute;
    top: 10px;
    right: 10px;
    width: 34px;
    height: 34px;
    border-radius: 12px;
    display:flex;
    align-items:center;
    justify-content:center;
    background: rgba(11,15,23,0.62);
    border: 1px solid rgba(255,255,255,0.12);
    cursor:pointer;
    user-select:none;
    font-size: 17px;
    color: rgba(255,255,255,0.72);
    z-index: 3;
    backdrop-filter: blur(10px);
    transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
  }
  #games .star:hover{
    transform: translateY(-1px) scale(1.02);
    background: rgba(11,15,23,0.72);
    border-color: rgba(110,231,255,0.18);
  }
  #games .star.favorite{
    color: #ffd54a;
    border-color: rgba(255,213,74,0.35);
    background: rgba(255,213,74,0.10);
    box-shadow: 0 10px 20px rgba(255,213,74,0.06);
  }

  .notification{
    position: fixed;
    top: 12px;
    right: 12px;
    background: rgba(11,15,23,0.94);
    color: #fff;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: var(--shadow);
    z-index: 9999;
  }

  @media (max-width: 980px){
    #games{ grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
  }
  @media (max-width: 520px){
    #games{ grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
    #games .game-body{ padding: 11px; min-height: 140px; }
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

  function getInitials(name) {
    const s = String(name || "").trim().replace(/^@/, "");
    if (!s) return "U";
    return s.slice(0, 2).toUpperCase();
  }
  function normalizeText(s) {
    return String(s || "").toLowerCase();
  }

  // =========================
  // 2) UI Elements
  // =========================
  const guest = localStorage.getItem("guest");

  const profileLink = document.getElementById("profileLink");
  const uploadLink = document.getElementById("uploadLink");
  const logoutButton = document.getElementById("logoutButton");
  const userMenuContainer = document.getElementById("userMenuContainer");

  const notificationCount = document.getElementById("notificationCount");

  // =========================
  // 3) Session: Supabase user (si no es guest)
  // =========================
  let user = null;
  let myProfile = null;

  if (!guest) {
    if (!window.sb) {
      console.error("❌ Falta window.sb. Incluye js/supabase.js antes de script.js");
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
        console.error("❌ No existe profile para este user.", pErr);
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
        try { if (window.sb) await window.sb.auth.signOut(); } catch (e) {}
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
  // 5) NOTIFICATIONS (FIX FULL)
  // =========================
  async function tryLoadNotifications() {
    if (guest) return;

    const username = myProfile?.username;
    if (!username) return;

    const notifList = document.getElementById("notifList");
    const notifEmpty = document.getElementById("notifEmpty");
    const clearBtn = document.getElementById("clearNotificationsButton");

    if (!notifList) return;

    // limpia lista pero preserva empty
    notifList.innerHTML = "";
    if (notifEmpty) {
      notifEmpty.style.display = "none";
      notifList.appendChild(notifEmpty);
    }

    try {
      const r = await fetch(`/notifications/${encodeURIComponent(username)}`);
      if (!r.ok) return;

      const data = await r.json();
      const items = Array.isArray(data.notifications) ? data.notifications : [];

      // contador
      if (notificationCount) {
        if (items.length > 0) {
          notificationCount.textContent = String(items.length);
          notificationCount.style.display = "inline-flex";
        } else {
          notificationCount.style.display = "none";
        }
      }

      // empty
      if (notifEmpty) {
        notifEmpty.style.display = items.length ? "none" : "block";
      }

      items.forEach((n) => {
        const sender = String(n.senderUsername || "").replace(/^@/, "");
        const msg = String(n.message || "");
        const url = n.url || "#";
        const imgUrl = n.profilePicture || "";

        const msgHasSender =
          sender && normalizeText(msg).includes(normalizeText(`@${sender}`));

        const whenText = n.created_at
          ? new Date(n.created_at).toLocaleString()
          : (n.time ? String(n.time) : "");

        // ✅ item usando tu layout nuevo
        const a = document.createElement("a");
        a.className = "notif-item";
        a.href = url;

        const initials = getInitials(sender);

        a.innerHTML = `
          <div style="display:flex; gap:10px; align-items:flex-start; width:100%;">
            <div style="position:relative; width:34px; height:34px; flex:0 0 auto;">
              <img
                class="notif-avatar"
                src="${esc(imgUrl)}"
                alt="${esc(sender)}"
                onerror="this.style.display='none'; this.parentElement.querySelector('.notif-fallback').style.display='flex';"
              />
              <div class="notif-fallback"
                style="display:${imgUrl ? "none" : "flex"}; width:34px;height:34px;border-radius:12px;
                       border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.05);
                       align-items:center;justify-content:center;font-weight:900;
                       color:rgba(255,255,255,0.75);font-size:12px;">
                ${esc(initials)}
              </div>
            </div>

            <div class="notif-body">
              <div class="msg">
                ${
                  msgHasSender
                    ? `${esc(msg)}`
                    : `<b>@${esc(sender)}</b> ${esc(msg)}`
                }
              </div>
              <div class="meta">
                ${whenText ? `<span>${esc(whenText)}</span>` : ""}
              </div>
            </div>
          </div>
        `;

        if (!url || url === "#") {
          a.addEventListener("click", (e) => e.preventDefault());
        }

        notifList.appendChild(a);
      });

      // ✅ Limpiar (no recrear el botón, usa el del header)
      if (clearBtn) {
        clearBtn.onclick = async (event) => {
          event.preventDefault();
          if (!confirm("¿Estás seguro de que quieres eliminar todas las notificaciones?")) return;

          const del = await fetch(`/notifications/${encodeURIComponent(username)}`, { method: "DELETE" });
          if (del.ok) {
            notifList.innerHTML = "";
            if (notifEmpty) {
              notifEmpty.style.display = "block";
              notifList.appendChild(notifEmpty);
            }
            if (notificationCount) notificationCount.style.display = "none";
          }
        };
      }
    } catch (e) {
      console.warn("tryLoadNotifications error:", e);
    }
  }
  tryLoadNotifications();

  // =========================
  // 6) Games: display
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
              <span style="font-size:12px;color:rgba(255,255,255,0.75);font-weight:800;">
                ${typeof game.likes === "number" ? `❤️ ${game.likes}` : ""}
              </span>
            </div>
          </div>
        </a>

        <span class="star ${favorites.includes(game.dir) ? "favorite" : ""}" data-dir="${esc(game.dir)}" title="Favorito">★</span>
      `;

      gameList.appendChild(li);

      const star = li.querySelector(".star");
      star?.addEventListener("click", (event) => handleStarClick(event, game));

      const img = li.querySelector("img.screenshot");
      img?.addEventListener("error", () => { img.src = "Logo/user.png"; });
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
      genreFilter?.appendChild(option);
    });

    platforms.forEach((platform) => {
      const option = document.createElement("option");
      option.value = platform;
      option.textContent = platform;
      platformFilter?.appendChild(option);
    });

    engines.forEach((engine) => {
      const option = document.createElement("option");
      option.value = engine;
      option.textContent = engine;
      engineFilter?.appendChild(option);
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
