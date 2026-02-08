document.addEventListener("DOMContentLoaded", async () => {
  // =========================
  // 0) Elementos
  // =========================
  const profileLink = document.getElementById("profileLink");
  const uploadLink = document.getElementById("uploadLink");
  const logoutButton = document.getElementById("logoutButton");
  const userMenuContainer = document.getElementById("userMenuContainer");
  const editProfileButton = document.getElementById("editProfileButton");
  const deleteAccountButton = document.getElementById("deleteAccountButton");

  const profilePictureElement = document.getElementById("profilePicture");
  const defaultProfilePicture =
    "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

  // =========================
  // 1) Validar Supabase
  // =========================
  if (!window.sb) {
    alert("Falta Supabase en el front. Incluye js/supabase.js antes de profile.js");
    return;
  }

  // Guest? (si tú quieres permitir ver perfiles siendo guest, quita esto)
  const guest = localStorage.getItem("guest");
  if (guest) {
    window.location.href = "login.html";
    return;
  }

  // =========================
  // 2) Sesión usuario
  // =========================
  const { data: uData, error: uErr } = await window.sb.auth.getUser();
  const me = uData?.user || null;

  if (!me) {
    window.location.href = "login.html";
    return;
  }

  // =========================
  // 3) Traer mi perfil (para el menú y comparaciones)
  // =========================
  const { data: myProfile, error: myPErr } = await window.sb
    .from("profiles")
    .select("id, username, phone, description, profile_picture")
    .eq("id", me.id)
    .single();

  if (myPErr || !myProfile) {
    alert("No existe tu perfil en 'profiles'. (Te falta crear la fila al registrarte)");
    window.location.href = "login.html";
    return;
  }

  // =========================
  // 4) Pintar menú (tu username arriba)
  // =========================
  userMenuContainer.innerHTML = "";

  const userProfileLink = document.createElement("a");
  userProfileLink.href = `profile.html?user=${encodeURIComponent(myProfile.username)}`;
  userProfileLink.textContent = myProfile.username;

  const li = document.createElement("li");
  li.appendChild(userProfileLink);
  userMenuContainer.appendChild(li);

  profileLink.style.display = "block";
  uploadLink.style.display = "block";
  logoutButton.style.display = "block";

  logoutButton.addEventListener("click", async () => {
    await window.sb.auth.signOut();
    localStorage.removeItem("guest");
    localStorage.removeItem("username"); // por si quedó viejo
    window.location.href = "login.html";
  });

  // =========================
  // 5) Determinar qué perfil ver (por URL ?user=)
  // =========================
  const urlParams = new URLSearchParams(window.location.search);
  const usernameToView = urlParams.get("user") || myProfile.username;

  // Buscar perfil público por username
  const { data: profile, error: pErr } = await window.sb
    .from("profiles")
    .select("id, username, phone, description, profile_picture")
    .eq("username", usernameToView)
    .single();

  if (pErr || !profile) {
    alert("Usuario no encontrado.");
    window.location.href = "index.html";
    return;
  }

  // =========================
  // 6) Pintar perfil
  // =========================
  profilePictureElement.src = profile.profile_picture || defaultProfilePicture;
  profilePictureElement.onerror = function () {
    this.src = defaultProfilePicture;
  };

  document.getElementById("username").textContent = profile.username;
  document.getElementById("phone").textContent = profile.phone || "No disponible";
  document.getElementById("description").textContent = profile.description || "No disponible";

  // Email: solo si es tu propio perfil
  document.getElementById("email").textContent =
    profile.id === me.id ? (me.email || "No disponible") : "Privado";

  // Stats: por ahora (si no tienes tabla de likes/comments)
  document.getElementById("likeCount").textContent = "0";
  document.getElementById("viewCount").textContent = "0";
  document.getElementById("commentCount").textContent = "0";

  // =========================
  // 7) Cargar juegos de ese usuario (por owner_id)
  // =========================
  const { data: games, error: gErr } = await window.sb
    .from("games")
    .select("dir, name")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  if (gErr) console.warn("Games error:", gErr);

  const userGames = document.getElementById("userGames");
  userGames.innerHTML = "";

  (games || []).forEach((game) => {
    const gameItem = document.createElement("li");
    gameItem.innerHTML = `<a href="game.html?dir=${encodeURIComponent(game.dir)}">${game.name}</a>`;
    userGames.appendChild(gameItem);
  });

  // =========================
  // 8) Botones solo si es tu propio perfil
  // =========================
  if (profile.id === me.id) {
    editProfileButton.style.display = "block";
    deleteAccountButton.style.display = "block";

    editProfileButton.onclick = () => (window.location.href = "edit_profile.html");

    deleteAccountButton.onclick = async () => {
      if (!confirm("¿Seguro que quieres eliminar tu cuenta COMPLETA?")) return;

      // Necesitamos token para Authorization
      const { data: sData } = await window.sb.auth.getSession();
      const token = sData?.session?.access_token;

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
        alert(j.message || "Error eliminando cuenta.");
        return;
      }

      await window.sb.auth.signOut();
      alert("Cuenta eliminada.");
      window.location.href = "login.html";
    };
  } else {
    editProfileButton.style.display = "none";
    deleteAccountButton.style.display = "none";
  }
});
