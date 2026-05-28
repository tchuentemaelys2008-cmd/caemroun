/* ============================================================
 *  Petition "Protegeons Nos Enfants" — API backend
 *  Node.js + Express + PostgreSQL (Railway)
 *
 *  Routes :
 *    GET  /api/state            -> { count, signers: [...] }
 *    POST /api/sign             -> body { name, city }       (signature nominative)
 *    POST /api/sign-anon        -> (aucun body requis)        (signature anonyme)
 *
 *  Variables d'environnement attendues :
 *    DATABASE_URL  (fournie automatiquement par Railway via le plugin Postgres)
 *    BASE_OFFSET   (optionnel, defaut 1854 : base de depart du compteur)
 *    PORT          (fournie automatiquement par Railway)
 * ============================================================ */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

/* ---- Connexion PostgreSQL ---- */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway impose SSL en production ; on l'active sans verifier le CA.
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

/* ---- Compteur de depart (base "1854" demandee) ---- */
const BASE_OFFSET = parseInt(process.env.BASE_OFFSET || '1854', 10);

/* ---- Middlewares ---- */
app.use(cors());                 // autorise le front (GitHub Pages, etc.) a appeler l'API
app.use(express.json());

/* ---- Creation auto de la table au demarrage ---- */
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS signatures (
      id          BIGSERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      city        TEXT DEFAULT '',
      is_anon     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_signatures_created_at
      ON signatures (created_at DESC);
  `);
  console.log('Base de donnees prete.');
}

/* ---- Helpers ---- */
async function getState() {
  const countRes = await pool.query('SELECT COUNT(*)::int AS c FROM signatures');
  const realCount = countRes.rows[0].c;

  const signersRes = await pool.query(
    `SELECT name, city, is_anon, created_at
       FROM signatures
       ORDER BY created_at DESC
       LIMIT 8`
  );

  const signers = signersRes.rows.map(r => ({
    name: r.name,
    city: r.city || '',
    isAnon: r.is_anon,
    createdAt: r.created_at
  }));

  return { count: BASE_OFFSET + realCount, signers };
}

/* ---- Routes ---- */

// Etat global (compteur + derniers signataires)
app.get('/api/state', async (req, res) => {
  try {
    res.json(await getState());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error' });
  }
});

// Signature nominative
app.post('/api/sign', async (req, res) => {
  try {
    let { name, city } = req.body || {};
    name = (name || '').toString().trim().slice(0, 60);
    city = (city || '').toString().trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'name_required' });

    await pool.query(
      'INSERT INTO signatures (name, city, is_anon) VALUES ($1, $2, FALSE)',
      [name, city]
    );
    res.json(await getState());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error' });
  }
});

// Signature anonyme
app.post('/api/sign-anon', async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO signatures (name, city, is_anon) VALUES ('Citoyen Anonyme', 'Cameroun', TRUE)"
    );
    res.json(await getState());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'db_error' });
  }
});

// Petit healthcheck
app.get('/', (req, res) => res.send('Petition API OK'));

/* ---- Demarrage ---- */
const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log('API en ecoute sur le port ' + PORT)))
  .catch(err => {
    console.error('Echec init DB :', err);
    process.exit(1);
  });
