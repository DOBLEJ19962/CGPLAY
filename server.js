const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const compression = require('compression');
const { Storage } = require('@google-cloud/storage');
const unzipper = require('unzipper');
const async = require('async');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const port = 3000;

// Configuración de Google Cloud Storage
const storage = new Storage({
    keyFilename: path.join(__dirname, 'storageweb-6f981ed9e26d.json'),
    projectId: 'storageweb'
});
const bucket = storage.bucket('cevestorage');

// Usar compresión
app.use(compression());

// Configuración de la sesión
app.use(session({
    secret: 'mySecretKey',
    resave: false,
    saveUninitialized: true,
}));

// Middleware para parsear JSON y datos de formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de almacenamiento de multer
const upload = multer({ storage: multer.memoryStorage() });

// Middleware para servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para servir archivos Brotli con la cabecera correcta
app.use((req, res, next) => {
    if (req.url.endsWith('.br')) {
        res.set('Content-Encoding', 'br');
    }
    next();
});

// Middleware para habilitar Cross-Origin Isolation
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

// Middleware para verificar si el usuario está autenticado y no baneado
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        readJSONFile('banned_emails.json', (err, bannedUsers) => {
            if (err) {
                return res.status(500).send('Error al leer los datos');
            }
            const bannedUser = bannedUsers.find(banned => banned.email === req.session.user.email);
            if (bannedUser) {
                req.session.destroy(() => {
                    res.redirect(`/banned.html?username=${bannedUser.username}&email=${bannedUser.email}&reason=${encodeURIComponent(bannedUser.reason)}&date=${bannedUser.date}`);
                });
            } else {
                next();
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'Debe iniciar sesión para realizar esta acción' });
    }
}


// Middleware para permitir el acceso solo a las páginas de login y registro para usuarios baneados
app.use((req, res, next) => {
    const publicPages = ['/login.html', '/register.html', '/banned.html'];
    const isPublicPage = publicPages.includes(req.path);

    if (!isPublicPage && req.session && req.session.user) {
        readJSONFile('banned_emails.json', (err, bannedUsers) => {
            if (err) {
                return res.status(500).send('Error al leer los datos');
            }
            const bannedUser = bannedUsers.find(banned => banned.email === req.session.user.email);
            if (bannedUser) {
                req.session.destroy(() => {
                    res.redirect(`/banned.html?username=${bannedUser.username}&email=${bannedUser.email}&reason=${encodeURIComponent(bannedUser.reason)}&date=${bannedUser.date}`);
                });
            } else {
                next();
            }
        });
    } else {
        next();
    }
});

// Configuración de Nodemailer con Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'cevesgames@gmail.com', // Reemplaza con tu dirección de correo de Gmail
        pass: 'rcxucvbuowhofcge' // Reemplaza con la contraseña de aplicación generada
    }
});

// Función para leer y parsear JSON de manera segura
function readJSONFile(filePath, callback) {
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                return callback(null, []); // Si el archivo no existe, devuelve un array vacío
            } else {
                return callback(err);
            }
        }
        try {
            const json = JSON.parse(data);
            callback(null, json);
        } catch (parseErr) {
            callback(parseErr);
        }
    });
}

// Función para agregar notificación
function addNotification(targetUsername, message, url, senderUsername) {
    readJSONFile('users.json', (err, users) => {
        if (err) {
            return console.error('Error al leer los usuarios', err);
        }
        const sender = users.find(user => user.username === senderUsername);
        const profilePicture = sender ? sender.profilePicture : 'Logo/user.png';

        readJSONFile('notifications.json', (err, notifications) => {
            if (err) {
                notifications = [];
            }
            notifications.push({ targetUsername, senderUsername, message, profilePicture, url, date: new Date() });
            fs.writeFile('notifications.json', JSON.stringify(notifications, null, 2), (err) => {
                if (err) {
                    console.error('Error al guardar la notificación', err);
                }
            });
        });
    });
}

function isAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'No tiene permisos para acceder a esta página' });
    }
}



// Ruta para manejar el registro de usuarios
app.post('/register', (req, res) => {
    const { username, email, password } = req.body;

    // Validación del nombre de usuario
    if (username.length <= 5 || /^[0-9]+$/.test(username)) {
        return res.json({ success: false, message: 'El nombre de usuario debe tener más de 5 caracteres y no puede contener solo números.' });
    }

    // Validación de la contraseña
    if (password.length <= 6) {
        return res.json({ success: false, message: 'La contraseña debe tener más de 6 caracteres.' });
    }

    readJSONFile('banned_emails.json', (err, bannedUsers) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const bannedUser = bannedUsers.find(user => user.email === email);
        if (bannedUser) {
            // Redirección a banned.html con la información del baneo
            return res.json({
                success: false,
                redirectUrl: `/banned.html?username=${bannedUser.username}&email=${bannedUser.email}&reason=${encodeURIComponent(bannedUser.reason)}&date=${bannedUser.date}`
            });
        }

        readJSONFile('users.json', (err, users) => {
            if (err) {
                return res.status(500).send('Error al leer los datos');
            }

            const existingUser = users.find(user => user.username === username || user.email === email);
            if (existingUser) {
                return res.json({ success: false, message: 'El nombre de usuario o el correo electrónico ya están en uso' });
            }

            const hashedPassword = bcrypt.hashSync(password, 10);
            users.push({ username, email, password: hashedPassword, role: 'user', profilePicture: 'Logo/user.png' });


            fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
                if (err) {
                    return res.status(500).send('Error al guardar los datos');
                }
                res.json({ success: true });
            });
        });
    });
});

// Ruta para manejar el login de usuarios
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    readJSONFile('banned_emails.json', (err, bannedUsers) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const bannedUser = bannedUsers.find(banned => banned.username === username);
        if (bannedUser) {
            return res.json({
                success: false,
                redirectUrl: `/banned.html?username=${bannedUser.username}&email=${bannedUser.email}&reason=${encodeURIComponent(bannedUser.reason)}&date=${bannedUser.date}`
            });
        }

        readJSONFile('users.json', (err, users) => {
            if (err) {
                return res.status(500).send('Error al leer los datos');
            }

            const user = users.find(user => user.username === username);
            if (!user || !bcrypt.compareSync(password, user.password)) {
                return res.json({ success: false, message: 'Nombre de usuario o contraseña incorrectos' });
            }

            req.session.user = user;
            res.json({ success: true });
        });
    });
});



// Ruta para manejar la solicitud de recuperación de contraseña
app.post('/forgot_password', (req, res) => {
    const { email } = req.body;

    readJSONFile('users.json', (err, users) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const user = users.find(user => user.email === email);
        if (!user) {
            return res.json({ success: false, message: 'Correo electrónico no encontrado' });
        }

        const token = crypto.randomBytes(20).toString('hex');
        const resetPasswordToken = {
            email,
            token,
            expires: Date.now() + 3600000 // 1 hora para expirar
        };

        readJSONFile('tokens.json', (err, tokens) => {
            if (err) {
                return res.status(500).send('Error al leer los datos');
            }

            tokens.push(resetPasswordToken);
            fs.writeFile('tokens.json', JSON.stringify(tokens, null, 2), (err) => {
                if (err) {
                    return res.status(500).send('Error al guardar los datos');
                }

                const mailOptions = {
                    to: email,
                    from: 'cevesgames@gmail.com',
                    subject: 'Recuperación de Contraseña',
                    text: `Recibiste este correo porque tú (u otra persona) solicitó el restablecimiento de la contraseña para tu cuenta.\n\n` +
                        `Por favor, haz clic en el siguiente enlace, o cópialo y pégalo en tu navegador para completar el proceso:\n\n` +
                        `http://${req.headers.host}/reset_password.html?token=${token}\n\n` +
                        `Si no solicitaste esto, ignora este correo y tu contraseña permanecerá sin cambios.\n`
                };

                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        console.error('Error al enviar el correo:', err);
                        return res.status(500).send('Error al enviar el correo');
                    }
                    console.log('Correo enviado: %s', info.messageId);
                    res.json({ success: true });
                });
            });
        });
    });
});

