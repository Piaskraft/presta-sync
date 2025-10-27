// src/index.js
require('dotenv').config();
const { fetchProductsIdEanAll } = require('./presta');

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

    const pageSize = getArg('page', 200);   // opcjonalnie: --page=250
    const max      = getArg('limit', Infinity); // opcjonalnie: --limit=500

    const list = await fetchProductsIdEanAll({ baseUrl, wsKey, pageSize, max });

    // JEDYNY output:
    process.stdout.write(JSON.stringify(list));
  } catch (err) {
    console.error(
      err?.response?.status
        ? `${err.response.status} ${err.response.statusText}`
        : (err?.message || String(err))
    );
    process.exit(1);
  }
})();
