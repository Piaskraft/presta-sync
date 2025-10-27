// src/mjw.js
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const MJW_GOOGLE_URL = 'https://mjwtools.com/xml/google_products.xml';

/**
 * Pobiera i parsuje feed MJW → [{ ean, price_pln, availability }]
 * Jeśli nie podasz url w argumencie, użyje process.env.MJW_FEED_URL lub domyślnego MJW_GOOGLE_URL.
 */
async function fetchMJWAll({ url } = {}) {
  const feedUrl = url || process.env.MJW_FEED_URL || MJW_GOOGLE_URL;

  const { data: xml } = await axios.get(feedUrl, { timeout: 60000 });
  const parser = new XMLParser({
    ignoreAttributes: true,
    attributeNamePrefix: '',
    trimValues: true,
  });
  const root = parser.parse(xml);

  const items =
    (root?.rss?.channel?.item) ||
    (root?.channel?.item) ||
    (root?.rss?.item) ||
    [];

  const arr = Array.isArray(items) ? items : [items];

  const out = [];
  for (const it of arr) {
    if (!it) continue;

    // EAN (Google feed używa g:gtin)
    const ean = (it['g:gtin'] || it.gtin || '').toString().trim();
    if (!ean) continue;

    // Cena typu "244.77 PLN" / "9,99 PLN"
    const priceStr = (it['g:price'] || it.price || '').toString().trim();
    const numMatch = priceStr.replace(',', '.').match(/[\d.]+/);
    const price_pln = numMatch ? parseFloat(numMatch[0]) : null;

    const availability = (it['g:availability'] || it.availability || '').toString().trim();

    out.push({ ean, price_pln, availability });
  }
  return out;
}

module.exports = { fetchMJWAll, MJW_GOOGLE_URL };