// Ruta para manejar el restablecimiento de contraseña
app.post('/reset_password', (req, res) => {
    const { token, password } = req.body;

    // Validación de la contraseña
    if (password.length <= 6) {
        return res.json({ success: false, message: 'La contraseña debe tener más de 6 caracteres.' });
    }

    readJSONFile('tokens.json', (err, tokens) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const tokenData = tokens.find(t => t.token === token && t.expires > Date.now());
        if (!tokenData) {
            return res.json({ success: false, message: 'Token inválido o expirado' });
        }

        readJSONFile('users.json', (err, users) => {
            if (err) {
                return res.status(500).send('Error al leer los datos');
            }

            const user = users.find(user => user.email === tokenData.email);
            if (!user) {
                return res.status(404).send('Usuario no encontrado');
            }

            user.password = bcrypt.hashSync(password, 10);

            fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
                if (err) {
                    return res.status(500).send('Error al guardar los datos');
                }

                // Eliminar el token después de su uso
                const updatedTokens = tokens.filter(t => t.token !== token);

                fs.writeFile('tokens.json', JSON.stringify(updatedTokens, null, 2), (err) => {
                    if (err) {
                        return res.status(500).send('Error al guardar los datos');
                    }
                    res.json({ success: true });
                });
            });
        });
    });
});

// Ruta para obtener el perfil del usuario
app.get('/profile/:username', (req, res) => {
    const username = req.params.username;

    readJSONFile('users.json', (err, users) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const user = users.find(user => user.username === username);
        if (!user) {
            return res.status(404).send('Usuario no encontrado');
        }

        readJSONFile('games.json', (err, games) => {
            if (err) {
                return res.status(500).send('Error al leer los datos');
            }

            user.games = games.filter(game => game.uploadedBy === username);
            user.likes = games.reduce((total, game) => total + (game.likes || 0), 0);
            user.views = games.reduce((total, game) => total + (game.views || 0), 0);
            user.comments = games.reduce((total, game) => total + (game.comments ? game.comments.length : 0), 0);
            res.json(user);
        });
    });
});

// Ruta para editar el perfil del usuario
app.post('/edit_profile', isAuthenticated, upload.single('profilePicture'), (req, res) => {
    const { phone, email, description } = req.body;
    const profilePicture = req.file;
    const username = req.session.user.username;

    readJSONFile('users.json', (err, users) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const user = users.find(user => user.username === username);
        if (!user) {
            return res.status(404).send('Usuario no encontrado');
        }

        user.phone = phone;
        user.email = email;
        user.description = description;

        if (profilePicture) {
            const profilePicName = `profile_pics/${Date.now()}-${profilePicture.originalname}`;
            const blob = bucket.file(profilePicName);
            const blobStream = blob.createWriteStream({
                resumable: false,
                gzip: true,
                metadata: {
                    contentType: profilePicture.mimetype
                }
            });

            blobStream.on('error', err => {
                console.error('Error al subir la foto de perfil:', err);
                return res.status(500).send('Error al subir la foto de perfil');
            });

            blobStream.on('finish', () => {
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
                user.profilePicture = publicUrl;

                fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
                    if (err) {
                        return res.status(500).send('Error al guardar los datos');
                    }
                    res.redirect('/profile.html');
                });
            });

            blobStream.end(profilePicture.buffer);
        } else {
            fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
                if (err) {
                    return res.status(500).send('Error al guardar los datos');
                }
                res.redirect('/profile.html');
            });
        }
    });
});

