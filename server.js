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

/* Siembra 200 jugadores ficticios (poquísimos puntos), conservando a los reales.
   Solo agrega los que falten; no duplica ni borra. */
function seedScores() {
  const existing = leerScores();
  const seedCount = existing.filter(s => s && s.seed).length;
  if (seedCount >= 200) return; // ya están sembrados
  const existingEmails = new Set(existing.map(s => s.email));
  const nombres = [
    'Benjamín','Martín','Vicente','Agustín','Matías','Tomás','Cristóbal','Joaquín','Sebastián','Maximiliano',
    'Diego','Felipe','Ignacio','Lucas','Gabriel','Nicolás','Alonso','Bruno','Emilio','Gaspar',
    'Pablo','Andrés','Javier','Camilo','Franco','Dante','Renato','Damián','Simón','Bastián',
    'Nacho','Pancho','Maxi','Beni','Joaco','Tomi','Mati','Seba','Cris','Guille',
    'Sofía','Isidora','Florencia','Emilia','Antonella','Catalina','Josefa','Maite','Trinidad','Amanda',
    'Fernanda','Valentina','Javiera','Antonia','Constanza','Martina','Agustina','Magdalena','Rafaela','Pía',
    'Colomba','Anaís','Daniela','Paula','Carolina','Francisca','Bárbara','Macarena','Rocío','Belén',
    'Montserrat','Ignacia','Manuela','Elena','Laura','Paz','Coté','Cata','Feña','Vale',
    'Javi','Dani','Flo','Isi','Mane','Nico','Pipe','Cami','Fran','Tato'
  ];
  const inis = 'ABCDEFGHIJLMNOPRSTUVZ'.split('');
  const nuevos = [];
  for (let i = 0; i < 200; i++) {
    const email = `seed${i}@firulais.seed`;
    if (existingEmails.has(email)) continue; // no duplicar
    const fn = nombres[i % nombres.length];
    const ini = inis[Math.floor(i / nombres.length) % inis.length];
    // Cola natural: la mayoría con poquísimos puntos (1-8), unos pocos destacan (hasta ~17)
    const base = 1 + ((i * 7 + 3) % 8);
    const boost = (i % 11 === 0) ? 4 + ((i * 5) % 6) : ((i % 5 === 0) ? 2 : 0);
    nuevos.push({ email, nombre: `${fn} ${ini}.`, score: base + boost, seed: true });
  }
  if (nuevos.length) {
    guardarScores(existing.concat(nuevos));
    console.log('Sembrados', nuevos.length, 'jugadores ficticios (conservando reales)');
  }
}
seedScores();

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

/* DIAGNÓSTICO: prueba la suscripción y muestra la respuesta de Klaviyo.
   Abrir en el navegador: /api/klaviyo-test  (o ?email=tu@correo.cl) */
app.get('/api/klaviyo-test', async (req, res) => {
  const email = (req.query.email || ('test_' + Date.now() + '@firulais-test.cl')).trim();
  const r = await klaviyoSubscribe({ first: 'Test', last: 'Firulais', email });
  res.json({
    enviado_a_email: email,
    lista: process.env.KLAVIYO_LIST_ID || 'S2grGC',
    tiene_key: !!process.env.KLAVIYO_PRIVATE_KEY,
    key_prefijo: (process.env.KLAVIYO_PRIVATE_KEY || '').slice(0, 3),
    resultado: r
  });
});

/* ── Ranking del juego ── */

