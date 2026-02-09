document.addEventListener("DOMContentLoaded", () => {
  // Load initial
  loadGames();
  loadUsers();
  loadReports();

  // UI events
  document.getElementById("sendNotificationButton").addEventListener("click", sendNotification);
  document.getElementById("banUserButton").addEventListener("click", banUser);
  document.getElementById("unbanUserButton").addEventListener("click", unbanUser);
  document.getElementById("searchInput").addEventListener("input", filterLists);

  // =========================
  // Helpers
  // =========================
  function getSelectedUsers() {
    return Array.from(document.querySelectorAll(".select-user:checked"))
      .map((checkbox) => checkbox.getAttribute("data-username"))
      .filter(Boolean);
  }

  function updateSelectedCount() {
    const n = getSelectedUsers().length;
    const el = document.getElementById("selectedCount");
    if (el) el.textContent = `${n} seleccionados`;
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
  // Games
  // =========================
  function loadGames() {
    fetch("/games")
      .then((r) => r.json())
      .then((games) => {
        const tbody = document.querySelector("#gameTable tbody");
        tbody.innerHTML = "";

        (games || []).forEach((game) => {
          const owner = game.owner_username || game.uploadedBy || "Unknown";
          const row = document.createElement("tr");

          row.innerHTML = `
            <td><a href="game.html?dir=${encodeURIComponent(game.dir)}" target="_blank">${esc(game.name)}</a></td>
            <td><a href="profile.html?user=${encodeURIComponent(owner)}" target="_blank">${esc(owner)}</a></td>
            <td>${esc(game.dir)}</td>
            <td>
              <button class="delete-button" data-dir="${esc(game.dir)}">Eliminar</button>
            </td>
          `;

          tbody.appendChild(row);

          row.querySelector("button.delete-button").addEventListener("click", () => {
            deleteGame(game.dir);
          });
        });
      })
      .catch((err) => console.error("Error al cargar los juegos:", err));
  }

  // =========================
  // Users
  // =========================
  function loadUsers() {
    fetch("/users")
      .then((r) => r.json())
      .then((users) => {
        const tbody = document.querySelector("#userTable tbody");
        tbody.innerHTML = "";

        (users || []).forEach((user) => {
          const username = user.username || "";
          const email = user.email || "";
          const banned = !!user.banned;

          const row = document.createElement("tr");
          row.innerHTML = `
            <td>
              <input type="checkbox" class="select-user" data-username="${esc(username)}">
            </td>
            <td>
              <a href="profile.html?user=${encodeURIComponent(username)}" target="_blank">${esc(username)}</a>
            </td>
            <td>${esc(email)}</td>
            <td>
              ${
                banned
                  ? `<span class="badge banned">BANEADO</span>`
                  : `<span class="badge ok">OK</span>`
              }
            </td>
          `;

          tbody.appendChild(row);
        });

        // checkbox events
        tbody.querySelectorAll(".select-user").forEach((cb) => {
          cb.addEventListener("change", updateSelectedCount);
        });

        updateSelectedCount();
      })
      .catch((err) => console.error("Error al cargar los usuarios:", err));
  }

  // =========================
  // Reports
  // =========================
  function loadReports() {
    fetch("/reports")
      .then((r) => r.json())
      .then((reports) => {
        const tbody = document.querySelector("#reportTable tbody");
        tbody.innerHTML = "";

        (reports || []).forEach((report) => {
          const row = document.createElement("tr");
          const gameDir = report.game_dir || report.gameDir || "";
          const reportedBy = report.reported_by || report.reportedBy || "";
          const reportedUser = report.reported_user || report.reportedUser || "";
          const reason = report.reason || "";
          const created = report.created_at || report.date || null;

          row.innerHTML = `
            <td>${esc(reportedBy)}</td>
            <td>${esc(reportedUser)}</td>
            <td><a href="game.html?dir=${encodeURIComponent(gameDir)}" target="_blank">${esc(gameDir)}</a></td>
            <td>${esc(reason)}</td>
            <td>${created ? new Date(created).toLocaleString() : ""}</td>
            <td>
              <button class="delete-button" data-id="${esc(report.id)}">Eliminar</button>
            </td>
          `;

          tbody.appendChild(row);

          row.querySelector("button.delete-button").addEventListener("click", () => {
            deleteReport(report.id);
          });
        });
      })
      .catch((err) => console.error("Error al cargar los reportes:", err));
  }

  // =========================
  // Ban / Unban / Notifications
  // =========================
  function banUser() {
    const selectedUsers = getSelectedUsers();
    const reason = (document.getElementById("banReason").value || "").trim();

    if (selectedUsers.length === 0) {
      alert("Selecciona al menos un usuario");
      return;
    }
    if (!reason) {
      alert("Escribe un motivo para el ban");
      return;
    }

    fetch("/ban_user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users: selectedUsers, reason }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data.success) {
          alert("Usuario(s) baneado(s)");
          document.getElementById("banReason").value = "";
          loadUsers();
        } else {
          alert(data.message || "Error al banear usuario(s)");
        }
      })
      .catch((err) => {
        console.error("Error al banear:", err);
        alert("Error al banear usuario(s)");
      });
  }

  function unbanUser() {
    const selectedUsers = getSelectedUsers();

    if (selectedUsers.length === 0) {
      alert("Selecciona al menos un usuario");
      return;
    }

    if (!confirm("¿Seguro que quieres quitar el ban a los seleccionados?")) return;

    fetch("/unban_user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users: selectedUsers }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data.success) {
          alert("Ban removido");
          loadUsers();
        } else {
          alert(data.message || "Error al quitar ban");
        }
      })
      .catch((err) => {
        console.error("Error al quitar ban:", err);
        alert("Error al quitar ban");
      });
  }

  function sendNotification() {
    const selectedUsers = getSelectedUsers();
    const message = (document.getElementById("notificationMessage").value || "").trim();

    if (selectedUsers.length === 0) {
      alert("Selecciona al menos un usuario");
      return;
    }
    if (!message) {
      alert("Escribe un mensaje");
      return;
    }

    fetch("/send_notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        users: selectedUsers,
        message: `Administración: ${message}`,
      }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (data.success) {
          alert("Notificación enviada");
          document.getElementById("notificationMessage").value = "";
        } else {
          alert(data.message || "Error al enviar notificación");
        }
      })
      .catch((err) => {
        console.error("Error al enviar notificación:", err);
        alert("Error al enviar notificación");
      });
  }

  // =========================
  // Delete actions
  // =========================
  function deleteGame(gameDir) {
    if (!confirm("¿Estás seguro de que deseas eliminar este juego?")) return;

    fetch(`/games/${encodeURIComponent(gameDir)}`, { method: "DELETE" })
      .then((r) => {
        if (r.ok) {
          alert("Juego eliminado");
          loadGames();
        } else {
          alert("Error al eliminar el juego");
        }
      })
      .catch((err) => console.error("Error al eliminar el juego:", err));
  }

  function deleteReport(reportId) {
    if (!confirm("¿Estás seguro de que deseas eliminar este reporte?")) return;

    fetch(`/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" })
      .then((r) => {
        if (r.ok) {
          alert("Reporte eliminado");
          loadReports();
        } else {
          alert("Error al eliminar el reporte");
        }
      })
      .catch((err) => console.error("Error al eliminar el reporte:", err));
  }

  // =========================
  // Filter lists
  // =========================
  function filterLists() {
    const q = (document.getElementById("searchInput").value || "").toLowerCase();
    filterTable("gameTable", q);
    filterTable("userTable", q);
    filterTable("reportTable", q);
  }

  function filterTable(tableId, query) {
    const table = document.getElementById(tableId);
    if (!table || !table.tBodies || !table.tBodies[0]) return;

    Array.from(table.tBodies[0].rows).forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? "" : "none";
    });
  }
});