// Ruta para eliminar la cuenta del usuario
app.delete('/delete_account/:username', isAuthenticated, (req, res) => {
    const username = req.params.username;

    readJSONFile('users.json', (err, users) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const userIndex = users.findIndex(user => user.username === username);
        if (userIndex === -1) {
            return res.status(404).send('Usuario no encontrado');
        }

        users.splice(userIndex, 1);

        fs.writeFile('users.json', JSON.stringify(users, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar los datos');
            }
            res.sendStatus(200);
        });
    });
});

// Ruta para manejar la subida del juego
app.post('/upload', isAuthenticated, upload.fields([
    { name: 'gameFile', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'screenshots', maxCount: 10 },
    { name: 'downloadableFile', maxCount: 1 }
]), (req, res) => {
    const timestamp = Date.now();
    const gameDir = `${timestamp}-${req.body.gameName.replace(/\s+/g, '_')}`;
    const coverImagePath = req.files['coverImage'] ? `games/${gameDir}/cover/${req.files['coverImage'][0].originalname}` : '';
    const screenshotPaths = req.files['screenshots'] ? req.files['screenshots'].map(file => `games/${gameDir}/screenshots/${file.originalname}`) : [];
    const downloadableFilePath = req.files['downloadableFile'] ? `games/${gameDir}/download/${req.files['downloadableFile'][0].originalname}` : '';

    const gameData = {
        name: req.body.gameName,
        description: req.body.gameDescription || '',
        platform: req.body.platform,
        genre: req.body.genre,
        engine: req.body.engine,
        dir: gameDir,
        coverImagePath: coverImagePath,
        screenshotPaths: screenshotPaths,
        downloadableFilePath: downloadableFilePath,
        uploadedBy: req.session.user.username,
        uploadDate: new Date(), // Añadimos la fecha de subida aquí
        likes: 0,
        dislikes: 0,
        views: 0,
        comments: []
    };

    const uploadToGCS = (file, folder, callback) => {
        const filePath = `${folder}/${file.originalname}`;
        const mimeType = getMimeType(filePath);
        const blob = bucket.file(filePath);
        const blobStream = blob.createWriteStream({
            resumable: false,
            gzip: true,
            metadata: {
                contentType: mimeType,
            }
        });

        blobStream.on('error', err => {
            console.error('Error al subir el archivo a GCS:', err);
            callback(err);
        });

        blobStream.on('finish', () => {
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
            blob.makePublic().then(() => {
                callback(null, publicUrl);
            }).catch(err => {
                callback(err);
            });
        });

        blobStream.end(file.buffer);
    };

    const getMimeType = (filePath) => {
        if (filePath.endsWith('.html')) return 'text/html';
        if (filePath.endsWith('.css')) return 'text/css';
        if (filePath.endsWith('.js')) return 'application/javascript';
        if (filePath.endsWith('.json')) return 'application/json';
        if (filePath.endsWith('.png')) return 'image/png';
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
        // Añade más tipos MIME según sea necesario
        return 'application/octet-stream';
    };

    const updateMetadata = (filePath, callback) => {
        const file = bucket.file(filePath);
        file.getMetadata((err, metadata) => {
            if (err) {
                return callback(err);
            }

            const contentType = getMimeType(filePath);

            file.setMetadata({
                contentType: contentType,
            }, callback);
        });
    };

    const tasks = [];

    if (req.files['coverImage']) {
        tasks.push(callback => {
            uploadToGCS(req.files['coverImage'][0], `games/${gameDir}/cover`, (err, url) => {
                if (err) return callback(err);
                gameData.coverImagePath = url;
                callback();
            });
        });
    }

    if (req.files['screenshots']) {
        req.files['screenshots'].forEach(file => {
            tasks.push(callback => {
                uploadToGCS(file, `games/${gameDir}/screenshots`, (err, url) => {
                    if (err) return callback(err);
                    gameData.screenshotPaths.push(url);
                    callback();
                });
            });
        });
    }

    if (req.files['downloadableFile']) {
        tasks.push(callback => {
            uploadToGCS(req.files['downloadableFile'][0], `games/${gameDir}/download`, (err, url) => {
                if (err) return callback(err);
                gameData.downloadableFilePath = url;
                callback();
            });
        });
    }

    if (req.files['gameFile']) {
        tasks.push(callback => {
            const zipFileBuffer = req.files['gameFile'][0].buffer;

            unzipper.Open.buffer(zipFileBuffer).then(directory => {
                const fileUploadTasks = directory.files.map(file => {
                    return cb => {
                        const filePath = `games/${gameDir}/${file.path}`;
                        const mimeType = getMimeType(filePath);

                        file.stream()
                            .pipe(bucket.file(filePath).createWriteStream({
                                resumable: false,
                                gzip: true,
                                metadata: {
                                    contentType: mimeType,
                                }
                            }))
                            .on('error', err => cb(err))
                            .on('finish', () => {
                                updateMetadata(filePath, cb); // Actualizar metadatos después de la subida
                            });
                    };
                });

                async.parallel(fileUploadTasks, err => {
                    if (err) return callback(err);

                    gameData.indexPath = `https://storage.googleapis.com/${bucket.name}/games/${gameDir}/index.html`;

                    callback();
                });
            }).catch(err => {
                console.error('Error al descomprimir el archivo ZIP:', err);
                callback(err);
            });
        });
    }

    async.parallel(tasks, err => {
        if (err) {
            console.error('Error al subir archivos:', err);
            return res.status(500).send('Error al subir archivos');
        }

        readJSONFile('games.json', (err, games) => {
            if (err) {
                console.error('Error al leer los datos:', err);
                return res.status(500).send('Error al leer los datos');
            }

            games.push(gameData);

            fs.writeFile('games.json', JSON.stringify(games, null, 2), (err) => {
                if (err) {
                    console.error('Error al guardar los datos:', err);
                    return res.status(500).send('Error al guardar los datos');
                }
                res.redirect('/');
            });
        });
    });
});


