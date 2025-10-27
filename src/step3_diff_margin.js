// src/step3_diff_margin.js
require('dotenv').config();
const { fetchProductsIdEanPriceAll, fetchStock01All } = require('./presta');
const { fetchMJWAll } = require('./mjw');

function getArg(name, def) {
  const pref = `--${name}=`;
  const raw = process.argv.find(a => a.startsWith(pref));
  if (!raw) return def;
  const val = raw.slice(pref.length);
  const num = Number(val);
  return Number.isFinite(num) ? num : val;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}
const round2 = (x) => (x == null || Number.isNaN(x)) ? null : Math.round(Number(x) * 100) / 100;
function shapeUp99(x) {
  const v = Number(x);
  if (!Number.isFinite(v) || v <= 0) return null;
  const base = Math.floor(v) + 0.99;
  const shaped = (base < v - 1e-9) ? base + 1 : base;
  return round2(shaped);
}

(async () => {
  try {
    const baseUrl = process.env.PS_URL;
    const wsKey   = process.env.PS_WS_KEY;

    const PLN_PER_EUR = parseFloat(process.env.PLN_PER_EUR || '4.30');
    const MARGIN_RATE = parseFloat(process.env.MARGIN_RATE || '0.34');
    const PRICE_TOL   = parseFloat(process.env.PRICE_TOL   || '0.01');

    const limit   = getArg('limit', Infinity);
    const pageSz  = getArg('page', 200);
    const eanQ    = getArg('ean', null);
    const pretty  = hasFlag('pretty');

    const products = await fetchProductsIdEanPriceAll({ baseUrl, wsKey, pageSize: pageSz, max: limit });
    const stockMap = await fetchStock01All({ baseUrl, wsKey });

    const prestaByEan = new Map();
    for (const p of products) {
      const ean = (p.ean13 || '').trim();
      if (!ean) continue;
      const stock01 = stockMap.get(p.id) ?? 0;
      prestaByEan.set(ean, { id: p.id, price_eur: Number(p.price || 0), stock01 });
    }

    const mjwAll = await fetchMJWAll();
    const out = [];

    for (const m of mjwAll) {
      const ean = (m.ean || '').trim();
      if (!ean) continue;
      if (eanQ && ean !== String(eanQ)) continue;

      const p = prestaByEan.get(ean);
      if (!p) continue;

      const mjw_price_pln = (m.price_pln != null) ? Number(m.price_pln) : null;
      const mjw_price_eur = (mjw_price_pln != null) ? (mjw_price_pln / PLN_PER_EUR) : null;

      const target_raw_eur    = (mjw_price_eur != null) ? round2(mjw_price_eur * (1 + MARGIN_RATE)) : null;
      const target_shaped_eur = (target_raw_eur != null) ? shapeUp99(target_raw_eur) : null;

      const mjw_stock01 = (m.availability || '').toLowerCase() === 'in_stock' ? 1 : 0;
      const presta_price_eur = Number(p.price_eur || 0);
      const presta_stock01   = Number(p.stock01 || 0);

      let priceChanged = false, diff_abs = null, diff_pct = null;
      if (target_shaped_eur != null && presta_price_eur > 0) {
        diff_abs = round2(target_shaped_eur - presta_price_eur);
        diff_pct = Math.abs(diff_abs) / presta_price_eur;
        priceChanged = diff_pct > PRICE_TOL;
      } else if (target_shaped_eur != null && presta_price_eur === 0) {
        diff_abs = round2(target_shaped_eur);
        diff_pct = null;
        priceChanged = target_shaped_eur !== 0;
      }

      const stockChanged = mjw_stock01 !== presta_stock01;

      if (priceChanged || stockChanged) {
        out.push({
          ean,
          presta: { id: p.id, price_eur: round2(presta_price_eur), stock01: presta_stock01 },
          mjw:    { price_pln: round2(mjw_price_pln), price_eur: round2(mjw_price_eur), stock01: mjw_stock01 },
          calc:   { target_raw_eur, target_shaped_eur, diff_abs_eur: diff_abs, diff_pct }
        });
      }
    }

    const json = pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out);
    process.stdout.write(json);
  } catch (err) {
    console.error(
      err?.response?.status
        ? `${err.response.status} ${err.response.statusText}`
        : (err?.message || String(err))
    );
    process.exit(1);
  }
})();
