/* ════════════════════════════════════════════════════════════
   Servidor Firulais (Railway)
   - Sirve la página estática (index.html, imágenes, etc.)
   - Expone /api/cachupin: trae el producto "Cachupin" desde Shopify
     usando la Admin API (token secreto, solo del lado del servidor).
   Variables de entorno (se configuran en Railway):
     SHOPIFY_STORE_DOMAIN  → kairos-brewing.myshopify.com
     SHOPIFY_ADMIN_TOKEN   → token de Admin API (shpat_...)
   ════════════════════════════════════════════════════════════ */
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const STORE = process.env.SHOPIFY_STORE_DOMAIN;   // kairos-brewing.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;    // shpat_...
const API_VERSION = '2024-07';

/* ── Almacenamiento del ranking (archivo JSON) ──
   Para que el ranking PERSISTA entre deploys, montá un Volume en Railway
   y seteá DATA_DIR a su ruta (ej: /data). Sin eso, se reinicia en cada deploy. */
const DATA_DIR = process.env.DATA_DIR || __dirname;
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');

function leerScores() {
  try { return JSON.parse(fs.readFileSync(SCORES_FILE, 'utf8')); }
  catch (_) { return []; }
}
function guardarScores(arr) {
  try { fs.writeFileSync(SCORES_FILE, JSON.stringify(arr)); return true; }
  catch (e) { console.error('No se pudo guardar scores:', e.message); return false; }
}

/* ── Helper: suscribe/actualiza un perfil en Klaviyo (best-effort) ── */
async function klaviyoSubscribe({ first, last, email, phone, score }) {
  const PRIV = process.env.KLAVIYO_PRIVATE_KEY;
  const LIST = process.env.KLAVIYO_LIST_ID || 'S2grGC';
  if (!PRIV) return { ok: false, status: 0, detail: 'Falta KLAVIYO_PRIVATE_KEY' };

  const properties = {};
  if (phone) properties.telefono = phone;
  if (score != null) properties.mejor_puntaje_juego = score;

  const attributes = {
    email: email,
    first_name: first || undefined,
    last_name: last || undefined,
    subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } }
  };
  if (Object.keys(properties).length) attributes.properties = properties;

  try {
    const r = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${PRIV}`,
        'revision': '2024-10-15',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        data: {
          type: 'profile-subscription-bulk-create-job',
          attributes: {
            custom_source: 'Firulais Web',
            profiles: { data: [{ type: 'profile', attributes }] }
          },
          relationships: { list: { data: { type: 'list', id: LIST } } }
        }
      })
    });
    if (r.status === 202 || r.ok) return { ok: true, status: r.status };
    const body = await r.text();
    console.error('Klaviyo rechazo:', r.status, body);
    let detail = body;
    try { const j = JSON.parse(body); detail = (j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].title)) || body; } catch (_) {}
    return { ok: false, status: r.status, detail };
  } catch (e) {
    return { ok: false, status: 0, detail: e.message };
  }
}

function shopifyFetch(endpoint) {
  return fetch(`https://${STORE}/admin/api/${API_VERSION}/${endpoint}`, {
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json'
    }
  });
}

