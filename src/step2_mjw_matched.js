// src/step2_mjw_matched.js
require('dotenv').config();
const { fetchProductsIdEanAll } = require('./presta');
const { fetchMJWAll } = require('./mjw');

function getArg(name, def) {
  const pref = `--${name}=`;
  const raw = process.argv.find(a => a.startsWith(pref));
  if (!raw) return def;
  const val = raw.slice(pref.length);
  const num = Number(val);
  return Number.isFinite(num) ? num : val;
}

(async () => {
  try {
    const baseUrl = process.env.PS_URL;
    const wsKey   = process.env.PS_WS_KEY;

    // Ile maksymalnie pobrać z Presty (opcjonalnie)
    const limitPresta = getArg('limit', Infinity);
    const pageSize    = getArg('page', 200);

    // 1) Pobierz EAN-y z Presty
    const prestas = await fetchProductsIdEanAll({ baseUrl, wsKey, pageSize, max: limitPresta });

    const eanSet = new Set(
      prestas
        .map(p => (p.ean13 || '').trim())
        .filter(e => e.length > 0)
    );

    // 2) Pobierz cały feed MJW (Google)
    const mjwAll = await fetchMJWAll();

    // 3) Zostaw TYLKO te, których EAN jest w Preście
    const matched = mjwAll.filter(x => eanSet.has(x.ean));

    // 4) Jedyny output: czysty JSON na stdout
    process.stdout.write(JSON.stringify(matched));
  } catch (err) {
    console.error(
      err?.response?.status
        ? `${err.response.status} ${err.response.statusText}`
        : (err?.message || String(err))
    );
    process.exit(1);
  }
})();
