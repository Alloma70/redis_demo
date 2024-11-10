const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const connectRedis = require('connect-redis');
const Redis = require('ioredis');
const { Client } = require('pg');
const flash = require('connect-flash'); // Importer connect-flash
const fs = require('fs');  // Importer fs pour lire le fichier HTML

const app = express();
const port = 3000;

// Connexion à Redis
const redisClient = new Redis({
  host: 'localhost',
  port: 6379,
});

redisClient.on('connect', () => {
  console.log('Connecté à Redis avec succès');
});

redisClient.on('error', (err) => {
  console.error('Erreur de connexion à Redis:', err);
});

// Connexion à PostgreSQL
const pgClient = new Client({
  host: 'localhost',
  user: 'postgres',
  password: '',
  database: 'redispg',
  port: 5432
});

pgClient.connect()
  .then(() => console.log('Connecté à PostgreSQL'))
  .catch(err => console.error('Erreur de connexion à PostgreSQL:', err));

// Initialiser connect-redis et le middleware de session
const RedisStore = connectRedis(session);

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: 'votre_clé_secrète',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Mettre à true si HTTPS est utilisé
}));

// Utiliser flash pour les messages de notification
app.use(flash());  // Ajouter connect-flash ici

// Middleware pour parser les requêtes
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Route pour afficher le formulaire d'inscription
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Route de base
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Route pour l'inscription
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  console.time('register'); // Commencer le chronomètre de l'inscription

  try {
    const userExists = await pgClient.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Utilisateur déjà existant' });
    }

    await pgClient.query('INSERT INTO users (username, password) VALUES ($1, $2)', [username, password]);
    await redisClient.hset('users', username, JSON.stringify({ password }));

    // Envoi d'une notification et redirection vers la page de login
    req.flash('success', 'Inscription réussie ! Souhaitez-vous vous connecter ?');
    res.redirect('/register');

    console.timeEnd('register'); // Afficher le temps écoulé pour l'inscription
  } catch (err) {
    console.error('Erreur lors de l\'inscription:', err);
    res.status(500).json({ message: 'Erreur lors de l\'inscription' });
    console.timeEnd('register'); // Afficher le temps écoulé en cas d'erreur
  }
});

// Route pour la connexion
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  console.time('login'); // Commencer le chronomètre de la connexion

  let redisTime = 0;
  let dbTime = 0;

  try {
    let userData;

    // 1. Vérifier dans Redis
    console.time('redisTime');
    userData = await redisClient.hget('users', username);
    console.timeEnd('redisTime');
    redisTime = performance.now();  // Mesurer plus précisément le temps avec performance.now()

    if (!userData) {
      // 2. Si l'utilisateur n'est pas dans le cache Redis, vérifier dans PostgreSQL
      console.log('Données non trouvées dans le cache Redis, requête PostgreSQL...');
      console.time('dbTime'); // Chronométrage pour PostgreSQL
      const result = await pgClient.query('SELECT * FROM users WHERE username = $1', [username]);
      console.timeEnd('dbTime');
      dbTime = performance.now();

      if (result.rows.length === 0) {
        req.flash('error', 'Utilisateur non trouvé');
        return res.redirect('/login'); // Rediriger vers la page de connexion avec message d'erreur
      }

      userData = result.rows[0];
      // Mettre à jour Redis avec les données récupérées de PostgreSQL
      await redisClient.hset('users', username, JSON.stringify({ password: userData.password }));
      console.log('Utilisateur ajouté au cache Redis');
    } else {
      userData = JSON.parse(userData);
      console.log('Données récupérées du cache Redis');
    }

    if (userData.password !== password) {
      req.flash('error', 'Mot de passe incorrect');
      return res.redirect('/login'); // Rediriger vers la page de connexion avec message d'erreur
    }

    req.session.username = username;
    req.flash('success', 'Vous êtes maintenant connecté !');
    
    // Attendre que le message de flash soit visible avant la redirection
    setTimeout(() => {
      res.redirect('/home');
    }, 1000);  // 1 seconde pour afficher le message flash

    console.timeEnd('login'); // Afficher le temps écoulé pour la connexion
    console.log('Temps de récupération depuis Redis:', redisTime, 'ms');
    console.log('Temps de récupération depuis PostgreSQL:', dbTime, 'ms');

  } catch (err) {
    console.error('Erreur lors de la connexion:', err);
    req.flash('error', 'Erreur lors de la connexion');
    res.redirect('/login'); // Rediriger vers la page de connexion avec message d'erreur
    console.timeEnd('login'); // Afficher le temps écoulé en cas d'erreur
  }
});

// Route pour la page d'accueil après connexion
app.get('/home', (req, res) => {
  if (!req.session.username) {
    return res.redirect('/login');
  }

  const username = req.session.username;

  fs.readFile(path.join(__dirname, 'views', 'home.html'), 'utf8', (err, html) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur');
    }

    // Remplacer le placeholder par le nom d'utilisateur
    const personalizedHtml = html.replace('<%= username %>', username);
    // Injecter les messages de flash
    const finalHtml = personalizedHtml.replace('<%= success %>', req.flash('success'));

    res.send(finalHtml);
  });
});

// Route pour la déconnexion (logout)
app.get('/logout', (req, res) => {
  console.time('logout'); // Chronométrer la déconnexion
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur lors de la déconnexion:', err);
      return res.status(500).json({ message: 'Erreur lors de la déconnexion' });
    }

    // Rediriger vers la page de login après déconnexion
    res.redirect('/login');
    console.timeEnd('logout'); // Afficher le temps écoulé pour la déconnexion
  });
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Démarrage du serveur
app.listen(port, () => {
  console.log('Serveur démarré sur http://localhost:${port}');
});
