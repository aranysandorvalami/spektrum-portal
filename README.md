# Spektrum Managers – portál

Közös bejelentkezés és az 5 belső eszköz (Concert, Budget, Library, Network, Rider Manager) egy helyen.
Statikus oldal (GitHub Pages), az adatok és a felhasználók Supabase-ben vannak.

## Felépítés

| Mappa / fájl | Mi ez |
|---|---|
| `index.html`, `portal.css`, `portal.js` | Bejelentkezés, regisztráció, jelszó-visszaállítás és a vezérlőpult |
| `admin/` | Központi adminisztráció: regisztrációk, csatlakozási kérelmek, felhasználók, munkaterek, szerepkörök |
| `concert/`, `budget/`, `library/`, `network/`, `rider/` | Az 5 app, mindegyikben `index.html` + `style.css` + `script.js` |
| `shared/config.js` | Supabase URL és publishable kulcs (nincs a repó csomagban, kézzel kell létrehozni) |
| `shared/spektrum-api.js` | A régi `/api/...` hívásokat Supabase-hívássá alakítja |
| `shared/ui.js`, `shared/ui.css` | Közös felület (fejléc, téma, gombok) a portálhoz és az adminhoz |
| `shared/escape.js` | HTML-escapelés (XSS védelem) |
| `supabase/schema.sql` | Az adatbázis séma és jogosultságok (RLS) – referenciának |

## Fontos

- A `shared/config.js`-be **csak** a publishable / anon kulcs kerülhet, soha a `service_role` / secret kulcs.
- Az adatok nincsenek ebben a repóban, és nem is szabad ide tenni őket (a repó nyilvános).