// Ruta para obtener la lista de juegos
app.get('/games', (req, res) => {
    readJSONFile('games.json', (err, games) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }
        res.json(games);
    });
});

// Ruta para manejar likes, dislikes y vistas
app.post('/game/:dir/interact', isAuthenticated, (req, res) => {
    const gameDir = req.params.dir;
    const { type } = req.body;
    const username = req.session.user.username;

    readJSONFile('games.json', (err, games) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const game = games.find(game => game.dir === gameDir);
        if (!game) {
            return res.status(404).send('Juego no encontrado');
        }

        if (!game.viewsByUser) {
            game.viewsByUser = [];
        }

        if (!game.viewsByUser.includes(username)) {
            game.viewsByUser.push(username);
            game.views = (game.views || 0) + 1;
        }

        if (!game.likesByUser) {
            game.likesByUser = [];
        }

        if (!game.dislikesByUser) {
            game.dislikesByUser = [];
        }

        if (type === 'like') {
            if (!game.likesByUser.includes(username)) {
                game.likesByUser.push(username);
                game.likes = (game.likes || 0) + 1;
                const dislikeIndex = game.dislikesByUser.indexOf(username);
                if (dislikeIndex !== -1) {
                    game.dislikesByUser.splice(dislikeIndex, 1);
                    game.dislikes = (game.dislikes || 0) - 1;
                }
                addNotification(game.uploadedBy, `le dio like a tu juego "${game.name}"`, `/game.html?dir=${game.dir}`, username);
            } else {
                const likeIndex = game.likesByUser.indexOf(username);
                game.likesByUser.splice(likeIndex, 1);
                game.likes = (game.likes || 0) - 1;
            }
        } else if (type === 'dislike') {
            if (!game.dislikesByUser.includes(username)) {
                game.dislikesByUser.push(username);
                game.dislikes = (game.dislikes || 0) + 1;
                const likeIndex = game.likesByUser.indexOf(username);
                if (likeIndex !== -1) {
                    game.likesByUser.splice(likeIndex, 1);
                    game.likes = (game.likes || 0) - 1;
                }
                addNotification(game.uploadedBy, `le dio dislike a tu juego "${game.name}"`, `/game.html?dir=${game.dir}`, username);
            } else {
                const dislikeIndex = game.dislikesByUser.indexOf(username);
                game.dislikesByUser.splice(dislikeIndex, 1);
                game.dislikes = (game.dislikes || 0) - 1;
            }
        }

        fs.writeFile('games.json', JSON.stringify(games, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar los datos');
            }
            res.json({ success: true, game });
        });
    });
});

