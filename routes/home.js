// routes/home.js
const express = require('express');
const router = express.Router();

// Route pour la page d'accueil
router.get('/', (req, res) => {
    if (!req.session.username) {
        return res.redirect('/login');
    }
    res.send(`
        <h1>Bienvenue ${req.session.username}</h1>
        <a href="/logout">Se déconnecter</a>
    `);
});

// Route pour la déconnexion
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Erreur lors de la déconnexion :', err);
            return res.status(500).send('Erreur lors de la déconnexion.');
        }
        console.log('Déconnexion réussie et session détruite.');
        res.redirect('/login');
    });
});

module.exports = router;