/* Datos del producto Cachupin (variante, precio, dominio para el checkout) */
app.get('/api/cachupin', async (req, res) => {
  if (!STORE || !TOKEN) {
    return res.status(500).json({ error: 'Faltan SHOPIFY_STORE_DOMAIN o SHOPIFY_ADMIN_TOKEN' });
  }
  try {
    const [prodRes, shopRes] = await Promise.all([
      shopifyFetch('products.json?limit=250'),
      shopifyFetch('shop.json')
    ]);
    if (!prodRes.ok) {
      const body = await prodRes.text();
      return res.status(502).json({ error: 'Shopify rechazó la consulta de productos', status: prodRes.status, body });
    }
    const { products = [] } = await prodRes.json();
    const product = products.find(p => /cachup/i.test(p.title || '') || /cachup/i.test(p.handle || ''));
    if (!product) {
      return res.status(404).json({ error: 'No se encontró un producto "Cachupin" en la tienda' });
    }
    const variants = (product.variants || []).map(v => ({
      variantId: v.id,
      title: v.title,                 // ej: "6 Pack", "12", "24"
      price: v.price,
      available: v.available !== false
    }));
    if (!variants.length) {
      return res.status(404).json({ error: 'El producto Cachupin no tiene variantes' });
    }
    let currency = 'CLP';
    if (shopRes.ok) {
      const shop = await shopRes.json();
      currency = (shop.shop && shop.shop.currency) || currency;
    }
    res.json({
      title: product.title,
      currency: currency,
      storeDomain: STORE,
      variants: variants
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Chequeo rápido de configuración (abrir en el navegador: /api/health) */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: 'klaviyo-diag-1',
    hasShopify: !!(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_TOKEN),
    hasKlaviyoKey: !!process.env.KLAVIYO_PRIVATE_KEY,
    klaviyoKeyPrefix: (process.env.KLAVIYO_PRIVATE_KEY || '').slice(0, 3),
    klaviyoList: process.env.KLAVIYO_LIST_ID || 'S2grGC'
  });
});

/* Suscribe un perfil a la lista de Klaviyo (server-side, evita CORS/ad-blockers) */
app.post('/api/subscribe', async (req, res) => {
  const email = (req.body && req.body.email || '').trim();
  if (!email) return res.status(400).json({ error: 'Falta el email' });
  const r = await klaviyoSubscribe({
    first: (req.body.first || '').trim(),
    last:  (req.body.last  || '').trim(),
    email
  });
  if (r.ok) return res.json({ ok: true });
  return res.status(r.status === 0 ? 500 : 502).json({ error: 'Klaviyo: ' + r.detail, status: r.status });
});

/* ── Ranking del juego ── */

// Top N del ranking (para la tabla)
app.get('/api/leaderboard', (req, res) => {
  const scores = leerScores()
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(s => ({ nombre: s.nombre, score: s.score }));
  res.json({ leaderboard: scores });
});

// Guarda/actualiza el puntaje de un jugador + (best-effort) lo suma a Klaviyo
app.post('/api/score', async (req, res) => {
  const first = (req.body && req.body.first || '').trim();
  const last  = (req.body && req.body.last  || '').trim();
  const email = (req.body && req.body.email || '').trim().toLowerCase();
  const phone = (req.body && req.body.phone || '').trim();
  const score = Math.max(0, parseInt(req.body && req.body.score, 10) || 0);
  if (!email) return res.status(400).json({ error: 'Falta el email' });

  // Nombre visible en la tabla: nombre + inicial del apellido
  const nombre = (first || 'Anónimo') + (last ? ' ' + last.charAt(0).toUpperCase() + '.' : '');

  // Guardar/actualizar (mejor puntaje por email)
  const scores = leerScores();
  const idx = scores.findIndex(s => s.email === email);
  if (idx >= 0) {
    if (score > scores[idx].score) scores[idx].score = score;
    scores[idx].nombre = nombre;
    if (phone) scores[idx].phone = phone;
  } else {
    scores.push({ email, nombre, phone, score });
  }
  guardarScores(scores);

  // Suscribir a Klaviyo en segundo plano (no bloquea ni rompe el ranking)
  const mejor = (idx >= 0 ? scores[idx].score : score);
  klaviyoSubscribe({ first, last, email, phone, score: mejor }).then(r => {
    if (!r.ok) console.error('Klaviyo (score) no suscribió:', r.status, r.detail);
  });

  // Calcular posición en el ranking
  const ordenado = scores.slice().sort((a, b) => b.score - a.score);
  const pos = ordenado.findIndex(s => s.email === email) + 1;
  const top = ordenado.slice(0, 25).map(s => ({ nombre: s.nombre, score: s.score }));

  res.json({ ok: true, pos, total: scores.length, mejor, leaderboard: top });
});

/* Archivos estáticos de la página */
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Firulais escuchando en el puerto ${PORT}`));
