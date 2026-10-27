/*
 * Spektrum API-réteg
 * ------------------
 * A régi Python szerverek /api/... végpontjait szolgálja ki a böngészőben, Supabase-en keresztül.
 * Az appok kódja változatlanul hívja a fetch('/api/...')-t, ez a fájl elkapja és Supabase-hívássá alakítja.
 * A jogosultságokat NEM ez a fájl, hanem az adatbázis RLS-szabályai érvényesítik.
 *
 * Használat egy app index.html-jében (a <head>-ben, minden más script előtt):
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *   <script src="../shared/config.js"></script>
 *   <script>window.SPEKTRUM_APP = "concert";</script>
 *   <script src="../shared/spektrum-api.js"></script>
 */
(function () {
  "use strict";

  const cfg = window.SPEKTRUM_CONFIG || {};
  const sb = window.spektrumSb || window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "spektrum-auth" }
  });
  window.spektrumSb = sb;

  const APP = window.SPEKTRUM_APP;            // pl. "concert" – csak az appokban van megadva
  const PORTAL_URL = new URL(APP ? "../index.html" : "./index.html", location.href).href;

  const DEFAULT_SUBTITLES = {
    concert: "Koncertmenedzsment",
    budget: "Zenekari Költségvetés, Logisztika & Csomagolási Munkatér",
    library: "Zenekari Leltár & Raktárkezelő Munkatér",
    network: "10.x.x.x Blokkiosztás & Részleg Vizuális Munkatér",
    rider: "RiderMaker Projekt Munkatér"
  };

  // ---------------------------------------------------------------- segédek
  function json(status, body) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  const ok = (body) => json(200, body || { status: "success" });
  const fail = (status, error) => json(status, { error });

  function errMsg(e) {
    if (!e) return "Ismeretlen hiba";
    const m = e.message || String(e);
    if (/row-level security|permission denied/i.test(m)) return "Nincs jogosultságod ehhez a művelethez!";
    if (/duplicate key.*username/i.test(m)) return "Ez a felhasználónév már foglalt!";
    return m;
  }
  function must(res) {
    if (res.error) throw res.error;
    return res.data;
  }

  async function currentUser() {
    const { data } = await sb.auth.getSession();
    return data.session ? data.session.user : null;
  }

  let profileCache = null;
  async function myProfile(force) {
    const user = await currentUser();
    if (!user) return null;
    if (profileCache && profileCache.id === user.id && !force) return profileCache;
    const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profileCache = data;
    return data;
  }

  async function appRoles() {
    const rows = must(await sb.from("app_roles").select("*").eq("app", APP).order("key"));
    const roles = {};
    rows.forEach(r => roles[r.key] = {
      name: r.name, description: r.description, is_system: r.is_system, permissions: r.permissions || {}
    });
    return roles;
  }

  async function allWorkspaceNames() {
    const rows = must(await sb.rpc("list_workspace_names", { p_app: APP }));
    return rows.map(r => r.name);
  }

  async function myWorkspaceNames(profile) {
    if (profile.is_superadmin) return allWorkspaceNames();
    const rows = must(await sb.from("workspace_members")
      .select("workspaces!inner(name, app)")
      .eq("user_id", profile.id)
      .eq("workspaces.app", APP));
    return rows.map(r => r.workspaces.name).sort();
  }

  async function systemDefault() {
    const { data } = await sb.from("app_settings").select("default_workspace").eq("app", APP).maybeSingle();
    return data ? data.default_workspace : "default";
  }

  async function myRoleKey(profile) {
    if (profile.is_superadmin) return "superadmin";
    const { data } = await sb.from("app_members").select("role").eq("app", APP).eq("user_id", profile.id).maybeSingle();
    return data ? data.role : "editor";
  }

  async function workspaceByName(name) {
    const { data, error } = await sb.from("workspaces").select("*").eq("app", APP).eq("name", name).maybeSingle();
    if (error) throw error;
    return data;
  }

  function normalizeDbName(s) {
    return String(s || "").trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, "_").replace(/[^a-z0-9_\-]/g, "").slice(0, 60);
  }

  // Felhasználónév → profil (az admin felületek felhasználónévvel hivatkoznak)
  let adminProfiles = [];
  async function profileByUsername(username) {
    let p = adminProfiles.find(x => x.username === username);
    if (!p) {
      const { data } = await sb.from("profiles").select("*").eq("username", username).maybeSingle();
      p = data;
    }
    return p;
  }

  let lastDb = null;       // a legutóbb betöltött munkatér (a concert feladat-pipáláshoz)

  // ---------------------------------------------------------------- végpontok
  const routes = {
    // ---------- AUTH
    "GET /api/auth/check": async () => {
      const p = await myProfile(true);
      if (!p || p.status !== "approved") {
        // A bejelentkezés a portálon történik
        location.replace(PORTAL_URL + "?next=" + encodeURIComponent(APP || ""));
        return ok({ authenticated: false, username: null });
      }
      return ok({ authenticated: true, username: p.username });
    },

    "POST /api/auth/logout": async () => {
      await sb.auth.signOut();
      profileCache = null;
      return ok();
    },

    // A régi login/regisztráció/jelszó-visszaállítás űrlapok helyett a portál van
    "POST /api/auth/login": async () => { location.href = PORTAL_URL; return fail(400, "Jelentkezz be a portálon!"); },
    "POST /api/auth/register": async () => { location.href = PORTAL_URL + "#register"; return fail(400, "Regisztrálj a portálon!"); },
    "POST /api/auth/forgot-password": async () => { location.href = PORTAL_URL + "#forgot"; return ok({ message: "Átirányítás a portálra..." }); },
    "POST /api/auth/reset-password": async () => { location.href = PORTAL_URL; return fail(400, "Használd a portált!"); },

    // ---------- FELHASZNÁLÓ
    "GET /api/user/info": async () => {
      const p = await myProfile(true);
      if (!p) return fail(401, "Nincs bejelentkezve");
      const [roles, roleKey, dbs, all, sysDefault, prefRow] = await Promise.all([
        appRoles(), myRoleKey(p), myWorkspaceNames(p), allWorkspaceNames(), systemDefault(),
        sb.from("user_prefs").select("preferred_workspace").eq("user_id", p.id).eq("app", APP).maybeSingle()
      ]);
      const role = roles[roleKey] || { name: roleKey, permissions: {} };
      return ok({
        username: p.username,
        display_name: p.display_name || p.username,
        email: p.email || "",
        is_superadmin: !!p.is_superadmin,
        role: roleKey,
        role_name: role.name,
        permissions: role.permissions,
        databases: dbs,
        all_databases: all,
        preferred_db: (prefRow.data && prefRow.data.preferred_workspace) || sysDefault,
        system_default_db: sysDefault
      });
    },

    "POST /api/user/update-profile": async (b) => {
      const p = await myProfile(true);
      const newUsername = String(b.new_username || "").trim();
      const display = String(b.display_name || "").trim();
      const email = String(b.email || "").trim().toLowerCase();
      if (!newUsername) return fail(400, "A felhasználónév nem lehet üres!");
      must(await sb.from("profiles").update({ username: newUsername, display_name: display || newUsername }).eq("id", p.id));
      let message = "Profil adatok sikeresen frissítve!";
      if (email && email !== (p.email || "")) {
        const r = await sb.auth.updateUser({ email }, { emailRedirectTo: PORTAL_URL });
        if (r.error) return fail(400, errMsg(r.error));
        message += " Az új e-mail címet a kiküldött levélben erősítsd meg.";
      }
      profileCache = null;
      return ok({ status: "success", username: newUsername, display_name: display || newUsername, email, message });
    },

    "POST /api/user/save-settings": async (b) => {
      const p = await myProfile(true);
      if (b.old_password && b.new_password) {
        if (String(b.new_password).length < 8) return fail(400, "Az új jelszó legalább 8 karakter legyen!");
        const check = await sb.auth.signInWithPassword({ email: p.email, password: b.old_password });
        if (check.error) return fail(400, "A jelenlegi jelszó hibás!");
        const r = await sb.auth.updateUser({ password: b.new_password });
        if (r.error) return fail(400, errMsg(r.error));
      }
      if (b.preferred_db) {
        must(await sb.from("user_prefs").upsert({ user_id: p.id, app: APP, preferred_workspace: b.preferred_db }));
      }
      if (b.system_default_db && p.is_superadmin) {
        must(await sb.from("app_settings").upsert({ app: APP, default_workspace: b.system_default_db }));
      }
      return ok({ status: "success", message: "Beállítások sikeresen elmentve!" });
    },

    "POST /api/user/request-db": async (b) => {
      if (!b.database) return fail(400, "Válassz munkateret!");
      must(await sb.rpc("request_access", { p_app: APP, p_ws_name: b.database }));
      return ok();
    },

    // ---------- ADATOK
    "GET /api/data": async (_b, q) => {
      const name = q.get("db") || await systemDefault();
      let ws = await workspaceByName(name);
      if (!ws) {
        const p = await myProfile();
        if (p && p.is_superadmin) {
          must(await sb.rpc("create_workspace", {
            p_app: APP, p_name: normalizeDbName(name) || "default",
            p_title: name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), p_subtitle: DEFAULT_SUBTITLES[APP] || ""
          }));
          ws = await workspaceByName(normalizeDbName(name));
        }
        if (!ws) return fail(403, "Nincs hozzáférésed ehhez a munkatérhez!");
      }
      lastDb = ws.name;
      return ok(Object.assign({}, ws.data || {}, { title: ws.title, subtitle: ws.subtitle || "" }));
    },

    "POST /api/data": async (b, q) => {
      const name = q.get("db") || lastDb;
      const doc = Object.assign({}, b);
      const title = doc.title || name;
      const subtitle = doc.subtitle || "";
      delete doc.title; delete doc.subtitle;

      // concert: a feladatok kapjanak stabil azonosítót (a gyors pipáláshoz)
      if (APP === "concert" && Array.isArray(doc.concerts)) {
        let max = 0;
        doc.concerts.forEach(c => (c.tasks || []).forEach(t => { if (Number(t.id) > max) max = Number(t.id); }));
        doc.concerts.forEach(c => (c.tasks || []).forEach(t => { if (!t.id) t.id = ++max; }));
      }

      const res = await sb.from("workspaces").update({ title, subtitle, data: doc })
        .eq("app", APP).eq("name", name).select("id");
      if (res.error) return fail(403, errMsg(res.error));
      if (!res.data || res.data.length === 0) return fail(403, "Csak olvasási jogosultságod van ehhez a munkatérhez!");
      return ok();
    },

    // concert: feladat gyors pipálása
    "POST /api/task/toggle": async (b) => {
      if (APP !== "concert" || !lastDb) return fail(400, "Érvénytelen kérés");
      const ws = await workspaceByName(lastDb);
      if (!ws) return fail(403, "Nincs hozzáférésed!");
      const doc = ws.data || {};
      let found = false;
      (doc.concerts || []).forEach(c => (c.tasks || []).forEach(t => {
        if (String(t.id) === String(b.task_id)) { t.is_done = !!b.is_done; found = true; }
      }));
      if (!found) return fail(404, "A feladat nem található");
      const res = await sb.from("workspaces").update({ data: doc }).eq("id", ws.id).select("id");
      if (res.error || !res.data.length) return fail(403, "Csak olvasási jogosultságod van!");
      return ok();
    },

    // ---------- FŐADMIN
    "GET /api/admin/users": async () => {
      const me = await myProfile(true);
      if (!me || !me.is_superadmin) return fail(403, "Csak Főadminisztrátor jogosult!");
      const [profiles, members, wsMembers, requests, roles, all, sysDefault] = await Promise.all([
        sb.from("profiles").select("*").neq("status", "disabled").order("username"),
        sb.from("app_members").select("*").eq("app", APP),
        sb.from("workspace_members").select("user_id, workspaces!inner(name, app)").eq("workspaces.app", APP),
        sb.from("access_requests").select("user_id, workspaces!inner(name, app)").eq("workspaces.app", APP),
        appRoles(), allWorkspaceNames(), systemDefault()
      ]);
      adminProfiles = must(profiles);
      const roleOf = {}; must(members).forEach(m => roleOf[m.user_id] = m.role);
      const dbsOf = {}; must(wsMembers).forEach(m => (dbsOf[m.user_id] = dbsOf[m.user_id] || []).push(m.workspaces.name));
      const nameOf = {}; adminProfiles.forEach(p => nameOf[p.id] = p.username);
      return ok({
        users: adminProfiles.map(p => ({
          username: p.username,
          display_name: p.display_name || p.username,
          email: p.email || "",
          role: p.is_superadmin ? "superadmin" : (roleOf[p.id] || "editor"),
          is_superadmin: !!p.is_superadmin,
          status: p.status,
          databases: p.is_superadmin ? all : (dbsOf[p.id] || []).sort(),
          preferred_db: null
        })),
        roles,
        db_requests: must(requests).map(r => ({ username: nameOf[r.user_id] || "?", database: r.workspaces.name })),
        all_databases: all,
        system_default_db: sysDefault
      });
    },

    "POST /api/admin/users": async (b) => {
      const oldName = b.old_username || b.username;
      const target = await profileByUsername(oldName);
      if (!target) {
        return fail(400, "Új munkatársat a portálon kell regisztrálni (portál → Regisztráció). Utána itt jóváhagyhatod és beállíthatod a jogait.");
      }
      if (b.password && String(b.password).trim()) {
        return fail(400, "Más jelszavát nem lehet beállítani. A munkatárs a portálon az „Elfelejtett jelszó” gombbal tud újat kérni. (Hagyd üresen a jelszó mezőt.)");
      }
      must(await sb.rpc("admin_save_app_user", {
        p_app: APP, p_user: target.id, p_username: b.username, p_display_name: b.display_name,
        p_role: b.role || "editor", p_workspaces: b.databases || []
      }));
      return ok();
    },

    "POST /api/admin/roles": async (b) => {
      const key = String(b.key || "").trim().toLowerCase();
      if (!/^[a-z0-9_]{2,40}$/.test(key)) return fail(400, "A kulcs csak kisbetű, szám és _ lehet (2–40 karakter)!");
      if (!String(b.name || "").trim()) return fail(400, "Adj nevet a szerepkörnek!");
      must(await sb.from("app_roles").upsert({
        app: APP, key, name: String(b.name).trim(), description: String(b.description || "").trim(),
        permissions: b.permissions || {}
      }, { onConflict: "app,key" }));
      return ok({ status: "success", message: "Szerepkör frissítve!" });
    },

    "POST /api/admin/create-db": async (b) => {
      const name = normalizeDbName(b.db_name);
      if (!name) return fail(400, "Érvénytelen név!");
      must(await sb.rpc("create_workspace", {
        p_app: APP, p_name: name, p_title: String(b.db_name).trim(), p_subtitle: DEFAULT_SUBTITLES[APP] || ""
      }));
      return ok();
    },

    "POST /api/admin/approve-user": async (b) => {
      const target = await profileByUsername(b.username);
      if (!target) return fail(404, "Nincs ilyen felhasználó");
      const status = b.action === "approve" ? "approved" : "disabled";
      must(await sb.from("profiles").update({ status }).eq("id", target.id));
      return ok();
    },

    "POST /api/admin/approve-db-request": async (b) => {
      const target = await profileByUsername(b.username);
      if (!target) return fail(404, "Nincs ilyen felhasználó");
      must(await sb.rpc("decide_access_request", {
        p_app: APP, p_ws_name: b.database, p_user: target.id, p_approve: b.action === "approve"
      }));
      return ok();
    },

    // ---------- MUNKATÉR-ADMIN (nem főadmin)
    "GET /api/db-admin/requests": async () => {
      const me = await myProfile(true);
      const roles = await appRoles();
      const roleKey = await myRoleKey(me);
      const canManage = me.is_superadmin || ((roles[roleKey] || {}).permissions || {}).can_manage_dbs;
      if (!canManage) return fail(403, "Nincs jogosultságod!");
      const managed = await myWorkspaceNames(me);
      // A kérelmek közül az RLS csak azokat adja vissza, amelyeket kezelhetünk
      const reqs = must(await sb.from("access_requests")
        .select("user_id, workspaces!inner(name, app), profiles!access_requests_user_id_fkey(username)")
        .eq("workspaces.app", APP));
      reqs.forEach(r => { if (r.profiles && !adminProfiles.find(p => p.id === r.user_id)) adminProfiles.push({ id: r.user_id, username: r.profiles.username }); });
      return ok({
        db_requests: reqs.filter(r => r.user_id !== me.id).map(r => ({ username: r.profiles ? r.profiles.username : "?", database: r.workspaces.name })),
        managed_databases: managed
      });
    },

    // ---------- TÖRLÉSEK
    "DELETE /api/admin/users/": async (_b, _q, rest) => {
      const target = await profileByUsername(decodeURIComponent(rest));
      if (!target) return fail(404, "Nincs ilyen felhasználó");
      must(await sb.rpc("admin_remove_app_user", { p_app: APP, p_user: target.id }));
      return ok();
    },

    "DELETE /api/admin/databases/": async (_b, _q, rest) => {
      const name = decodeURIComponent(rest);
      if (name === await systemDefault()) return fail(400, "Az alapértelmezett munkatér nem törölhető!");
      const res = await sb.from("workspaces").delete().eq("app", APP).eq("name", name).select("id");
      if (res.error) return fail(403, errMsg(res.error));
      if (!res.data.length) return fail(403, "Csak Főadminisztrátor törölhet munkateret!");
      return ok();
    }
  };

  // ---------------------------------------------------------------- fetch elfogása
  const realFetch = window.fetch.bind(window);

  async function handle(method, url, body) {
    const path = url.pathname.replace(/^.*?(\/api\/)/, "/api/");
    let handler = routes[method + " " + path];
    let rest = "";
    if (!handler) {
      for (const key of Object.keys(routes)) {
        const [m, prefix] = key.split(" ");
        if (m === method && prefix.endsWith("/") && path.startsWith(prefix)) {
          handler = routes[key];
          rest = path.slice(prefix.length);
          break;
        }
      }
    }
    if (!handler) return fail(404, "Ismeretlen végpont: " + method + " " + path);
    try {
      return await handler(body, url.searchParams, rest);
    } catch (e) {
      console.error("[spektrum-api]", method, path, e);
      return fail(400, errMsg(e));
    }
  }

  window.fetch = async function (input, options) {
    options = options || {};
    const raw = typeof input === "string" ? input : (input && input.url) || "";
    const url = new URL(raw, location.href);
    const isApi = url.origin === location.origin && /(^|\/)api\//.test(url.pathname) && APP;
    if (!isApi) return realFetch(input, options);

    const method = String(options.method || (input && input.method) || "GET").toUpperCase();
    let body = {};
    if (options.body) {
      try { body = typeof options.body === "string" ? JSON.parse(options.body) : options.body; } catch (_) { body = {}; }
    }
    return handle(method, url, body);
  };

  // Kijelentkezés más fülön / lejárt munkamenet → vissza a portálra
  sb.auth.onAuthStateChange((event) => {
    if (APP && event === "SIGNED_OUT") location.replace(PORTAL_URL);
  });

  window.SpektrumApi = { sb, PORTAL_URL, myProfile };
})();
