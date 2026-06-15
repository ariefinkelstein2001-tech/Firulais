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

const app = express();
app.use(express.json());

const STORE = process.env.SHOPIFY_STORE_DOMAIN;   // kairos-brewing.myshopify.com
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;    // shpat_...
const API_VERSION = '2024-07';

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

/* Suscribe un perfil a la lista de Klaviyo (server-side, evita CORS/ad-blockers) */
app.post('/api/subscribe', async (req, res) => {
  const PRIV = process.env.KLAVIYO_PRIVATE_KEY;
  const LIST = process.env.KLAVIYO_LIST_ID || 'S2grGC';
  if (!PRIV) return res.status(500).json({ error: 'Falta KLAVIYO_PRIVATE_KEY en el servidor' });

  const first = (req.body && req.body.first || '').trim();
  const last  = (req.body && req.body.last  || '').trim();
  const email = (req.body && req.body.email || '').trim();
  if (!email) return res.status(400).json({ error: 'Falta el email' });

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
            custom_source: 'Firulais Web - 10% primera compra',
            profiles: {
              data: [{
                type: 'profile',
                attributes: {
                  email: email,
                  first_name: first,
                  last_name: last,
                  subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } }
                }
              }]
            }
          },
          relationships: { list: { data: { type: 'list', id: LIST } } }
        }
      })
    });
    if (r.status === 202 || r.ok) return res.json({ ok: true });
    const body = await r.text();
    return res.status(502).json({ error: 'Klaviyo rechazó la suscripción', status: r.status, body });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Archivos estáticos de la página */
app.use(express.static(path.join(__dirname)));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Firulais escuchando en el puerto ${PORT}`));
