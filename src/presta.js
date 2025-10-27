// src/presta.js
const axios = require('axios');

/**
 * Pobiera wszystkie produkty { id, ean13 } z Presta Webservice (paginacja).
 * NIC nie zapisuje, tylko GET i zwrotka tablicy.
 */
async function fetchProductsIdEanAll({ baseUrl, wsKey, pageSize = 200, max = Infinity }) {
  if (!baseUrl || !wsKey) throw new Error('Missing baseUrl/wsKey');

  const base = baseUrl.replace(/\/+$/, '');
  const display = encodeURIComponent('[id,ean13]');
  let start = 0;
  const out = [];

  while (out.length < max) {
    const take = Math.min(pageSize, max - out.length);
    const url =
      `${base}/api/products?display=${display}` +
      `&limit=${start},${take}` +
      `&output_format=JSON&ws_key=${encodeURIComponent(wsKey)}`;

    const { data } = await axios.get(url, {
      headers: { Accept: 'application/json' },
      timeout: 30000,
    });

    const batch = Array.isArray(data?.products) ? data.products : [];
    if (batch.length === 0) break;

    for (const p of batch) {
      out.push({ id: Number(p.id), ean13: p.ean13 ?? '' });
      if (out.length >= max) break;
    }

    if (batch.length < take) break;   // ostatnia strona
    start += batch.length;
  }

  return out;
}
// --- DODAJ PONIŻEJ ISTNIEJĄCEGO KODU ---

/** Pobiera produkty {id, ean13, price} */
async function fetchProductsIdEanPriceAll({ baseUrl, wsKey, pageSize = 200, max = Infinity }) {
  if (!baseUrl || !wsKey) throw new Error('Missing baseUrl/wsKey');

  const axios = require('axios');
  const base = baseUrl.replace(/\/+$/, '');
  const display = encodeURIComponent('[id,ean13,price]');
  let start = 0;
  const out = [];

  while (out.length < max) {
    const take = Math.min(pageSize, max - out.length);
    const url = `${base}/api/products?display=${display}&limit=${start},${take}&output_format=JSON&ws_key=${encodeURIComponent(wsKey)}`;
    const { data } = await axios.get(url, { headers: { Accept: 'application/json' }, timeout: 30000 });
    const batch = Array.isArray(data?.products) ? data.products : [];
    if (batch.length === 0) break;

    for (const p of batch) {
      out.push({
        id: Number(p.id),
        ean13: (p.ean13 ?? '').toString(),
        price: Number(p.price ?? 0),
      });
      if (out.length >= max) break;
    }
    if (batch.length < take) break;
    start += batch.length;
  }
  return out;
}

/** Pobiera stany magazynowe → Map(id_product => 0/1) */
async function fetchStock01All({ baseUrl, wsKey, pageSize = 300, max = Infinity }) {
  if (!baseUrl || !wsKey) throw new Error('Missing baseUrl/wsKey');

  const axios = require('axios');
  const base = baseUrl.replace(/\/+$/, '');
  const display = encodeURIComponent('[id_product,id_product_attribute,quantity]');
  let start = 0;
  const map = new Map();

  while (map.size < max) {
    const url = `${base}/api/stock_availables?display=${display}&limit=${start},${pageSize}&output_format=JSON&ws_key=${encodeURIComponent(wsKey)}`;
    const { data } = await axios.get(url, { headers: { Accept: 'application/json' }, timeout: 30000 });

    const batch = Array.isArray(data?.stock_availables) ? data.stock_availables : [];
    if (batch.length === 0) break;

    for (const row of batch) {
      const pid = Number(row.id_product);
      const qty = Number(row.quantity);
      // jeżeli którakolwiek wariacja > 0 → całość = 1
      if (Number.isFinite(pid)) {
        if (qty > 0) map.set(pid, 1);
        else if (!map.has(pid)) map.set(pid, 0);
      }
    }
    if (batch.length < pageSize) break;
    start += batch.length;
  }
  return map;
}

module.exports.fetchProductsIdEanPriceAll = fetchProductsIdEanPriceAll;
module.exports.fetchStock01All = fetchStock01All;


