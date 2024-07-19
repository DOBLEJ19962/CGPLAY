document.addEventListener('DOMContentLoaded', () => {
    const sessionUser = localStorage.getItem('username');
    const profileLink = document.getElementById('profileLink');
    const uploadLink = document.getElementById('uploadLink');
    const logoutButton = document.getElementById('logoutButton');
    const userMenuContainer = document.getElementById('userMenuContainer');
    const editProfileButton = document.getElementById('editProfileButton');
    const deleteAccountButton = document.getElementById('deleteAccountButton');

    userMenuContainer.innerHTML = '';

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
    } else {
        window.location.href = 'login.html';
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('user') || sessionUser;

    fetch(`/profile/${username}`)
        .then(response => response.json())
        .then(user => {
            if (!user) {
                alert('Usuario no encontrado.');
                window.location.href = 'index.html';
                return;
            }

            const defaultProfilePicture = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
            const profilePictureElement = document.getElementById('profilePicture');

            profilePictureElement.src = user.profilePicture || defaultProfilePicture;
            profilePictureElement.onerror = function () {
                this.src = defaultProfilePicture;
            };

            document.getElementById('username').textContent = user.username;
            document.getElementById('phone').textContent = user.phone || 'No disponible';
            document.getElementById('email').textContent = user.email || 'No disponible';
            document.getElementById('description').textContent = user.description || 'No disponible';
            document.getElementById('likeCount').textContent = user.likes || 0;
            document.getElementById('viewCount').textContent = user.views || 0;
            document.getElementById('commentCount').textContent = user.comments || 0;

            const userGames = document.getElementById('userGames');
            userGames.innerHTML = ''; // Limpiar la lista de juegos
            user.games.forEach(game => {
                const gameItem = document.createElement('li');
                gameItem.innerHTML = `<a href="game.html?dir=${game.dir}">${game.name}</a>`;
                userGames.appendChild(gameItem);
            });

            if (username === sessionUser) {
                editProfileButton.style.display = 'block';
                deleteAccountButton.style.display = 'block';
                editProfileButton.onclick = () => window.location.href = 'edit_profile.html';
                deleteAccountButton.onclick = () => deleteAccount(username);
            }
        });

    function deleteAccount(username) {
        fetch(`/delete_account/${username}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (response.ok) {
                    alert('Cuenta eliminada correctamente.');
                    localStorage.removeItem('username');
                    window.location.href = 'login.html';
                } else {
                    alert('Error al eliminar la cuenta.');
                }
            });
    }
});
