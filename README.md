# Spektrum Managers – portál

Közös bejelentkezés és az 5 belső eszköz (Concert, Budget, Library, Network, Rider Manager) egy helyen.
Statikus oldal (GitHub Pages), az adatok és a felhasználók Supabase-ben vannak.

## Felépítés

| Mappa / fájl | Mi ez |
|---|---|
| `index.html` | Portál: bejelentkezés, regisztráció, elfelejtett jelszó, az 5 eszköz gombja, jóváhagyás (főadmin) |
| `concert/`, `budget/`, `library/`, `network/`, `rider/` | Az 5 app (a régi felület, változatlan működéssel) |
| `shared/config.js` | Supabase URL és publishable kulcs |
| `shared/spektrum-api.js` | A régi `/api/...` hívásokat Supabase-hívássá alakítja |
| `shared/escape.js` | HTML-escapelés (XSS védelem) |
| `supabase/schema.sql` | Az adatbázis séma és jogosultságok (RLS) – referenciának |

## Jogosultságok

- Regisztráció után a fiók **jóváhagyásra vár**; a főadmin a portálon hagyja jóvá.
- Appon belül a Főadmin menüben állítható, ki milyen szerepkörrel (viewer / editor / admin) melyik munkatérhez fér hozzá.
- Más munkaterére csatlakozási kérelmet lehet küldeni; a munkatér adminja vagy a főadmin bírálja el.
- Minden jogosultságot az adatbázis (RLS) érvényesít, nem a böngésző.

## Fontos

- A `shared/config.js`-be **csak** a publishable / anon kulcs kerülhet, soha a `service_role` / secret kulcs.
- Az adatok nincsenek ebben a repóban, és nem is szabad ide tenni őket (a repó nyilvános).
