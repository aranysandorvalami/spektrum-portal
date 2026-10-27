/* Spektrum Managers – közös felület-segédek a portálhoz és az admin oldalhoz
   (eszközlista, DOM-segédek, téma, fejléc, értesítés, időformázás). */
(function () {
    "use strict";

    const sb = window.spektrumSb;
    const ROOT = document.currentScript.dataset.root || "./";   // a portál gyökere ehhez az oldalhoz képest

    const TOOLS = [
        { key: "concert", name: "Concert Manager", short: "Concert", desc: "Koncertek, helyszínek, időpontok és teendők", icon: "fa-guitar", tone: "var(--tone-concert)" },
        { key: "budget",  name: "Budget Manager",  short: "Budget",  desc: "Költségvetés, útiköltség és csomaglista",     icon: "fa-calculator", tone: "var(--tone-budget)" },
        { key: "library", name: "Library Manager", short: "Library", desc: "Leltár, rackek és eszközök vonalkóddal",       icon: "fa-boxes-stacked", tone: "var(--tone-library)" },
        { key: "network", name: "Network Manager", short: "Network", desc: "IP-blokkok és hálózati eszközök",             icon: "fa-server", tone: "var(--tone-network)" },
        { key: "rider",   name: "Rider Manager",   short: "Rider",   desc: "Technikai riderek és stage plotok",           icon: "fa-bolt", tone: "var(--tone-rider)" }
    ];
    const toolByKey = Object.fromEntries(TOOLS.map(t => [t.key, t]));

    // ---------------------------------------------------------------- DOM
    function el(tag, className, text) {
        const n = document.createElement(tag);
        if (className) n.className = className;
        if (text !== undefined && text !== null) n.textContent = text;
        return n;
    }
    function icon(name, extra) {
        const i = el("i", "fa-solid " + name + (extra ? " " + extra : ""));
        i.setAttribute("aria-hidden", "true");
        return i;
    }
    function button(text, className, onClick, iconName) {
        const b = el("button", "btn " + (className || "btn-ghost"));
        b.type = "button";
        if (iconName) b.append(icon(iconName));
        if (text) b.append(document.createTextNode(text));
        if (onClick) b.addEventListener("click", onClick);
        return b;
    }

    // ---------------------------------------------------------------- téma
    function getTheme() { try { return localStorage.getItem("portal_theme") || "dark"; } catch (_) { return "dark"; } }
    function applyTheme(theme) {
        if (!document.body) {   // a <head>-ben töltődik be, a body még nincs kész
            document.addEventListener("DOMContentLoaded", () => applyTheme(theme), { once: true });
            return;
        }
        document.body.classList.toggle("theme-light", theme === "light");
        try { localStorage.setItem("portal_theme", theme); } catch (_) { /* privát mód */ }
    }
    function toggleTheme() { applyTheme(document.body.classList.contains("theme-light") ? "dark" : "light"); }
    applyTheme(getTheme());

    // ---------------------------------------------------------------- értesítés
    let toastTimer = null;
    function toast(text, isError) {
        let t = document.querySelector(".toast");
        if (!t) { t = el("div", "toast"); t.setAttribute("role", "status"); document.body.append(t); }
        t.textContent = text;
        t.className = "toast" + (isError ? " err" : "");
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 5000 : 2500);
    }

    // ---------------------------------------------------------------- idő
    function timeAgo(iso) {
        if (!iso) return "";
        const diff = (Date.now() - new Date(iso).getTime()) / 1000;
        if (diff < 60) return "épp most";
        if (diff < 3600) return Math.floor(diff / 60) + " perce";
        if (diff < 86400) return Math.floor(diff / 3600) + " órája";
        if (diff < 86400 * 30) return Math.floor(diff / 86400) + " napja";
        return new Date(iso).toLocaleDateString("hu-HU");
    }
    function formatDate(d) {
        const dt = new Date(d + (String(d).length === 10 ? "T00:00:00" : ""));
        if (isNaN(dt)) return String(d || "");
        return dt.toLocaleDateString("hu-HU", { month: "short", day: "numeric", weekday: "short" });
    }

    // ---------------------------------------------------------------- felhasználó
    async function currentProfile() {
        const { data } = await sb.auth.getSession();
        if (!data.session) return null;
        const { data: p } = await sb.from("profiles").select("*").eq("id", data.session.user.id).maybeSingle();
        return p;
    }

    // Kezelhet-e csatlakozási kérelmeket bármelyik appban (munkatér-admin)
    async function canManageAny(profile) {
        if (profile.is_superadmin) return true;
        const checks = await Promise.all(TOOLS.map(t => sb.rpc("has_perm", { p_app: t.key, p_perm: "can_manage_dbs" })));
        return checks.some(r => r.data === true);
    }

    async function logout() {
        await sb.auth.signOut();
        location.href = ROOT + "index.html";
    }

    // ---------------------------------------------------------------- fiók blokk (mint az appok oldalsávjában)
    function accountBlock(p, onOpen) {
        const name = p.display_name || p.username;
        const box = el("div", "account");

        const who = el("button", "account-who");
        who.type = "button"; who.title = "Fiók adatai";
        who.addEventListener("click", onOpen);
        const av = el("div", "account-avatar mono", name.charAt(0).toUpperCase()); av.setAttribute("aria-hidden", "true");
        const txt = el("div", "account-text");
        const line1 = el("div", "account-name");
        line1.append(el("span", "online-dot"), el("span", "truncate", name));
        const line2 = el("div", "account-meta mono");
        line2.append(el("span", null, p.username), document.createTextNode(" • "),
                     el("span", "account-role", p.is_superadmin ? "Főadmin" : "Munkatárs"));
        txt.append(line1, line2);
        who.append(av, txt);

        const acts = el("div", "account-acts");
        acts.append(button("Fiók adatai", "btn-ghost btn-sm", onOpen, "fa-id-badge"));
        const out = el("button", "icon-btn icon-btn-danger"); out.type = "button";
        out.setAttribute("aria-label", "Kijelentkezés"); out.title = "Kijelentkezés";
        out.append(icon("fa-arrow-right-from-bracket")); out.addEventListener("click", logout);
        acts.append(out);

        box.append(who, acts);
        return box;
    }

    // ---------------------------------------------------------------- fiók adatai ablak
    function field(labelText, input) {
        const f = el("div", "field");
        const l = el("label", "label", labelText); l.htmlFor = input.id;
        f.append(l, input);
        return f;
    }
    function input(id, type, value, extra) {
        const i = el("input", "form-control" + (extra ? " " + extra : ""));
        i.id = id; i.type = type; i.value = value || "";
        return i;
    }
    function formMsg(form, text, kind) {
        const m = form.querySelector(".msg");
        m.textContent = text; m.className = "msg " + (kind || "err"); m.hidden = !text;
    }

    function openAccountModal(p, onSaved) {
        const overlay = el("div", "modal-overlay");
        const dlg = el("div", "panel modal");
        dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-labelledby", "accTitle");

        const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
        const onKey = (e) => { if (e.key === "Escape") close(); };
        document.addEventListener("keydown", onKey);
        overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

        const head = el("div", "modal-head");
        const h = el("h3"); h.id = "accTitle"; h.append(icon("fa-id-badge"), document.createTextNode(" Fiók adatai"));
        const x = el("button", "icon-btn"); x.type = "button"; x.setAttribute("aria-label", "Bezárás"); x.append(icon("fa-xmark"));
        x.addEventListener("click", close);
        head.append(h, x);

        // bal oldali fülek
        const tabs = el("div", "modal-tabs");
        const body = el("div", "modal-body");
        const panes = {};
        function tab(key, text, iconName) {
            const b = el("button", "modal-tab"); b.type = "button";
            b.append(icon(iconName), document.createTextNode(" " + text));
            b.addEventListener("click", () => {
                tabs.querySelectorAll(".modal-tab").forEach(t => t.classList.toggle("active", t === b));
                Object.keys(panes).forEach(k => { panes[k].hidden = k !== key; });
            });
            tabs.append(b);
            return b;
        }

        // Profil adatok
        const general = el("div");
        const status = el("div", "subtle info-box");
        status.append(el("div", "info-title", "Fiók állapot"));
        [["Szerepkör", p.is_superadmin ? "Főadminisztrátor" : "Munkatárs"],
         ["Állapot", p.status === "approved" ? "Jóváhagyva" : p.status === "pending" ? "Jóváhagyásra vár" : "Letiltva"],
         ["Regisztrált", p.created_at ? new Date(p.created_at).toLocaleDateString("hu-HU") : "–"]]
            .forEach(([k, v]) => { const r = el("div", "info-row mono"); r.append(el("span", null, k + ":"), el("b", null, v)); status.append(r); });

        const pf = el("form", "subtle info-box"); pf.noValidate = true;
        const iName = input("accDisplay", "text", p.display_name);
        const iEmail = input("accEmail", "email", p.email, "mono");
        const iUser = input("accUsername", "text", p.username, "mono");
        const save = el("button", "btn btn-primary", "Mentés"); save.type = "submit";
        pf.append(el("div", "info-title", "Azonosító adatok"),
                  field("Teljes név (megjelenített név)", iName), field("E-mail cím", iEmail),
                  field("Felhasználónév (belépéshez)", iUser), el("div", "form-acts"), el("p", "msg"));
        pf.querySelector(".form-acts").append(save);
        pf.querySelector(".msg").hidden = true;
        pf.addEventListener("submit", async (e) => {
            e.preventDefault(); formMsg(pf, "");
            const username = iUser.value.trim(), display = iName.value.trim(), email = iEmail.value.trim().toLowerCase();
            if (username.length < 2) return formMsg(pf, "A felhasználónév legalább 2 karakter legyen.");
            if (username.includes("@")) return formMsg(pf, "A felhasználónév nem tartalmazhat @ jelet.");
            save.disabled = true;
            const r = await sb.from("profiles").update({ username, display_name: display || username }).eq("id", p.id);
            if (r.error) { save.disabled = false; return formMsg(pf, /duplicate key/i.test(r.error.message) ? "Ez a felhasználónév már foglalt." : r.error.message); }
            let text = "Elmentve.";
            if (email && email !== (p.email || "")) {
                const u = await sb.auth.updateUser({ email }, { emailRedirectTo: new URL(ROOT + "index.html", location.href).href });
                if (u.error) { save.disabled = false; return formMsg(pf, u.error.message); }
                text += " Az új e-mail címet a kiküldött levélben erősítsd meg.";
            }
            save.disabled = false;
            p.username = username; p.display_name = display || username;
            formMsg(pf, text, "ok");
            if (onSaved) onSaved(p);
        });
        general.append(status, pf);

        // Biztonság & jelszó
        const security = el("div");
        const sf = el("form", "subtle info-box"); sf.noValidate = true;
        const iOld = input("accOldPw", "password", ""); iOld.autocomplete = "current-password";
        const iNew = input("accNewPw", "password", ""); iNew.autocomplete = "new-password";
        const iNew2 = input("accNewPw2", "password", ""); iNew2.autocomplete = "new-password";
        const pwBtn = el("button", "btn btn-primary", "Új jelszó mentése"); pwBtn.type = "submit";
        sf.append(el("div", "info-title", "Jelszó módosítása"), field("Jelenlegi jelszó", iOld),
                  field("Új jelszó (legalább 8 karakter)", iNew), field("Új jelszó még egyszer", iNew2),
                  el("div", "form-acts"), el("p", "msg"));
        sf.querySelector(".form-acts").append(pwBtn);
        sf.querySelector(".msg").hidden = true;
        sf.addEventListener("submit", async (e) => {
            e.preventDefault(); formMsg(sf, "");
            if (iNew.value.length < 8) return formMsg(sf, "Az új jelszó legalább 8 karakter legyen.");
            if (iNew.value !== iNew2.value) return formMsg(sf, "A két új jelszó nem egyezik.");
            pwBtn.disabled = true;
            const check = await sb.auth.signInWithPassword({ email: p.email, password: iOld.value });
            if (check.error) { pwBtn.disabled = false; return formMsg(sf, "A jelenlegi jelszó hibás."); }
            const r = await sb.auth.updateUser({ password: iNew.value });
            pwBtn.disabled = false;
            if (r.error) return formMsg(sf, r.error.message);
            sf.reset();
            formMsg(sf, "Az új jelszó elmentve.", "ok");
        });
        security.append(sf);

        panes.general = general; panes.security = security;
        body.append(general, security);
        tab("general", "Profil adatok", "fa-user-pen").click();
        tab("security", "Biztonság & jelszó", "fa-lock");

        const main = el("div", "modal-main");
        main.append(tabs, body);
        dlg.append(head, main);
        overlay.append(dlg);
        document.body.append(overlay);
        iName.focus();
    }

    // ---------------------------------------------------------------- fejléc
    function renderTopbar(target, opts) {
        const p = opts.profile;
        const bar = el("header", "topbar");

        const left = el("div", "topbar-left");
        const openAccount = () => openAccountModal(p, () => renderTopbar(target, opts));
        left.append(accountBlock(p, openAccount));

        const brand = el("a", "brand");
        brand.href = ROOT + "index.html";
        const box = el("div", "icon-box"); box.append(icon("fa-layer-group"));
        const txt = el("div");
        txt.append(el("h1", null, "Spektrum Managers"), el("p", "mono", "Spektrum Events belső rendszerei"));
        brand.append(box, txt);

        const nav = el("nav", "nav");
        nav.setAttribute("aria-label", "Fő menü");
        const home = el("a"); home.href = ROOT + "index.html";
        home.append(icon("fa-house"), el("span", "txt", "Vezérlőpult"));
        if (opts.active === "home") home.setAttribute("aria-current", "page");
        nav.append(home);
        if (opts.showAdmin) {
            const adm = el("a"); adm.href = ROOT + "admin/index.html";
            adm.append(icon("fa-shield-halved"), el("span", "txt", "Admin"));
            if (opts.adminBadge) adm.append(el("span", "dot", String(opts.adminBadge)));
            if (opts.active === "admin") adm.setAttribute("aria-current", "page");
            nav.append(adm);
        }
        left.append(nav);

        const right = el("div", "user");
        const themeBtn = el("button", "icon-btn"); themeBtn.type = "button";
        themeBtn.setAttribute("aria-label", "Téma váltása"); themeBtn.title = "Sötét / világos téma";
        themeBtn.append(icon("fa-circle-half-stroke")); themeBtn.addEventListener("click", toggleTheme);
        right.append(brand, themeBtn);

        bar.append(left, right);
        target.replaceChildren(bar);
    }

    window.SpektrumUI = {
        sb, ROOT, TOOLS, toolByKey, el, icon, button, toast, timeAgo, formatDate,
        applyTheme, toggleTheme, currentProfile, canManageAny, logout, renderTopbar, openAccountModal
    };
})();
