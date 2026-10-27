/* Spektrum Managers – admin oldal
   Egy helyen az 5 eszköz adminisztrációja: regisztrációk jóváhagyása, csatlakozási kérelmek,
   felhasználók jogosultságai eszközönként, munkaterek és szerepkörök.
   Minden művelet jogosultságát az adatbázis (RLS + RPC-k) ellenőrzi. */
(function () {
    "use strict";

    const UI = window.SpektrumUI;
    const { sb, el, icon, button, TOOLS, toolByKey, toast } = UI;
    const $ = (id) => document.getElementById(id);
    const params = new URLSearchParams(location.search);

    const PERM_LABELS = {
        can_edit_concerts: "Koncertek szerkesztése",
        can_delete_concerts: "Koncertek törlése",
        can_edit: "Tételek szerkesztése",
        can_delete: "Tételek törlése",
        can_edit_devices: "Eszközök szerkesztése",
        can_delete_devices: "Eszközök törlése",
        can_manage_blocks: "IP-blokkok kezelése",
        can_edit_riders: "Riderek szerkesztése",
        can_delete_riders: "Riderek törlése",
        can_manage_dbs: "Munkaterek felügyelete (kérelmek elbírálása)",
        can_access_admin: "Admin menü az eszközben"
    };

    const state = {
        me: null,
        isSuper: false,
        tab: null,
        app: toolByKey[params.get("app")] ? params.get("app") : "all",
        profiles: [], members: [], wsMembers: [], workspaces: [], roles: [], settings: [], requests: [],
        openUser: null
    };

    // ---------------------------------------------------------------- segédek
    const must = (res) => { if (res.error) throw res.error; return res.data; };
    function errText(e) {
        const m = (e && e.message) || String(e);
        if (/row-level security|permission denied/i.test(m)) return "Nincs jogosultságod ehhez a művelethez.";
        if (/duplicate key.*username/i.test(m)) return "Ez a felhasználónév már foglalt.";
        return m;
    }
    async function run(action, okText) {
        try {
            await action();
            if (okText) toast(okText);
            await load();
        } catch (e) {
            toast(errText(e), true);
        }
    }
    const appsInView = () => state.app === "all" ? TOOLS : [toolByKey[state.app]];
    const nameOf = (p) => p ? (p.display_name || p.username) : "?";
    function emptyRow(box, text) { box.append(el("p", "empty", text)); }

    function toolLabel(appKey, withName) {
        const t = toolByKey[appKey];
        const s = el("span", "perm-app");
        s.style.setProperty("--tone", t.tone);
        s.append(icon(t.icon), document.createTextNode(withName === false ? "" : t.short));
        return s;
    }

    // ---------------------------------------------------------------- betöltés
    async function load() {
        if (state.isSuper) {
            const [profiles, members, wsMembers, workspaces, roles, settings] = await Promise.all([
                sb.from("profiles").select("*").order("created_at"),
                sb.from("app_members").select("*"),
                sb.from("workspace_members").select("workspace_id, user_id"),
                sb.from("workspaces").select("id, app, name, title, subtitle, updated_at").order("name"),
                sb.from("app_roles").select("*").order("key"),
                sb.from("app_settings").select("*")
            ]);
            state.profiles = must(profiles); state.members = must(members); state.wsMembers = must(wsMembers);
            state.workspaces = must(workspaces); state.roles = must(roles); state.settings = must(settings);
        }
        state.requests = must(await sb.from("access_requests")
            .select("user_id, workspace_id, created_at, workspaces(app, name, title), profiles!access_requests_user_id_fkey(username, display_name, email)")
            .order("created_at"));
        renderCounts();
        renderTab();
    }

    function renderCounts() {
        const reg = state.profiles.filter(p => p.status === "pending").length;
        const req = state.requests.filter(r => r.user_id !== state.me.id).length;
        [["countRegistrations", reg], ["countRequests", req]].forEach(([id, n]) => {
            $(id).textContent = n;
            $(id).classList.toggle("zero", !n);
            $(id).classList.toggle("hot", n > 0);
        });
        UI.renderTopbar($("topbar"), { profile: state.me, active: "admin", showAdmin: true, adminBadge: reg + req || null });
    }

    // ---------------------------------------------------------------- fülek, szűrő
    const TAB_HAS_FILTER = { requests: true, users: true, workspaces: true, roles: true };

    function setTab(tab) {
        state.tab = tab;
        document.querySelectorAll(".tabs [data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
        document.querySelectorAll(".tab-panel").forEach(p => { p.hidden = p.dataset.panel !== tab; });
        $("appFilter").hidden = !TAB_HAS_FILTER[tab];
        const u = new URL(location.href);
        u.searchParams.set("tab", tab);
        history.replaceState(null, "", u);
        renderTab();
    }

    function renderFilter() {
        const box = $("appFilter");
        box.replaceChildren();
        const opts = [{ key: "all", short: "Mind", icon: "fa-layer-group", tone: "var(--text-muted)" }].concat(TOOLS);
        opts.forEach(t => {
            const c = el("button", "chip");
            c.type = "button";
            c.style.setProperty("--tone", t.tone);
            c.setAttribute("aria-pressed", String(state.app === t.key));
            c.append(icon(t.icon), document.createTextNode(t.short));
            c.addEventListener("click", () => {
                state.app = t.key;
                const u = new URL(location.href);
                if (t.key === "all") u.searchParams.delete("app"); else u.searchParams.set("app", t.key);
                history.replaceState(null, "", u);
                renderFilter();
                renderTab();
            });
            box.append(c);
        });
    }

    function renderTab() {
        if (!state.tab) return;
        ({ registrations: renderRegistrations, requests: renderRequests, users: renderUsers,
           workspaces: renderWorkspaces, roles: renderRoles })[state.tab]();
    }

    // ---------------------------------------------------------------- regisztrációk
    function renderRegistrations() {
        const box = $("registrationsList");
        box.replaceChildren();
        const pending = state.profiles.filter(p => p.status === "pending");
        if (!pending.length) return emptyRow(box, "Nincs jóváhagyásra váró regisztráció.");
        pending.forEach(p => {
            const row = el("div", "row");
            const info = el("div");
            info.append(el("div", "row-name", nameOf(p)),
                        el("div", "row-meta mono", p.username + " • " + (p.email || "nincs e-mail") + " • " + UI.timeAgo(p.created_at)));
            const acts = el("div", "row-acts");
            acts.append(
                button("Jóváhagyás", "btn-ok", () => run(async () => {
                    must(await sb.from("profiles").update({ status: "approved" }).eq("id", p.id));
                    state.openUser = p.id;
                }, nameOf(p) + " jóváhagyva. Állítsd be a jogait a Felhasználók fülön.")),
                button("Elutasítás", "btn-danger", () => {
                    if (confirm("Biztosan elutasítod " + nameOf(p) + " regisztrációját?")) {
                        run(async () => must(await sb.from("profiles").update({ status: "disabled" }).eq("id", p.id)), "Regisztráció elutasítva.");
                    }
                })
            );
            row.append(info, acts);
            box.append(row);
        });
    }

    // ---------------------------------------------------------------- kérelmek
    function renderRequests() {
        const box = $("requestsList");
        box.replaceChildren();
        const reqs = state.requests
            .filter(r => r.user_id !== state.me.id && r.workspaces)
            .filter(r => state.app === "all" || r.workspaces.app === state.app);
        if (!reqs.length) return emptyRow(box, "Nincs elbírálásra váró csatlakozási kérelem.");
        reqs.forEach(r => {
            const ws = r.workspaces, p = r.profiles || {};
            const row = el("div", "row");
            const info = el("div");
            const title = el("div", "row-name");
            title.append(document.createTextNode(nameOf(p) + " → "), toolLabel(ws.app), document.createTextNode(" " + (ws.title || ws.name)));
            info.append(title, el("div", "row-meta mono", (p.email || p.username || "") + " • " + UI.timeAgo(r.created_at)));
            const decide = (approve) => run(async () => must(await sb.rpc("decide_access_request", {
                p_app: ws.app, p_ws_name: ws.name, p_user: r.user_id, p_approve: approve
            })), approve ? "Hozzáférés megadva." : "Kérelem elutasítva.");
            const acts = el("div", "row-acts");
            acts.append(button("Elfogad", "btn-ok", () => decide(true)), button("Elutasít", "btn-danger", () => decide(false)));
            row.append(info, acts);
            box.append(row);
        });
    }

    // ---------------------------------------------------------------- felhasználók
    function userApps(userId) {
        const roleOf = {};
        state.members.filter(m => m.user_id === userId).forEach(m => { roleOf[m.app] = m.role; });
        const wsOf = {};
        state.wsMembers.filter(m => m.user_id === userId).forEach(m => {
            const w = state.workspaces.find(x => x.id === m.workspace_id);
            if (w) (wsOf[w.app] = wsOf[w.app] || []).push(w.name);
        });
        return { roleOf, wsOf };
    }

    function renderUsers() {
        const box = $("usersList");
        box.replaceChildren();
        const q = $("userSearch").value.trim().toLowerCase();
        const showDisabled = $("showDisabled").checked;
        const users = state.profiles
            .filter(p => p.status !== "pending")
            .filter(p => showDisabled || p.status !== "disabled")
            .filter(p => !q || [p.username, p.display_name, p.email].some(v => (v || "").toLowerCase().includes(q)));
        if (!users.length) return emptyRow(box, "Nincs a szűrésnek megfelelő felhasználó.");

        users.forEach(p => {
            const card = el("div", "panel user-card");
            const row = el("div", "user-row");
            const av = el("div", "avatar", nameOf(p).charAt(0).toUpperCase());
            const main = el("div", "user-main");
            const nm = el("div", "row-name", nameOf(p));
            if (p.is_superadmin) nm.append(el("span", "badge super", "Főadmin"));
            if (p.status === "disabled") nm.append(el("span", "tag red", "Letiltva"));
            if (p.id === state.me.id) nm.append(el("span", "tag blue", "Te"));
            main.append(nm, el("div", "row-meta mono", p.username + " • " + (p.email || "nincs e-mail")));

            // eszközönkénti összefoglaló
            const { roleOf, wsOf } = userApps(p.id);
            const sum = el("div", "row-meta");
            if (p.is_superadmin) sum.textContent = "Minden eszközhöz és munkatérhez hozzáfér.";
            else {
                const parts = TOOLS.filter(t => (wsOf[t.key] || []).length).map(t => t.short + ": " + (roleOf[t.key] || "editor") + " (" + wsOf[t.key].length + ")");
                sum.textContent = parts.length ? parts.join(" • ") : "Még nincs munkatere egyik eszközben sem.";
            }
            main.append(sum);

            const acts = el("div", "user-acts");
            const open = state.openUser === p.id;
            if (!p.is_superadmin && p.status !== "disabled") {
                const b = button(open ? "Bezárás" : "Jogosultságok", "btn-ghost", () => {
                    state.openUser = open ? null : p.id; renderUsers();
                }, open ? "fa-chevron-up" : "fa-sliders");
                b.setAttribute("aria-expanded", String(open));
                acts.append(b);
            }
            if (p.id !== state.me.id) {
                if (p.status !== "disabled") {
                    acts.append(button(p.is_superadmin ? "Főadmin jog elvétele" : "Főadminná tétel", "btn-ghost", () => {
                        const make = !p.is_superadmin;
                        if (confirm(make ? nameOf(p) + " Főadmin lesz, és mindenhez hozzáfér. Biztos?" : "Elveszed " + nameOf(p) + " Főadmin jogát?")) {
                            run(async () => must(await sb.from("profiles").update({ is_superadmin: make }).eq("id", p.id)), "Mentve.");
                        }
                    }, "fa-crown"));
                    acts.append(button("Letiltás", "btn-danger", () => {
                        if (confirm(nameOf(p) + " nem fog tudni belépni. Letiltod?")) {
                            run(async () => must(await sb.from("profiles").update({ status: "disabled", is_superadmin: false }).eq("id", p.id)), "Felhasználó letiltva.");
                        }
                    }, "fa-ban"));
                } else {
                    acts.append(button("Engedélyezés", "btn-ok", () =>
                        run(async () => must(await sb.from("profiles").update({ status: "approved" }).eq("id", p.id)), "Felhasználó újra aktív.")));
                }
            }
            row.append(av, main, acts);
            card.append(row);
            if (open) card.append(renderUserDetail(p, roleOf, wsOf));
            box.append(card);
        });
    }

    function renderUserDetail(p, roleOf, wsOf) {
        const box = el("div", "user-detail");
        const table = el("table", "perm-table");
        const head = el("thead"); const hr = el("tr");
        ["Eszköz", "Szerepkör", "Munkaterek", ""].forEach(h => hr.append(el("th", null, h)));
        head.append(hr);
        const body = el("tbody");

        appsInView().forEach(t => {
            const tr = el("tr");
            const c1 = el("td"); c1.append(toolLabel(t.key));

            const c2 = el("td");
            const sel = el("select", "form-control select");
            sel.setAttribute("aria-label", t.short + " szerepkör");
            state.roles.filter(r => r.app === t.key && r.key !== "superadmin").forEach(r => {
                const o = el("option", null, r.name); o.value = r.key; sel.append(o);
            });
            sel.value = roleOf[t.key] || "editor";
            c2.append(sel);

            const c3 = el("td", "ws-cell");
            const checks = el("div", "ws-checks");
            const mine = new Set(wsOf[t.key] || []);
            const wss = state.workspaces.filter(w => w.app === t.key);
            if (!wss.length) checks.append(el("span", "row-meta", "Nincs munkatér."));
            wss.forEach(w => {
                const lab = el("label", "check");
                const cb = el("input"); cb.type = "checkbox"; cb.value = w.name; cb.checked = mine.has(w.name);
                lab.append(cb, document.createTextNode(w.title || w.name));
                checks.append(lab);
            });
            c3.append(checks);

            const c4 = el("td");
            c4.append(button("Mentés", "btn-primary", () => run(async () => must(await sb.rpc("admin_save_app_user", {
                p_app: t.key, p_user: p.id, p_username: p.username, p_display_name: p.display_name || p.username,
                p_role: sel.value, p_workspaces: Array.from(checks.querySelectorAll("input:checked")).map(x => x.value)
            })), t.short + ": " + nameOf(p) + " jogai mentve.")));

            tr.append(c1, c2, c3, c4);
            body.append(tr);
        });
        table.append(head, body);
        box.append(table);
        if (state.app !== "all") box.append(el("p", "perm-note", "Csak a kiválasztott eszköz látszik. A többit a „Mind” szűrővel éred el."));
        return box;
    }

    // ---------------------------------------------------------------- munkaterek
    function renderWorkspaces() {
        const box = $("workspacesList");
        box.replaceChildren();
        const sel = $("newWsApp");
        if (!sel.options.length) TOOLS.forEach(t => { const o = el("option", null, t.short); o.value = t.key; sel.append(o); });
        if (state.app !== "all") sel.value = state.app;

        appsInView().forEach(t => {
            const block = el("section", "app-block");
            block.style.setProperty("--tone", t.tone);
            const head = el("div", "panel-head");
            const h = el("h3"); h.append(icon(t.icon), document.createTextNode(t.name));
            head.append(h);
            const list = el("div", "panel list");
            const def = (state.settings.find(s => s.app === t.key) || {}).default_workspace;
            const wss = state.workspaces.filter(w => w.app === t.key);
            if (!wss.length) emptyRow(list, "Nincs még munkatér.");
            wss.forEach(w => {
                const members = state.wsMembers.filter(m => m.workspace_id === w.id).length;
                const row = el("div", "row");
                const info = el("div");
                const nm = el("div", "row-name", w.title || w.name);
                if (w.name === def) nm.append(document.createTextNode(" "), el("span", "tag blue", "Alapértelmezett"));
                info.append(nm, el("div", "row-meta mono", w.name + " • " + members + " tag • módosítva " + UI.timeAgo(w.updated_at)));
                const acts = el("div", "row-acts");
                const openA = el("a", "btn btn-ghost"); openA.href = "../" + t.key + "/index.html"; openA.append(icon("fa-arrow-up-right-from-square"), document.createTextNode("Megnyitás"));
                acts.append(openA);
                if (w.name !== def) {
                    acts.append(button("Alapértelmezett", "btn-ghost", () => run(async () =>
                        must(await sb.from("app_settings").upsert({ app: t.key, default_workspace: w.name })), "Alapértelmezett munkatér beállítva.")));
                    acts.append(button("", "btn-danger", () => {
                        const answer = prompt("A(z) " + (w.title || w.name) + " munkatér MINDEN adata törlődik, és nem állítható vissza.\nÍrd be a nevét a megerősítéshez: " + w.name);
                        if (answer === w.name) run(async () => {
                            const res = await sb.from("workspaces").delete().eq("id", w.id).select("id");
                            if (res.error) throw res.error;
                            if (!res.data.length) throw new Error("Nincs jogosultságod törölni.");
                        }, "Munkatér törölve.");
                        else if (answer !== null) toast("A név nem egyezett, nem töröltem.", true);
                    }, "fa-trash"));
                }
                row.append(info, acts);
                list.append(row);
            });
            block.append(head, list);
            box.append(block);
        });
    }

    $("createWsForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const app = $("newWsApp").value;
        const title = $("newWsName").value.trim();
        const name = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/g, "").slice(0, 60);
        if (!name) return toast("Adj meg egy nevet (betűk, számok).", true);
        const sub = { concert: "Koncertmenedzsment", budget: "Zenekari Költségvetés, Logisztika & Csomagolási Munkatér",
                      library: "Zenekari Leltár & Raktárkezelő Munkatér", network: "10.x.x.x Blokkiosztás & Részleg Vizuális Munkatér",
                      rider: "RiderMaker Projekt Munkatér" }[app];
        run(async () => {
            must(await sb.rpc("create_workspace", { p_app: app, p_name: name, p_title: title, p_subtitle: sub }));
            $("newWsName").value = "";
        }, toolByKey[app].short + ": „" + title + "” létrehozva.");
    });

    // ---------------------------------------------------------------- szerepkörök
    function renderRoles() {
        const box = $("rolesList");
        box.replaceChildren();
        appsInView().forEach(t => {
            const block = el("section", "app-block");
            block.style.setProperty("--tone", t.tone);
            const head = el("div", "panel-head");
            const h = el("h3"); h.append(icon(t.icon), document.createTextNode(t.name));
            head.append(h);
            const grid = el("div", "role-grid");
            const roles = state.roles.filter(r => r.app === t.key);
            const permKeys = Array.from(new Set(roles.flatMap(r => Object.keys(r.permissions || {}))));
            roles.filter(r => r.key !== "superadmin").forEach(r => grid.append(roleCard(t, r, permKeys)));
            grid.append(roleCard(t, null, permKeys));
            block.append(head, grid);
            box.append(block);
        });
        const note = el("p", "hint", "A Főadmin mindenhez hozzáfér, ezért nem szerkeszthető. Felhasználót a Felhasználók fülön tehetsz Főadminná.");
        box.append(note);
    }

    function roleCard(t, role, permKeys) {
        const card = el("form", "role-card" + (role ? "" : " new"));
        const uid = t.key + "_" + (role ? role.key : "new");
        const keyField = el("div", "field");
        if (role) {
            keyField.append(el("span", "role-key mono", role.key));
        } else {
            const l = el("label", "label", "Új szerepkör kulcsa"); l.htmlFor = uid + "_key";
            const i = el("input", "form-control mono"); i.id = uid + "_key"; i.placeholder = "pl. technikus"; i.pattern = "[a-z0-9_]{2,40}"; i.required = true;
            keyField.append(l, i);
        }
        const nameF = el("div", "field");
        const nl = el("label", "label", "Megnevezés"); nl.htmlFor = uid + "_name";
        const ni = el("input", "form-control"); ni.id = uid + "_name"; ni.required = true; ni.value = role ? role.name : "";
        nameF.append(nl, ni);
        const descF = el("div", "field");
        const dl = el("label", "label", "Leírás"); dl.htmlFor = uid + "_desc";
        const di = el("input", "form-control"); di.id = uid + "_desc"; di.value = role ? (role.description || "") : "";
        descF.append(dl, di);

        const perms = el("div", "perm-list");
        permKeys.forEach(k => {
            const lab = el("label", "check");
            const cb = el("input"); cb.type = "checkbox"; cb.name = k;
            cb.checked = role ? !!(role.permissions || {})[k] : false;
            lab.append(cb, document.createTextNode(PERM_LABELS[k] || k));
            perms.append(lab);
        });

        const save = el("button", "btn btn-primary"); save.type = "submit";
        save.append(icon(role ? "fa-floppy-disk" : "fa-plus"), document.createTextNode(role ? "Mentés" : "Hozzáadás"));
        card.append(keyField, nameF, descF, perms, save);

        card.addEventListener("submit", (e) => {
            e.preventDefault();
            const key = role ? role.key : card.querySelector("#" + CSS.escape(uid + "_key")).value.trim().toLowerCase();
            if (!/^[a-z0-9_]{2,40}$/.test(key)) return toast("A kulcs csak kisbetű, szám és _ lehet (2–40 karakter).", true);
            const permissions = {};
            perms.querySelectorAll("input").forEach(cb => { permissions[cb.name] = cb.checked; });
            run(async () => must(await sb.from("app_roles").upsert({
                app: t.key, key, name: ni.value.trim(), description: di.value.trim(), permissions
            }, { onConflict: "app,key" })), t.short + ": „" + ni.value.trim() + "” szerepkör mentve.");
        });
        return card;
    }

    // ---------------------------------------------------------------- indítás
    async function init() {
        const p = await UI.currentProfile();
        if (!p || p.status !== "approved") { location.replace("../index.html?next=admin"); return; }
        state.me = p;
        state.isSuper = !!p.is_superadmin;

        const allowed = state.isSuper || await UI.canManageAny(p);
        UI.renderTopbar($("topbar"), { profile: p, active: "admin", showAdmin: allowed });
        if (!allowed) { $("noAccess").hidden = false; return; }

        if (!state.isSuper) {
            document.querySelectorAll("[data-super]").forEach(b => b.remove());
            $("adminSubtitle").textContent = "Az általad felügyelt munkaterek csatlakozási kérelmei.";
        }
        $("adminMain").hidden = false;

        document.querySelectorAll(".tabs [data-tab]").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
        $("reloadBtn").addEventListener("click", () => run(async () => {}, "Frissítve."));
        $("userSearch").addEventListener("input", renderUsers);
        $("showDisabled").addEventListener("change", renderUsers);
        renderFilter();

        try { await load(); } catch (e) { toast(errText(e), true); }

        const available = Array.from(document.querySelectorAll(".tabs [data-tab]")).map(b => b.dataset.tab);
        let tab = params.get("tab");
        if (!available.includes(tab)) {
            const hasReg = state.profiles.some(x => x.status === "pending");
            tab = state.isSuper ? (hasReg ? "registrations" : state.requests.length ? "requests" : "users") : "requests";
        }
        setTab(tab);
    }

    init();
})();
