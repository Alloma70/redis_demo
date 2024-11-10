const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { createClient } = require('@redis/client');
const path = require('path');

// Configuration de PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'redispg',
  password: '',
  port: 5432
});

// Configuration de Redis
const client = createClient({ url: 'redis://localhost:6379' });
client.on('error', (err) => console.error('Erreur Redis:', err));
client.connect();

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/../views/login.html'));
});

router.post('/', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Vérifier d'abord dans le cache Redis
    let user = await client.hGetAll(`user:${username}`);

    if (Object.keys(user).length === 0) {
      // Si l'utilisateur n'est pas trouvé dans Redis, vérifier dans PostgreSQL
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

      if (result.rows.length === 0) {
        return res.status(401).send('Utilisateur non trouvé, veuillez vous inscrire.');
      }

      user = result.rows[0];

      // Ajouter l'utilisateur à Redis pour les futures connexions
      await client.hSet(`user:${username}`, {
        email: user.email,
        password: user.password
      });
    }

    // Vérifier le mot de passe
    if (user.password !== password) {
      return res.status(401).send('Mot de passe incorrect.');
    }

    // Créer une session utilisateur
    req.session.username = username;
    res.redirect('/home');
  } catch (err) {
    console.error('Erreur lors de la connexion:', err);
    res.status(500).send('Erreur du serveur');
  }
});

module.exports = router;