// Ruta para manejar comentarios
app.post('/game/:dir/comment', isAuthenticated, (req, res) => {
    const gameDir = req.params.dir;
    const { comment } = req.body;
    const username = req.session.user.username;

    readJSONFile('games.json', (err, games) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const game = games.find(game => game.dir === gameDir);
        if (!game) {
            return res.status(404).send('Juego no encontrado');
        }

        if (!game.comments) {
            game.comments = [];
        }

        const newComment = { id: Date.now().toString(), username, comment, date: new Date() };
        game.comments.push(newComment);
        addNotification(game.uploadedBy, `comentó en tu juego "${game.name}"`, `/game.html?dir=${game.dir}#comment-${newComment.id}`, username);

        fs.writeFile('games.json', JSON.stringify(games, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar los datos');
            }
            res.json({ success: true, game });
        });
    });
});

// Ruta para manejar la edición de comentarios
app.put('/game/:dir/comment', isAuthenticated, (req, res) => {
    const gameDir = req.params.dir;
    const { commentId, newComment } = req.body;
    const username = req.session.user.username;

    readJSONFile('games.json', (err, games) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const game = games.find(game => game.dir === gameDir);
        if (!game) {
            return res.status(404).send('Juego no encontrado');
        }

        const comment = game.comments.find(c => c.id === commentId && c.username === username);
        if (!comment) {
            return res.status(404).send('Comentario no encontrado o no tiene permiso para editarlo');
        }

        comment.comment = newComment;
        comment.date = new Date();

        fs.writeFile('games.json', JSON.stringify(games, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar los datos');
            }
            res.json({ success: true, game });
        });
    });
});

// Ruta para manejar la eliminación de comentarios
app.delete('/game/:dir/comment', isAuthenticated, (req, res) => {
    const gameDir = req.params.dir;
    const { commentId } = req.body;
    const username = req.session.user.username;

    readJSONFile('games.json', (err, games) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const game = games.find(game => game.dir === gameDir);
        if (!game) {
            return res.status(404).send('Juego no encontrado');
        }

        const commentIndex = game.comments.findIndex(c => c.id === commentId && c.username === username);
        if (commentIndex === -1) {
            return res.status(404).send('Comentario no encontrado o no tiene permiso para eliminarlo');
        }

        game.comments.splice(commentIndex, 1);

        fs.writeFile('games.json', JSON.stringify(games, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar los datos');
            }
            res.json({ success: true, game });
        });
    });
});

// Ruta para eliminar un juego
app.delete('/games/:dir', isAuthenticated, (req, res) => {
    const gameDir = req.params.dir;

    readJSONFile('games.json', (err, games) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        const gameIndex = games.findIndex(g => g.dir === gameDir);
        if (gameIndex === -1) {
            return res.status(404).send('Juego no encontrado');
        }

        const game = games[gameIndex];
        games.splice(gameIndex, 1);

        fs.writeFile('games.json', JSON.stringify(games, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar los datos');
            }

            // Función para eliminar un archivo o directorio de GCS
            const deleteFromGCS = (filePath, callback) => {
                const file = bucket.file(filePath);
                file.delete((err) => {
                    if (err && err.code !== 404) {
                        return callback(err);
                    }
                    callback(null);
                });
            };

            // Función para eliminar un directorio de GCS
            const deleteDirectoryFromGCS = (directoryPath, callback) => {
                bucket.getFiles({ prefix: directoryPath }, (err, files) => {
                    if (err) {
                        return callback(err);
                    }

                    const tasks = files.map(file => cb => deleteFromGCS(file.name, cb));
                    async.parallel(tasks, callback);
                });
            };

            const tasks = [
                callback => deleteDirectoryFromGCS(`games/${game.dir}/`, callback)
            ];

            async.parallel(tasks, err => {
                if (err) {
                    console.error('Error al eliminar archivos de GCS:', err);
                    return res.status(500).send('Error al eliminar el juego');
                }
                res.sendStatus(200);
            });
        });
    });
});

