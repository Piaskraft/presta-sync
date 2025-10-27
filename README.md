
# Presta Sync — bezpieczny diff cen i stanów

Mały CLI, który:

1. pobiera produkty z **Presta** (id, EAN, cena, stock 0/1),
2. pobiera feed **MJW** (PLN),
3. liczy **cenę docelową** (PLN→EUR, +marża, końcówka **.99**) i pokazuje **różnice**.

> Aktualnie pracujemy **tylko w trybie “read-only”** (krok 2 i 3).
> Skrypt **NIC nie zmienia** w sklepie, dopóki świadomie nie uruchomisz aktualizacji SQL (krok 4 – na razie wyłączony).

---

## Struktura projektu

```
presta-sync/
├─ .env                    # Twoje sekrety i ustawienia (PS_URL, WS_KEY, kurs, marża, itp.)
├─ .gitignore              # Ignorowane pliki (np. .env, node_modules/)
├─ package.json            # Zależności i metadane Node
├─ package-lock.json
└─ src/
   ├─ mjw.js               # Pobranie i parsowanie feedu MJW (XML → JS)
   ├─ presta.js            # Czytanie z Presta Webservice (id, EAN, price, stock)
   ├─ step2_mjw_matched.js # KROK 2: MJW „docięte” do EAN-ów z Presty (lista dopasowań)
   ├─ step3_diff_margin.js # KROK 3: porównanie z marżą + .99 (czytelny JSON diff)
   ├─ step3_diff.js        # Stare porównanie (bez marży i .99) — dla historii
   └─ step4_update_one.js  # KROK 4: (SQL update jednego produktu) — NA TEN MOMENT NIE UŻYWAMY
```

### Co jest w którym pliku?

* **`src/mjw.js`**

  * Czyta feed MJW z URL (domyślnie Google Products; można zmienić w `.env`).
  * Zwraca tablicę `{ ean, price_pln, availability, ... }`.

* **`src/presta.js`**

  * Funkcje do pobierania z Presta przez Webservice:

    * `fetchProductsIdEanPriceAll()` → `{id, ean13, price}` (paginacja).
    * `fetchStock01All()` → `Map(id_product -> 0/1)`.
    * `findProductIdPriceByEAN()` → szybkie `id/price` po EAN.

* **`src/step2_mjw_matched.js`** (**Krok 2**)

  * Bierzemy MJW i **filtrujemy** tylko EAN-y, które masz w Preście.
  * Szybki podgląd co jest dostępne do porównania.

* **`src/step3_diff_margin.js`** (**Krok 3 — główny**)

  * Przelicza cenę MJW: **PLN / `PLN_PER_EUR` → EUR → + `MARGIN_RATE` → kształtowanie do `x.99`**.
  * Pokazuje różnice vs Presta: `diff_abs_eur`, `diff_pct` + różnice stanów (0/1).
  * **Nie zapisuje nic** w sklepie.

* **`src/step3_diff.js`**

  * Starsza wersja porównania (bez marży i `.99`). Zostawiona jako referencja.

* **`src/step4_update_one.js`** (**Krok 4 — SQL update jednego produktu**)

  * Transakcja SQL: aktualizuje **tylko** `ps_product.price`, `ps_product_shop.price`, `ps_stock_available.quantity`.
  * Na razie **wyłączone** (wymaga SSH/tunelu/whitelist do MySQL). Użyjemy, gdy będziesz gotowy.

---

## Ustawienia (`.env`)

Minimalny zestaw:

```ini
PS_URL=https://www.piaskraft.com
PS_WS_KEY=TWÓJ_KLUCZ

# Logika cen
PLN_PER_EUR=4.30
MARGIN_RATE=0.34
PRICE_TOL=0.01

# Feed (opcjonalnie; domyślnie Google)
MJW_FEED_URL=https://mjwtools.com/xml/google_products.xml
```

> VAT liczy Presta – **pracujemy na cenach netto (EUR)**.

---

## Jak uruchamiać (krok po kroku)

> Wykonuj komendy z katalogu projektu (`presta-sync/`).
> W wynikach używaj flagi `--pretty` żeby dostać czytelny JSON.

### 1) Instalacja zależności

```bash
npm i
```

### 2) Krok 2 — dopasowane MJW → EAN-y z Presty

```bash
# 20 pierwszych dopasowań (ładnie sformatowane)
node ./src/step2_mjw_matched.js --limit=20 --pretty
```

### 3) Krok 3 — porównanie z marżą + .99 (bezpieczny diff)

```bash
# pełniejsza lista
node ./src/step3_diff_margin.js --limit=200 --pretty

# pojedynczy EAN (diagnostyka)
node ./src/step3_diff_margin.js --ean=5904012300606 --pretty
```

> Output zawiera:
>
> * `presta` — id, cena (EUR netto), stock 0/1,
> * `mjw` — cena w PLN + przeliczona EUR, stock 0/1,
> * `calc` — `target_raw_eur`, `target_shaped_eur` (**x.99**), `diff_abs_eur`, `diff_pct`.

---

## Logika ceny (dla jasności)

1. **PLN → EUR**: `price_pln / PLN_PER_EUR`
2. **Marża**: `eur * (1 + MARGIN_RATE)`
3. **Kształtowanie**: w górę do najbliższego `x.99` (np. `2.07 → 2.99`).
4. **Porównanie**: `diff_abs = target_shaped_eur - presta_price_eur`, `diff_pct = |diff_abs| / presta_price_eur`.

---

## Tryb „bezpieczny”

* Krok 2 i 3 to **czytanie** i **porównanie** — nie zmieniają sklepu.
* Krok 4 (SQL update) trzymamy **wyłączony**, dopóki nie będzie bezpiecznego dostępu (SSH/tunel/whitelist).
* Gdy przejdziemy do aktualizacji, zaczniemy **od jednego EAN** i robimy to w **transakcji** (najpierw DRY/ROLLBACK, potem REAL/COMMIT).

---

## Zmiana feedu MJW

* Ustaw w `.env`:

  ```ini
  MJW_FEED_URL=https://mjwtools.com/xml/ceneo.xml
  ```

