# E-mail beállítás

## 1. Saját feladó a Supabase leveleihez (SMTP)

Supabase Dashboard → **Authentication → Emails → SMTP Settings** → *Enable custom SMTP*.

Google Workspace / Gmail esetén:

| Mező | Érték |
| --- | --- |
| Sender email | info@spektrumevents.hu |
| Sender name | Spektrum Managers |
| Host | smtp.gmail.com |
| Port | 465 |
| Username | info@spektrumevents.hu |
| Password | alkalmazásjelszó (Google-fiók → Biztonság → Kétlépcsős azonosítás → Alkalmazásjelszavak) |

Saját SMTP nélkül a Supabase csak óránként néhány levelet küld, és csak a projekt csapattagjainak.
Beállítás után az **Authentication → Rate Limits** alatt az e-mail korlát felemelhető.

## 2. Magyar levélsablonok

**Authentication → Emails → Templates**: másold be az `email-templates` mappa fájljait
(a tárgy minden fájl első sorában van). A levelek alján a logó a portál `assets/spektrum-logo.png` fájlja, ezért az
**Authentication → URL Configuration → Site URL** a portál címe legyen.

- *Confirm signup* → `confirm-signup.html`
- *Reset password* → `reset-password.html`
- *Change email address* → `change-email.html`

## 3. Feladat-értesítő (koncert feladatok felelőse)

1. SQL Editor-ban futtasd le: `add_task_assignees.sql`.
2. **Edge Functions → Deploy a new function → Via Editor**, név: `task-notify`,
   tartalom: `functions/task-notify/index.ts`.
3. **Edge Functions → Secrets** alatt add meg: `SMTP_HOST`, `SMTP_PORT` (465), `SMTP_USER`,
   `SMTP_PASS`, `MAIL_FROM` (pl. `Spektrum Managers <info@spektrumevents.hu>`), `PORTAL_URL`
   (a portál címe, `/`-re végződve), és a levél aljára: `COMPANY_PHONE`, `COMPANY_EMAIL`,
   `COMPANY_WEB` (nem kötelezőek), `LOGO_URL` (alapból `PORTAL_URL` + `assets/spektrum-logo.png`).
4. A levelek alján lévő logó a portál `assets/spektrum-logo.png` fájlja (400×350 px) – a portállal együtt töltsd fel.

A felelős levelet kap, ha új feladatot kap, vagy módosul a határideje / szövege.
A főadminok minden ilyen levélről titkos másolatot (BCC) kapnak.