// Ruta para obtener notificaciones
app.get('/notifications/:username', (req, res) => {
    const username = req.params.username;
    readJSONFile('notifications.json', (err, notifications) => {
        if (err) {
            return res.status(500).send('Error al leer las notificaciones');
        }
        const userNotifications = notifications.filter(notification => notification.targetUsername === username);
        res.json({ notifications: userNotifications });
    });
});

// Ruta para eliminar todas las notificaciones de un usuario
app.delete('/notifications/:username', isAuthenticated, (req, res) => {
    const username = req.params.username;

    readJSONFile('notifications.json', (err, notifications) => {
        if (err) {
            return res.status(500).send('Error al leer las notificaciones');
        }

        const filteredNotifications = notifications.filter(notification => notification.targetUsername !== username);

        fs.writeFile('notifications.json', JSON.stringify(filteredNotifications, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar las notificaciones');
            }
            res.json({ success: true });
        });
    });
});

// Ruta para obtener los reportes
app.get('/reports', (req, res) => {
    readJSONFile('reports.json', (err, reports) => {
        if (err) {
            return res.status(500).send('Error al leer los datos de los reportes');
        }

        readJSONFile('games.json', (err, games) => {
            if (err) {
                return res.status(500).send('Error al leer los datos de los juegos');
            }

            const reportsWithGameNames = reports.map(report => {
                const game = games.find(game => game.dir === report.gameDir);
                return {
                    ...report,
                    gameName: game ? game.name : 'Juego no encontrado'
                };
            });

            res.json(reportsWithGameNames);
        });
    });
});

// Ruta para eliminar un reporte
app.delete('/reports/:id', isAuthenticated, (req, res) => {
    const reportId = req.params.id;

    readJSONFile('reports.json', (err, reports) => {
        if (err) {
            return res.status(500).send('Error al leer los datos de los reportes');
        }

        const updatedReports = reports.filter(report => report.id !== reportId);

        fs.writeFile('reports.json', JSON.stringify(updatedReports, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar los datos de los reportes');
            }
            res.sendStatus(200);
        });
    });
});


// Ruta para manejar el reporte de un juego
app.post('/report', (req, res) => {
    const { gameDir, reportedBy, reportedUser, reason } = req.body;
    const report = {
        id: Date.now().toString(), // Generar un ID único para el reporte
        gameDir,
        reportedBy,
        reportedUser,
        reason,
        date: new Date()
    };

    readJSONFile('reports.json', (err, reports) => {
        if (err) {
            return res.status(500).send('Error al leer los datos de los reportes');
        }

        reports.push(report);

        fs.writeFile('reports.json', JSON.stringify(reports, null, 2), (err) => {
            if (err) {
                return res.status(500).send('Error al guardar el reporte');
            }
            res.json({ success: true });
        });
    });
});


// Rutas adicionales para manejar usuarios y notificaciones
app.get('/users', (req, res) => {
    readJSONFile('users.json', (err, users) => {
        if (err) {
            return res.status(500).send('Error al leer los usuarios');
        }
        res.json(users);
    });
});

app.post('/send_notification', (req, res) => {
    const { users, message } = req.body;
    users.forEach(username => {
        addNotification(username, message, '#', 'Administración');
    });
    res.json({ success: true });
});