// Top N del ranking (para la tabla)
app.get('/api/leaderboard', (req, res) => {
  const all = leerScores();
  const scores = all
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 25)
    .map(s => ({ nombre: s.nombre, score: s.score }));
  res.json({ leaderboard: scores, total: all.length });
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

/* ── Tramos de descuento según el puesto ── */
function tierPercent(pos) {
  if (pos <= 5) return 20;
  if (pos <= 10) return 15;
  if (pos <= 20) return 12;
  return 10;
}
function nextTierInfo(pos) {
  if (pos <= 5) return null;            // ya está en lo más alto
  if (pos <= 10) return { pct: 20, rank: 5 };
  if (pos <= 20) return { pct: 15, rank: 10 };
  return { pct: 12, rank: 20 };
}

/* Estado del jugador: puesto, tramo actual y progreso al siguiente (para la barrita) */
app.get('/api/status', (req, res) => {
  const email = (req.query.email || '').trim().toLowerCase();
  if (!email) return res.json({ registered: false });
  const sorted = leerScores().slice().sort((a, b) => b.score - a.score);
  const idx = sorted.findIndex(s => s.email === email);
  if (idx < 0) return res.json({ registered: false });

  const pos = idx + 1;
  const mejor = sorted[idx].score;
  const percent = tierPercent(pos);
  const nt = nextTierInfo(pos);
  let nextPercent = null, nextThreshold = null, faltan = null;
  if (nt) {
    nextPercent = nt.pct;
    const boundary = sorted[nt.rank - 1];
    nextThreshold = boundary ? boundary.score : mejor;
    faltan = Math.max(0, nextThreshold - mejor + 1);
  }
  res.json({ registered: true, pos, mejor, percent, nextPercent, nextThreshold, faltan, total: sorted.length });
});

/* Crea un código de descuento único en Shopify (% off, 1 uso, vence en 48h) */
async function crearDescuentoShopify(percent, email) {
  if (!STORE || !TOKEN) return { ok: false, status: 0, error: 'Shopify no configurado' };
  const now = new Date();
  const ends = new Date(now.getTime() + 48 * 3600 * 1000);
  const code = 'FIRU' + percent + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  try {
    const pr = await fetch(`https://${STORE}/admin/api/${API_VERSION}/price_rules.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_rule: {
        title: `Firulais juego ${percent}% ${email}`,
        target_type: 'line_item', target_selection: 'all', allocation_method: 'across',
        value_type: 'percentage', value: `-${percent}.0`,
        customer_selection: 'all', usage_limit: 1,
        starts_at: now.toISOString(), ends_at: ends.toISOString()
      }})
    });
    if (!pr.ok) { const b = await pr.text(); return { ok: false, status: pr.status, error: b }; }
    const ruleId = (await pr.json()).price_rule.id;
    const dc = await fetch(`https://${STORE}/admin/api/${API_VERSION}/price_rules/${ruleId}/discount_codes.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ discount_code: { code } })
    });
    if (!dc.ok) { const b = await dc.text(); return { ok: false, status: dc.status, error: b }; }
    return { ok: true, code, percent, endsAt: ends.toISOString() };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

/* Canjear: genera el código del tramo según el puesto ACTUAL del jugador */
app.post('/api/redeem', async (req, res) => {
  const email = (req.body && req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Falta el email' });
  const scores = leerScores();
  const sorted = scores.slice().sort((a, b) => b.score - a.score);
  const idx = sorted.findIndex(s => s.email === email);
  if (idx < 0) return res.status(404).json({ error: 'Todavía no estás en el ranking. Jugá primero.' });

  const pos = idx + 1;
  const percent = tierPercent(pos);
  const rec = scores.find(s => s.email === email);

  // 1 código activo a la vez: si el tramo no cambió, reusar el mismo código
  if (rec && rec.issuedTier === percent && rec.issuedCode) {
    return res.json({ ok: true, code: rec.issuedCode, percent, reused: true });
  }
  const r = await crearDescuentoShopify(percent, email);
  if (!r.ok) {
    console.error('Descuento Shopify falló:', r.status, r.error);
    let detail = r.error || '';
    try { const j = JSON.parse(r.error); detail = j.errors ? JSON.stringify(j.errors) : detail; } catch (_) {}
    return res.status(502).json({ error: 'No se pudo generar el código', status: r.status, detail: String(detail).slice(0, 300) });
  }
  if (rec) { rec.issuedCode = r.code; rec.issuedTier = percent; guardarScores(scores); }
  res.json({ ok: true, code: r.code, percent, endsAt: r.endsAt });
});

/* Archivos estáticos de la página */
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Firulais escuchando en el puerto ${PORT}`));
