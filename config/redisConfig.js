const redis = require('redis');

// Configurer les détails de la connexion pour un serveur Redis distant
const redisConfig = {
  host: '192.168.1.6', // Remplacez par l'adresse IP ou le domaine de votre serveur Redis
  port: 6379,                      // Port par défaut de Redis
  password: '',   // Si Redis nécessite un mot de passe, ajoutez-le ici
  db: 0                             // Sélectionner la base de données Redis (par défaut, c'est la base de données 0)
};

// Créer une instance du client Redis avec la configuration
const client = redis.createClient(redisConfig);

client.on('connect', () => {
  console.log('Connecté au serveur Redis distant.');
});

client.on('error', (err) => {
  console.error('Erreur Redis:', err);
});

// Exporter le client pour l'utiliser dans d'autres fichiers
module.exports = client;
