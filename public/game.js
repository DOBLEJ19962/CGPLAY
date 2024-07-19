document.addEventListener('DOMContentLoaded', () => {
    const sessionUser = localStorage.getItem('username');
    const guest = localStorage.getItem('guest');
    const profileLink = document.getElementById('profileLink');
    const uploadLink = document.getElementById('uploadLink');
    const logoutButton = document.getElementById('logoutButton');
    const userMenuContainer = document.getElementById('userMenuContainer');
    const deleteButton = document.getElementById('deleteButton');
    const playButton = document.getElementById('playButton');
    const gameIframe = document.getElementById('gameIframe');
    const reportButton = document.getElementById('reportButton');
    const favoriteButton = document.getElementById('favoriteButton');

    // Limpiar el contenedor antes de agregar el nombre del usuario
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

    const urlParams = new URLSearchParams(window.location.search);
    const dir = urlParams.get('dir');
    if (!dir) {
        alert('No se especificó ningún juego.');
        window.location.href = 'index.html';
        return;
    }

    fetch(`/games`)
        .then(response => response.json())
        .then(games => {
            const game = games.find(g => g.dir === dir);
            if (!game) {
                alert('Juego no encontrado.');
                window.location.href = 'index.html';
                return;
            }

            document.getElementById('gameScreenshot').src = game.coverImagePath;
            document.getElementById('gameName').textContent = game.name;
            document.getElementById('gameDescription').textContent = game.description;
            document.getElementById('gamePlatform').textContent = game.platform;
            document.getElementById('gameGenre').textContent = game.genre;
            document.getElementById('gameEngine').textContent = game.engine;
            document.getElementById('uploadedBy').innerHTML = `<a href="profile.html?user=${game.uploadedBy}">${game.uploadedBy}</a>`;
            document.getElementById('downloadLink').href = game.downloadableFilePath;
            document.getElementById('likeCount').textContent = game.likes || 0;
            document.getElementById('dislikeCount').textContent = game.dislikes || 0;
            document.getElementById('viewCount').textContent = game.views || 0;

            if (game.indexPath) {
                playButton.style.display = 'block';
                playButton.onclick = () => togglePlayGame(game.indexPath);
            }

            if (sessionUser === game.uploadedBy) {
                deleteButton.style.display = 'block';
                deleteButton.onclick = () => {
                    if (confirm('¿Estás seguro de que deseas eliminar el juego?')) {
                        deleteGame(game.dir);
                    }
                };
            }

            reportButton.onclick = () => {
                const reason = prompt('Escribe el motivo del reporte:');
                if (reason) {
                    reportGame(game.dir, game.uploadedBy, sessionUser, reason);
                }
            };

            const screenshotGallery = document.getElementById('screenshotGallery');
            game.screenshotPaths.forEach(path => {
                const img = document.createElement('img');
                img.src = path;
                screenshotGallery.appendChild(img);
            });

            if (game.comments) {
                const commentList = document.getElementById('commentList');
                game.comments.forEach(comment => {
                    const commentElement = document.createElement('div');
                    commentElement.classList.add('comment');
                    commentElement.innerHTML = `
                        <p><strong>${comment.username}</strong>: ${comment.comment}</p>
                        ${sessionUser === comment.username ? `
                            <button class="edit-comment-button" data-id="${comment.id}">Editar</button>
                            <button class="delete-comment-button" data-id="${comment.id}">Eliminar</button>
                        ` : ''}
                    `;
                    commentList.appendChild(commentElement);
                });
            }

            document.querySelectorAll('.edit-comment-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const commentId = event.target.dataset.id;
                    const newComment = prompt('Edita tu comentario:');
                    if (newComment) {
                        editComment(commentId, newComment);
                    }
                });
            });

            document.querySelectorAll('.delete-comment-button').forEach(button => {
                button.addEventListener('click', (event) => {
                    const commentId = event.target.dataset.id;
                    if (confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
                        deleteComment(commentId);
                    }
                });
            });

            // Lógica de favoritos
            updateFavoriteButtonState(dir);

            favoriteButton.addEventListener('click', () => {
                toggleFavoriteGame(dir);
            });
        });

    function togglePlayGame(url) {
        let isGamePlaying = gameIframe.src === url;

        if (isGamePlaying) {
            gameIframe.src = ''; // Pause the game by resetting the src
            gameIframe.style.display = 'none';
            playButton.textContent = 'Jugar';
        } else {
            gameIframe.src = url; // Play the game by setting the src
            gameIframe.style.display = 'block';
            playButton.textContent = 'Pausar';
        }
    }

    document.getElementById('fullScreenButton').onclick = () => {
        if (!document.fullscreenElement) {
            if (gameIframe.requestFullscreen) {
                gameIframe.requestFullscreen();
            } else if (gameIframe.mozRequestFullScreen) { // Firefox
                gameIframe.mozRequestFullScreen();
            } else if (gameIframe.webkitRequestFullscreen) { // Chrome, Safari and Opera
                gameIframe.webkitRequestFullscreen();
            } else if (gameIframe.msRequestFullscreen) { // IE/Edge
                gameIframe.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) { // Firefox
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) { // Chrome, Safari and Opera
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) { // IE/Edge
                document.msExitFullscreen();
            }
        }
    };

    document.getElementById('likeButton').onclick = () => interactWithGame('like');
    document.getElementById('dislikeButton').onclick = () => interactWithGame('dislike');
    document.getElementById('commentButton').onclick = () => {
        const comment = document.getElementById('commentInput').value;
        if (comment) {
            postComment(comment);
        }
    };

    function interactWithGame(type) {
        fetch(`/game/${dir}/interact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    document.getElementById('likeCount').textContent = data.game.likes || 0;
                    document.getElementById('dislikeCount').textContent = data.game.dislikes || 0;
                    document.getElementById('viewCount').textContent = data.game.views || 0;
                }
            });
    }

    function postComment(comment) {
        fetch(`/game/${dir}/comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ comment })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const commentList = document.getElementById('commentList');
                    const commentElement = document.createElement('div');
                    commentElement.classList.add('comment');
                    commentElement.innerHTML = `
                        <p><strong>${data.game.comments[data.game.comments.length - 1].username}</strong>: ${data.game.comments[data.game.comments.length - 1].comment}</p>
                        ${sessionUser === data.game.comments[data.game.comments.length - 1].username ? `
                            <button class="edit-comment-button" data-id="${data.game.comments[data.game.comments.length - 1].id}">Editar</button>
                            <button class="delete-comment-button" data-id="${data.game.comments[data.game.comments.length - 1].id}">Eliminar</button>
                        ` : ''}
                    `;
                    commentList.appendChild(commentElement);
                    document.getElementById('commentInput').value = '';

                    document.querySelectorAll('.edit-comment-button').forEach(button => {
                        button.addEventListener('click', (event) => {
                            const commentId = event.target.dataset.id;
                            const newComment = prompt('Edita tu comentario:');
                            if (newComment) {
                                editComment(commentId, newComment);
                            }
                        });
                    });

                    document.querySelectorAll('.delete-comment-button').forEach(button => {
                        button.addEventListener('click', (event) => {
                            const commentId = event.target.dataset.id;
                            if (confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
                                deleteComment(commentId);
                            }
                        });
                    });
                }
            });
    }

    function editComment(commentId, newComment) {
        fetch(`/game/${dir}/comment`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ commentId, newComment })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const commentList = document.getElementById('commentList');
                    commentList.innerHTML = '';
                    data.game.comments.forEach(comment => {
                        const commentElement = document.createElement('div');
                        commentElement.classList.add('comment');
                        commentElement.innerHTML = `
                            <p><strong>${comment.username}</strong>: ${comment.comment}</p>
                            ${sessionUser === comment.username ? `
                                <button class="edit-comment-button" data-id="${comment.id}">Editar</button>
                                <button class="delete-comment-button" data-id="${comment.id}">Eliminar</button>
                            ` : ''}
                        `;
                        commentList.appendChild(commentElement);
                    });

                    document.querySelectorAll('.edit-comment-button').forEach(button => {
                        button.addEventListener('click', (event) => {
                            const commentId = event.target.dataset.id;
                            const newComment = prompt('Edita tu comentario:');
                            if (newComment) {
                                editComment(commentId, newComment);
                            }
                        });
                    });

                    document.querySelectorAll('.delete-comment-button').forEach(button => {
                        button.addEventListener('click', (event) => {
                            const commentId = event.target.dataset.id;
                            if (confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
                                deleteComment(commentId);
                            }
                        });
                    });
                }
            });
    }

    function deleteComment(commentId) {
        fetch(`/game/${dir}/comment`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ commentId })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const commentList = document.getElementById('commentList');
                    commentList.innerHTML = '';
                    data.game.comments.forEach(comment => {
                        const commentElement = document.createElement('div');
                        commentElement.classList.add('comment');
                        commentElement.innerHTML = `
                            <p><strong>${comment.username}</strong>: ${comment.comment}</p>
                            ${sessionUser === comment.username ? `
                                <button class="edit-comment-button" data-id="${comment.id}">Editar</button>
                                <button class="delete-comment-button" data-id="${comment.id}">Eliminar</button>
                            ` : ''}
                        `;
                        commentList.appendChild(commentElement);
                    });

                    document.querySelectorAll('.edit-comment-button').forEach(button => {
                        button.addEventListener('click', (event) => {
                            const commentId = event.target.dataset.id;
                            const newComment = prompt('Edita tu comentario:');
                            if (newComment) {
                                editComment(commentId, newComment);
                            }
                        });
                    });

                    document.querySelectorAll('.delete-comment-button').forEach(button => {
                        button.addEventListener('click', (event) => {
                            const commentId = event.target.dataset.id;
                            if (confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
                                deleteComment(commentId);
                            }
                        });
                    });
                }
            });
    }

    function reportGame(gameDir, reportedUser, reportedBy, reason) {
        fetch('/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ gameDir, reportedUser, reportedBy, reason })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Reporte enviado');
                } else {
                    alert('Error al enviar el reporte');
                }
            })
            .catch(error => console.error('Error al enviar el reporte:', error));
    }

    function deleteGame(dir) {
        fetch(`/games/${dir}`, {
            method: 'DELETE'
        })
            .then(response => {
                if (response.ok) {
                    alert('Juego eliminado correctamente.');
                    window.location.href = 'index.html';
                } else {
                    alert('Error al eliminar el juego.');
                }
            });
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

    function updateFavoriteButtonState(gameDir) {
        const favorites = loadFavorites();
        if (favorites.includes(gameDir)) {
            favoriteButton.textContent = 'Eliminar de Favoritos';
        } else {
            favoriteButton.textContent = 'Añadir a Favoritos';
        }
    }

    function toggleFavoriteGame(gameDir) {
        const favorites = loadFavorites();
        if (favorites.includes(gameDir)) {
            removeFavorite(gameDir);
            favoriteButton.textContent = 'Añadir a Favoritos';
            alert('Juego eliminado de favoritos');
        } else {
            addFavorite(gameDir);
            favoriteButton.textContent = 'Eliminar de Favoritos';
            alert('Juego añadido a favoritos');
        }
    }
});
