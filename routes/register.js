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
  res.sendFile(path.join(__dirname, '/../views/register.html'));
});

router.post('/', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Insertion des données dans PostgreSQL
    await pool.query('INSERT INTO users (username, email, password) VALUES ($1, $2, $3)', [username, email, password]);
    res.redirect('/login');
  } catch (err) {
    console.error('Erreur lors de l\'enregistrement:', err);
    res.status(500).send('Erreur lors de l\'enregistrement');
  }
});

module.exports = router;
