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

    // ---------------------------------------------------------------- fejléc
    function renderTopbar(target, opts) {
        const p = opts.profile;
        const bar = el("header", "topbar");

        const left = el("div", "topbar-left");
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
        left.append(brand, nav);

        const user = el("div", "user");
        const name = p.display_name || p.username;
        const ut = el("div", "user-text");
        const role = el("span", "badge" + (p.is_superadmin ? " super" : ""), p.is_superadmin ? "Főadmin" : p.username);
        ut.append(el("strong", null, name), role);
        const av = el("div", "avatar", name.charAt(0).toUpperCase()); av.setAttribute("aria-hidden", "true");
        const themeBtn = el("button", "icon-btn"); themeBtn.type = "button";
        themeBtn.setAttribute("aria-label", "Téma váltása"); themeBtn.title = "Sötét / világos téma";
        themeBtn.append(icon("fa-circle-half-stroke")); themeBtn.addEventListener("click", toggleTheme);
        const out = el("button", "icon-btn"); out.type = "button";
        out.setAttribute("aria-label", "Kijelentkezés"); out.title = "Kijelentkezés";
        out.append(icon("fa-right-from-bracket")); out.addEventListener("click", logout);
        user.append(ut, av, themeBtn, out);

        bar.append(left, user);
        target.replaceChildren(bar);
    }

    window.SpektrumUI = {
        sb, ROOT, TOOLS, toolByKey, el, icon, button, toast, timeAgo, formatDate,
        applyTheme, toggleTheme, currentProfile, canManageAny, logout, renderTopbar
    };
})();
