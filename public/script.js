document.addEventListener('DOMContentLoaded', () => {
    loadGames();

    const sessionUser = localStorage.getItem('username');
    const guest = localStorage.getItem('guest');
    const profileLink = document.getElementById('profileLink');
    const uploadLink = document.getElementById('uploadLink');
    const logoutButton = document.getElementById('logoutButton');
    const userMenuContainer = document.getElementById('userMenuContainer');
    const notificationButton = document.getElementById('notificationButton');
    const notificationCount = document.getElementById('notificationCount');
    const notifications = document.getElementById('notifications');

    if (sessionUser) {
        const userProfileLink = document.createElement('a');
        userProfileLink.href = `profile.html?user=${sessionUser}`;
        userProfileLink.textContent = sessionUser;
        const userProfileListItem = document.createElement('li');
        userProfileListItem.appendChild(userProfileLink);
        userMenuContainer.appendChild(userProfileListItem);

        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('username');
            localStorage.removeItem('guest');
            window.location.href = 'login.html';
        });

        profileLink.style.display = 'block';
        uploadLink.style.display = 'block';
        logoutButton.style.display = 'block';
    } else if (guest) {
        const guestLink = document.createElement('a');
        guestLink.href = 'login.html';
        guestLink.textContent = 'Login';
        const guestListItem = document.createElement('li');
        guestListItem.appendChild(guestLink);
        userMenuContainer.appendChild(guestListItem);

        profileLink.style.display = 'none';
        uploadLink.style.display = 'none';
        logoutButton.style.display = 'none';
    } else {
        const loginLink = document.createElement('a');
        loginLink.href = 'login.html';
        loginLink.textContent = 'Login';
        const loginListItem = document.createElement('li');
        loginListItem.appendChild(loginLink);
        userMenuContainer.appendChild(loginListItem);

        profileLink.style.display = 'none';
        uploadLink.style.display = 'none';
        logoutButton.style.display = 'none';
    }

    if (sessionUser) {
        fetch(`/notifications/${sessionUser}`)
            .then(response => response.json())
            .then(data => {
                if (data.notifications && data.notifications.length > 0) {
                    notificationCount.textContent = data.notifications.length;
                    notificationCount.style.display = 'inline';
                    data.notifications.forEach(notification => {
                        const notificationItem = document.createElement('div');
                        notificationItem.classList.add('notification-item');
                        notificationItem.innerHTML = `
                            <img src="${notification.profilePicture}" alt="Profile Picture" class="profile-picture">
                            <a href="profile.html?user=${notification.senderUsername}" class="notification-user">${notification.senderUsername}</a>
                            <span> ${notification.message}</span>
                        `;
                        notificationItem.addEventListener('click', () => {
                            window.location.href = notification.url;
                        });
                        notifications.appendChild(notificationItem);
                    });
                }
            })
            .catch(error => console.error('Error al cargar notificaciones:', error));

        notificationButton.addEventListener('click', () => {
            notifications.style.display = notifications.style.display === 'none' ? 'block' : 'none';
        });

        document.getElementById('clearNotificationsButton').addEventListener('click', (event) => {
            event.preventDefault();
            if (confirm('¿Estás seguro de que quieres eliminar todas las notificaciones?')) {
                clearNotifications(sessionUser);
            }
        });
    }

    function handleStarClick(event, game) {
        const star = event.target;
        const isFavorite = star.classList.contains('favorite');

        if (isFavorite) {
            star.classList.remove('favorite');
            showNotification(`Quitaste "${game.name}" de tus favoritos`);
            removeFavorite(game.dir);
        } else {
            star.classList.add('favorite');
            showNotification(`Añadiste "${game.name}" a tus favoritos`);
            addFavorite(game.dir);
        }
    }

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    function loadFavorites() {
        const favorites = localStorage.getItem('favorites');
        return favorites ? JSON.parse(favorites) : [];
    }

    function saveFavorites(favorites) {
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }

    function addFavorite(gameDir) {
        const favorites = loadFavorites();
        favorites.push(gameDir);
        saveFavorites(favorites);
    }

    function removeFavorite(gameDir) {
        let favorites = loadFavorites();
        favorites = favorites.filter(fav => fav !== gameDir);
        saveFavorites(favorites);
    }

    function displayGames(games) {
        const gameList = document.getElementById('games');
        gameList.innerHTML = '';
        const favorites = loadFavorites();

        games.forEach(game => {
            const gameItem = document.createElement('li');
            gameItem.innerHTML = `
                <a href="game.html?dir=${game.dir}" class="game-info">
                    <img src="${game.coverImagePath}" alt="${game.name} Cover" class="screenshot">
                    <h3>${game.name}</h3>
                    <p>Subido por: <a href="profile.html?user=${game.uploadedBy}">${game.uploadedBy}</a></p>
                    <p>Género: ${game.genre}</p>
                    <p>Plataforma: ${game.platform}</p>
                    <p>Motor: ${game.engine}</p>
                </a>
                <span class="star ${favorites.includes(game.dir) ? 'favorite' : ''}" data-dir="${game.dir}">★</span>
            `;
            gameList.appendChild(gameItem);

            const star = gameItem.querySelector('.star');
            star.addEventListener('click', (event) => handleStarClick(event, game));
        });
    }

    function loadGames() {
        fetch('/games')
            .then(response => response.json())
            .then(games => {
                // Ensure uploadDate is parsed as a Date object
                games.forEach(game => {
                    game.uploadDate = new Date(game.uploadDate);
                });

                displayGames(games);
                populateFilters(games);
                document.getElementById('searchInput').addEventListener('input', () => filterGames(games));
                document.getElementById('genreFilter').addEventListener('change', () => filterGames(games));
                document.getElementById('platformFilter').addEventListener('change', () => filterGames(games));
                document.getElementById('engineFilter').addEventListener('change', () => filterGames(games));
                document.getElementById('relevanceFilter').addEventListener('change', () => filterGames(games));
            })
            .catch(error => {
                console.error('Error al cargar los juegos:', error);
            });
    }

    function clearNotifications(username) {
        fetch(`/notifications/${username}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    const notifications = document.getElementById('notifications');
                    notifications.innerHTML = '<a id="clearNotificationsButton" href="#" style="display: block; padding: 10px; color: red; text-align: center;">Limpiar Notificaciones</a>';
                    document.getElementById('notificationCount').style.display = 'none';
                } else {
                    alert('No se pudieron eliminar las notificaciones');
                }
            })
            .catch(error => {
                console.error('Error al eliminar las notificaciones:', error);
            });
    }

    function populateFilters(games) {
        const genres = new Set();
        const platforms = new Set();
        const engines = new Set();

        games.forEach(game => {
            genres.add(game.genre);
            platforms.add(game.platform);
            engines.add(game.engine);
        });

        const genreFilter = document.getElementById('genreFilter');
        const platformFilter = document.getElementById('platformFilter');
        const engineFilter = document.getElementById('engineFilter');

        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreFilter.appendChild(option);
        });

        platforms.forEach(platform => {
            const option = document.createElement('option');
            option.value = platform;
            option.textContent = platform;
            platformFilter.appendChild(option);
        });

        engines.forEach(engine => {
            const option = document.createElement('option');
            option.value = engine;
            option.textContent = engine;
            engineFilter.appendChild(option);
        });
    }

    function filterGames(allGames) {
        const searchInput = document.getElementById('searchInput').value.toLowerCase();
        const genreFilter = document.getElementById('genreFilter').value;
        const platformFilter = document.getElementById('platformFilter').value;
        const engineFilter = document.getElementById('engineFilter').value;
        const relevanceFilter = document.getElementById('relevanceFilter').value;
        const favorites = loadFavorites();

        let filteredGames = allGames.filter(game => {
            const matchesSearch = game.name.toLowerCase().includes(searchInput) || game.uploadedBy.toLowerCase().includes(searchInput);
            const matchesGenre = genreFilter === '' || game.genre === genreFilter;
            const matchesPlatform = platformFilter === '' || game.platform === platformFilter;
            const matchesEngine = engineFilter === '' || game.engine === engineFilter;
            return matchesSearch && matchesGenre && matchesPlatform && matchesEngine;
        });

        if (relevanceFilter === 'favorites') {
            filteredGames = filteredGames.filter(game => favorites.includes(game.dir));
        } else if (relevanceFilter === 'mostPopular') {
            filteredGames.sort((a, b) => b.likes - a.likes);
        } else if (relevanceFilter === 'leastPopular') {
            filteredGames.sort((a, b) => a.likes - b.likes);
        } else if (relevanceFilter === 'newest') {
            filteredGames.sort((a, b) => b.uploadDate - a.uploadDate);
        }

        displayGames(filteredGames);
    }
});