// Ruta para banear usuarios
app.post('/ban_user', isAuthenticated, (req, res) => {
    const { users, reason } = req.body;

    readJSONFile('users.json', (err, usersData) => {
        if (err) {
            return res.status(500).send('Error al leer los datos');
        }

        readJSONFile('banned_emails.json', (err, bannedUsersData) => {
            if (err) {
                return res.status(500).send('Error al leer los datos');
            }

            const currentTime = new Date().toLocaleString();
            const updatedBannedUsers = bannedUsersData || [];

            users.forEach(username => {
                const userIndex = usersData.findIndex(user => user.username === username);
                if (userIndex !== -1) {
                    const user = usersData[userIndex];

                    // Agregar el usuario a la lista de baneados
                    updatedBannedUsers.push({
                        username: user.username,
                        email: user.email,
                        reason: reason,
                        date: currentTime
                    });

                    // Eliminar juegos y comentarios del usuario
                    readJSONFile('games.json', (err, games) => {
                        if (err) {
                            return res.status(500).send('Error al leer los datos');
                        }

                        // Filtrar juegos que no son del usuario baneado
                        const updatedGames = games.filter(game => game.uploadedBy !== username);

                        // Eliminar juegos del almacenamiento
                        const userGames = games.filter(game => game.uploadedBy === username);
                        const deleteTasks = userGames.map(game => {
                            const gamePath = `games/${game.dir}/`;
                            return new Promise((resolve, reject) => {
                                const deleteDirectoryFromGCS = (directoryPath, callback) => {
                                    bucket.getFiles({ prefix: directoryPath }, (err, files) => {
                                        if (err) {
                                            return callback(err);
                                        }
                                        const tasks = files.map(file => cb => {
                                            const fileRef = bucket.file(file.name);
                                            fileRef.delete(cb);
                                        });
                                        async.parallel(tasks, callback);
                                    });
                                };
                                deleteDirectoryFromGCS(gamePath, err => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve();
                                    }
                                });
                            });
                        });

                        Promise.all(deleteTasks)
                            .then(() => {
                                // Guardar los cambios en el archivo de juegos
                                fs.writeFile('games.json', JSON.stringify(updatedGames, null, 2), (err) => {
                                    if (err) {
                                        return res.status(500).send('Error al guardar los datos de los juegos');
                                    }

                                    // Eliminar usuario de la lista de usuarios
                                    usersData.splice(userIndex, 1);

                                    // Guardar los cambios en el archivo de usuarios
                                    fs.writeFile('users.json', JSON.stringify(usersData, null, 2), (err) => {
                                        if (err) {
                                            return res.status(500).send('Error al guardar los datos de los usuarios');
                                        }

                                        // Guardar los correos electrónicos baneados
                                        fs.writeFile('banned_emails.json', JSON.stringify(updatedBannedUsers, null, 2), (err) => {
                                            if (err) {
                                                return res.status(500).send('Error al guardar los correos electrónicos baneados');
                                            }
                                            res.json({ success: true });
                                        });
                                    });
                                });
                            })
                            .catch(err => {
                                console.error('Error al eliminar los juegos del almacenamiento:', err);
                                res.status(500).send('Error al eliminar los juegos del almacenamiento');
                            });
                    });
                }
            });
        });
    });
});

app.get('/8idhdQJs13rKfdPGCtv8KeCT0oOWfoBSIVfr7z1cguMXOwfkFGkoLyNvW5iQpaSv2oM8cKS6HMpTN3h3IiX8fDxDhZcoeFSIEIuH.html', isAuthenticated, isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', '8idhdQJs13rKfdPGCtv8KeCT0oOWfoBSIVfr7z1cguMXOwfkFGkoLyNvW5iQpaSv2oM8cKS6HMpTN3h3IiX8fDxDhZcoeFSIEIuH.html'));
});

app.get('/session', (req, res) => {
    res.json(req.session);
});



app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});
