/* Spektrum Managers – portál (bejelentkezés + vezérlőpult)
   Bejelentkezés, regisztráció, jelszó-visszaállítás (Supabase Auth), és a vezérlőpult:
   az 5 eszköz összesítőivel, a következő koncertekkel és a legutóbbi módosításokkal. */
(function () {
    "use strict";

    const UI = window.SpektrumUI;
    const { sb, el, icon, TOOLS, toolByKey } = UI;
    const params = new URLSearchParams(location.search);
    const portalUrl = location.origin + location.pathname;
    let recoveryMode = /type=recovery/.test(location.hash);

    const $ = (id) => document.getElementById(id);

    // ---------------------------------------------------------------- nézetek, űrlapok
    const views = ["authView", "pendingView", "homeView"];
    function show(view) { views.forEach(v => { $(v).hidden = v !== view; }); }

    const subtitles = {
        loginForm: "Belépés az 5 eszközhöz",
        registerForm: "Új hozzáférési kérelem",
        forgotForm: "Jelszó visszaállítása",
        resetForm: "Új jelszó beállítása"
    };
    function showForm(id) {
        Object.keys(subtitles).forEach(f => { $(f).hidden = f !== id; });
        $("authSubtitle").textContent = subtitles[id];
        const first = $(id).querySelector("input");
        if (first) first.focus();
    }

    function msg(form, text, kind) {
        const m = form.querySelector(".msg");
        m.textContent = text;
        m.className = "msg " + (kind || "err");
        m.hidden = !text;
    }
    function busy(form, on) { form.querySelector("button[type=submit]").disabled = on; }

    function translateAuthError(e) {
        const m = (e && e.message) || "";
        if (/Invalid login credentials/i.test(m)) return "Hibás e-mail cím vagy jelszó.";
        if (/Email not confirmed/i.test(m)) return "Az e-mail címed még nincs megerősítve. Nézd meg a postafiókod (a spam mappát is).";
        if (/already registered/i.test(m)) return "Ezzel az e-mail címmel már van fiók. Jelentkezz be, vagy kérj új jelszót.";
        if (/Password should be/i.test(m)) return "A jelszó túl rövid vagy túl egyszerű (legalább 8 karakter).";
        if (/rate limit/i.test(m)) return "Túl sok próbálkozás. Várj pár percet, és próbáld újra.";
        if (/Invalid API key/i.test(m)) return "Hibás Supabase kulcs a shared/config.js fájlban.";
        return m || "Ismeretlen hiba történt.";
    }

    document.querySelectorAll("[data-show]").forEach(b =>
        b.addEventListener("click", () => showForm(b.dataset.show)));

    document.querySelectorAll("[data-toggle-pw]").forEach(b => b.addEventListener("click", () => {
        const input = $(b.dataset.togglePw);
        const visible = input.type === "password";
        input.type = visible ? "text" : "password";
        b.querySelector("i").className = "fa-solid " + (visible ? "fa-eye-slash" : "fa-eye");
    }));

    document.querySelectorAll("[data-action=logout]").forEach(b => b.addEventListener("click", async () => {
        await sb.auth.signOut();
        show("authView");
        showForm("loginForm");
    }));

    // ---------------------------------------------------------------- belépés
    $("loginForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target; msg(f, ""); busy(f, true);
        const { error } = await sb.auth.signInWithPassword({
            email: $("loginEmail").value.trim(),
            password: $("loginPassword").value
        });
        busy(f, false);
        if (error) return msg(f, translateAuthError(error));
        route();
    });

    // ---------------------------------------------------------------- regisztráció
    $("registerForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target; msg(f, "");
        const username = $("regUsername").value.trim();
        if (username.length < 2) return msg(f, "A felhasználónév legalább 2 karakter legyen.");
        if (!$("regEmail").value.trim()) return msg(f, "Add meg az e-mail címed.");
        if ($("regPassword").value.length < 8) return msg(f, "A jelszó legalább 8 karakter legyen.");
        busy(f, true);
        const { data, error } = await sb.auth.signUp({
            email: $("regEmail").value.trim(),
            password: $("regPassword").value,
            options: {
                emailRedirectTo: portalUrl,
                data: { username, display_name: $("regDisplay").value.trim() }
            }
        });
        busy(f, false);
        if (error) return msg(f, translateAuthError(error));
        if (data.session) return route();
        msg(f, "Elküldtük a megerősítő levelet. Kattints a benne lévő linkre (nézd meg a spam mappát is), utána a Főadminisztrátor jóváhagyja a fiókod.", "ok");
        f.reset();
    });

    // ---------------------------------------------------------------- elfelejtett jelszó
    $("forgotForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target; msg(f, ""); busy(f, true);
        const { error } = await sb.auth.resetPasswordForEmail($("forgotEmail").value.trim(), { redirectTo: portalUrl });
        busy(f, false);
        if (error) return msg(f, translateAuthError(error));
        msg(f, "Ha van fiók ezzel a címmel, elküldtük a linket. Nézd meg a postafiókod.", "ok");
    });

    // ---------------------------------------------------------------- új jelszó a levél linkjéről
    $("resetForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const f = e.target; msg(f, "");
        const p1 = $("resetPw1").value, p2 = $("resetPw2").value;
        if (p1.length < 8) return msg(f, "A jelszó legalább 8 karakter legyen.");
        if (p1 !== p2) return msg(f, "A két jelszó nem egyezik.");
        busy(f, true);
        const { error } = await sb.auth.updateUser({ password: p1 });
        busy(f, false);
        if (error) return msg(f, translateAuthError(error));
        history.replaceState(null, "", portalUrl);
        recoveryMode = false;
        route();
    });

    sb.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
            recoveryMode = true;
            show("authView");
            showForm("resetForm");
        }
    });

    // ---------------------------------------------------------------- vezérlőpult
    const todayIso = () => new Date().toISOString().slice(0, 10);
    const arr = (v) => Array.isArray(v) ? v : [];

    // Az egyes eszközök összesítő számai a munkaterek tartalmából
    const STATS = {
        concert: (wss) => {
            const all = wss.flatMap(w => arr(w.data.concerts));
            const upcoming = all.filter(c => (c.concert_date || "") >= todayIso());
            const openTasks = all.reduce((n, c) => n + arr(c.tasks).filter(t => !t.is_done).length, 0);
            return [[upcoming.length, "Közelgő"], [openTasks, "Nyitott teendő"]];
        },
        budget: (wss) => [[wss.length, "Projekt"], [wss.reduce((n, w) => n + arr(w.data.devices).length, 0), "Tétel"]],
        library: (wss) => [[wss.reduce((n, w) => n + arr(w.data.devices).length, 0), "Eszköz"], [wss.length, "Raktár"]],
        network: (wss) => [[wss.reduce((n, w) => n + arr(w.data.devices).length, 0), "Eszköz"], [wss.reduce((n, w) => n + arr(w.data.blocks).length, 0), "IP-blokk"]],
        rider: (wss) => [[wss.reduce((n, w) => n + arr(w.data.riders).length, 0), "Rider"], [wss.length, "Munkatér"]]
    };

    function renderTools(byApp) {
        const list = $("toolList");
        list.replaceChildren();
        TOOLS.forEach(t => {
            const a = el("a", "tool");
            a.href = t.key + "/index.html";
            a.style.setProperty("--tone", t.tone);

            const top = el("div", "tool-top");
            const box = el("div", "icon-box"); box.append(icon(t.icon));
            const body = el("div", "tool-body");
            body.append(el("div", "tool-name", t.name), el("div", "tool-desc", t.desc));
            top.append(box, body, icon("fa-chevron-right", "chev"));
            a.append(top);

            const wss = byApp[t.key] || [];
            if (wss.length) {
                const stats = el("div", "tool-stats");
                STATS[t.key](wss).forEach(([n, label]) => {
                    const s = el("div", "stat");
                    s.append(el("b", null, String(n)), el("span", null, label));
                    stats.append(s);
                });
                a.append(stats);
            } else {
                a.append(el("div", "tool-none", "Még nincs munkatered itt. Nyisd meg, és kérj hozzáférést."));
            }
            const li = el("li"); li.append(a);
            list.append(li);
        });
    }

    function renderUpcoming(concertWss) {
        const box = $("upcomingList");
        box.replaceChildren();
        const items = concertWss.flatMap(w => arr(w.data.concerts).map(c => ({ c, ws: w })))
            .filter(x => (x.c.concert_date || "") >= todayIso())
            .sort((a, b) => a.c.concert_date.localeCompare(b.c.concert_date))
            .slice(0, 5);
        if (!items.length) { box.append(el("p", "empty", "Nincs közelgő koncert.")); return; }
        const statusTag = { confirmed: ["Visszaigazolt", "green"], planned: ["Tervezett", "amber"], cancelled: ["Lemondva", "red"], done: ["Megvalósult", "blue"] };
        items.forEach(({ c, ws }) => {
            const a = el("a", "item");
            a.href = "concert/index.html";
            const d = new Date(c.concert_date + "T00:00:00");
            const chip = el("div", "date-chip");
            chip.append(el("b", null, String(d.getDate())), el("span", null, d.toLocaleDateString("hu-HU", { month: "short" }).replace(".", "")));
            const body = el("div", "item-body");
            body.append(el("div", "item-title", c.title || "Névtelen koncert"));
            const place = [c.city, c.venue].filter(Boolean).join(", ");
            const meta = el("div", "item-meta", [place, c.show_time ? "kezdés " + c.show_time : "", ws.title].filter(Boolean).join(" • "));
            body.append(meta);
            const st = statusTag[c.status] || [c.status || "", ""];
            a.append(chip, body);
            if (st[0]) a.append(el("span", "tag " + st[1], st[0]));
            box.append(a);
        });
    }

    function renderRecent(wss) {
        const box = $("recentList");
        box.replaceChildren();
        const items = wss.slice().sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 6);
        if (!items.length) { box.append(el("p", "empty", "Még nincs módosítás.")); return; }
        items.forEach(w => {
            const t = toolByKey[w.app];
            const a = el("a", "item");
            a.href = w.app + "/index.html";
            const ic = el("div", "item-icon"); ic.style.setProperty("--tone", t.tone); ic.append(icon(t.icon));
            const body = el("div", "item-body");
            body.append(el("div", "item-title", t.short + " – " + (w.title || w.name)),
                        el("div", "item-meta", "módosítva " + UI.timeAgo(w.updated_at)));
            a.append(ic, body);
            box.append(a);
        });
    }

    async function renderAdminAlert(profile) {
        let pending = 0, requests = 0;
        if (profile.is_superadmin) {
            const r = await sb.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending");
            pending = r.count || 0;
        }
        const q = await sb.from("access_requests").select("user_id", { count: "exact", head: true }).neq("user_id", profile.id);
        requests = q.count || 0;
        const parts = [];
        if (pending) parts.push(pending + " regisztráció vár jóváhagyásra");
        if (requests) parts.push(requests + " csatlakozási kérelem vár elbírálásra");
        $("adminAlert").hidden = !parts.length;
        $("adminAlertText").textContent = parts.join(", ");
        return pending + requests;
    }

    function greet(name) {
        const h = new Date().getHours();
        const g = h < 5 ? "Jó éjszakát" : h < 10 ? "Jó reggelt" : h < 18 ? "Szia" : "Jó estét";
        $("greeting").textContent = g + ", " + name.split(" ").slice(-1)[0] + "!";
        $("today").textContent = new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
    }

    async function renderHome(p) {
        show("homeView");
        greet(p.display_name || p.username);
        const showAdmin = await UI.canManageAny(p);
        UI.renderTopbar($("topbar"), { profile: p, active: "home", showAdmin });

        const { data: wss, error } = await sb.from("workspaces").select("app, name, title, data, updated_at");
        if (error) { UI.toast("Nem sikerült betölteni az adatokat: " + error.message, true); return; }
        wss.forEach(w => { w.data = w.data || {}; });
        const byApp = {};
        wss.forEach(w => (byApp[w.app] = byApp[w.app] || []).push(w));
        renderTools(byApp);
        renderUpcoming(byApp.concert || []);
        renderRecent(wss);

        if (showAdmin) {
            const n = await renderAdminAlert(p);
            if (n) UI.renderTopbar($("topbar"), { profile: p, active: "home", showAdmin, adminBadge: n });
        }
    }

    // ---------------------------------------------------------------- útválasztás
    async function route() {
        if (recoveryMode) { show("authView"); showForm("resetForm"); return; }

        const { data } = await sb.auth.getSession();
        if (!data.session) {
            show("authView");
            showForm(location.hash === "#register" ? "registerForm" : location.hash === "#forgot" ? "forgotForm" : "loginForm");
            return;
        }

        const p = await UI.currentProfile();
        if (!p || p.status !== "approved") {
            const disabled = p && p.status === "disabled";
            $("pendingTitle").textContent = disabled ? "A fiókod le van tiltva" : "A fiókod jóváhagyásra vár";
            $("pendingText").textContent = disabled
                ? "Ha szerinted ez tévedés, keresd a Főadminisztrátort."
                : "Amint a Főadminisztrátor jóváhagyja, itt megjelennek az eszközök. Nézz vissza később, vagy szólj neki.";
            show("pendingView");
            return;
        }

        const next = params.get("next");
        if (next && toolByKey[next]) { location.replace(next + "/index.html"); return; }
        if (next === "admin") { location.replace("admin/index.html"); return; }

        renderHome(p);
    }

    const cfg = window.SPEKTRUM_CONFIG || {};
    if (!cfg.supabaseKey || /IDE_JON/.test(cfg.supabaseKey)) {
        document.body.prepend(el("p", "config-warning", "Hiányzik a Supabase kulcs a shared/config.js fájlból."));
    }
    route();
})();
