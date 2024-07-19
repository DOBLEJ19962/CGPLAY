document.addEventListener('DOMContentLoaded', () => {
    loadGames();
    loadUsers();
    loadReports();

    document.getElementById('sendNotificationButton').addEventListener('click', sendNotification);
    document.getElementById('banUserButton').addEventListener('click', banUser);
    document.getElementById('searchInput').addEventListener('input', filterLists);

    // Cargar y mostrar juegos
    function loadGames() {
        fetch('/games')
            .then(response => response.json())
            .then(games => {
                const gameTableBody = document.querySelector('#gameTable tbody');
                gameTableBody.innerHTML = '';
                games.forEach(game => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><a href="game.html?dir=${game.dir}" target="_blank">${game.name}</a></td>
                        <td><a href="profile.html?user=${game.uploadedBy}" target="_blank">${game.uploadedBy}</a></td>
                        <td><button class="delete-button" onclick="deleteGame('${game.dir}')">Eliminar</button></td>
                    `;
                    gameTableBody.appendChild(row);
                });
            })
            .catch(error => console.error('Error al cargar los juegos:', error));
    }

    // Cargar y mostrar usuarios
    function loadUsers() {
        fetch('/users')
            .then(response => response.json())
            .then(users => {
                const userTableBody = document.querySelector('#userTable tbody');
                userTableBody.innerHTML = '';
                users.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><a href="profile.html?user=${user.username}" target="_blank">${user.username}</a></td>
                        <td>${user.email}</td>
                        <td><input type="checkbox" class="select-user"></td>
                    `;
                    userTableBody.appendChild(row);
                });
            })
            .catch(error => console.error('Error al cargar los usuarios:', error));
    }

    // Cargar y mostrar reportes
    function loadReports() {
        fetch('/reports')
            .then(response => response.json())
            .then(reports => {
                const reportTableBody = document.querySelector('#reportTable tbody');
                reportTableBody.innerHTML = '';
                reports.forEach(report => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${report.reportedBy}</td>
                        <td>${report.reportedUser}</td>
                        <td><a href="game.html?dir=${report.gameDir}" target="_blank">${report.gameName}</a></td>
                        <td>${report.reason}</td>
                        <td>${new Date(report.date).toLocaleString()}</td>
                        <td><button class="delete-button" onclick="deleteReport('${report.id}')">Eliminar</button></td>
                    `;
                    reportTableBody.appendChild(row);
                });
            })
            .catch(error => console.error('Error al cargar los reportes:', error));
    }

    // Enviar notificación
    function sendNotification() {
        const selectedUsers = Array.from(document.querySelectorAll('.select-user:checked'))
            .map(checkbox => checkbox.closest('tr').children[0].textContent.trim());
        const message = document.getElementById('notificationMessage').value.trim();
        if (selectedUsers.length > 0 && message) {
            fetch('/send_notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    users: selectedUsers,
                    message: `Administración: ${message}`
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Notificación enviada');
                        document.getElementById('notificationMessage').value = '';
                    } else {
                        alert('Error al enviar notificación');
                    }
                })
                .catch(error => console.error('Error al enviar notificación:', error));
        } else {
            alert('Selecciona al menos un usuario y escribe un mensaje');
        }
    }

    // Banear usuario
    function banUser() {
        const selectedUsers = Array.from(document.querySelectorAll('.select-user:checked'))
            .map(checkbox => checkbox.closest('tr').children[0].textContent.trim());
        const reason = document.getElementById('banReason').value.trim();
        if (selectedUsers.length > 0 && reason) {
            fetch('/ban_user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    users: selectedUsers,
                    reason: reason
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Usuario(s) baneado(s)');
                        loadUsers();
                    } else {
                        alert('Error al banear usuario(s)');
                    }
                })
                .catch(error => console.error('Error al banear usuario(s):', error));
        } else {
            alert('Selecciona al menos un usuario y escribe una razón para el ban');
        }
    }

    // Filtrar listas
    function filterLists() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        filterList('gameTable', query);
        filterList('userTable', query);
    }

    function filterList(tableId, query) {
        const table = document.getElementById(tableId);
        Array.from(table.tBodies[0].rows).forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    }
});

function deleteGame(gameDir) {
    if (confirm('¿Estás seguro de que deseas eliminar este juego?')) {
        fetch(`/games/${gameDir}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (response.ok) {
                    alert('Juego eliminado');
                    location.reload();
                } else {
                    alert('Error al eliminar el juego');
                }
            })
            .catch(error => console.error('Error al eliminar el juego:', error));
    }
}

function deleteReport(reportId) {
    if (confirm('¿Estás seguro de que deseas eliminar este reporte?')) {
        fetch(`/reports/${reportId}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (response.ok) {
                    alert('Reporte eliminado');
                    loadReports();
                } else {
                    alert('Error al eliminar el reporte');
                }
            })
            .catch(error => console.error('Error al eliminar el reporte:', error));
    }
}

