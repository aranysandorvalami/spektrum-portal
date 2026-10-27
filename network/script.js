let currentDb = "default";
let userPermissions = { username: "", display_name: "", email: "", is_superadmin: false, role: "editor", role_name: "Szerkesztő", permissions: {}, databases: [], all_databases: [], preferred_db: "default", system_default_db: "default" };
let appData = { title: "Network Manager Spektrumevents", subtitle: "", blocks: [], devices: [] };
let currentSessionId = localStorage.getItem("session_id") || "";
let availableRoles = {};

/* TÉMAKEZELŐ */
function initTheme() {
    const savedTheme = localStorage.getItem("netops_theme") || "dark";
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const isLight = (theme === 'light');
    if (isLight) {
        document.body.classList.add('theme-light');
    } else {
        document.body.classList.remove('theme-light');
    }
    localStorage.setItem("netops_theme", theme);
    
    const badge = document.getElementById("activeThemeBadge");
    if (badge) badge.innerText = isLight ? "VILÁGOS" : "SÖTÉT";

    const btnDark = document.getElementById("themeBtnDark");
    const btnLight = document.getElementById("themeBtnLight");
    if (btnDark && btnLight) {
        if (isLight) {
            btnLight.className = "flex-1 py-2 px-3 rounded border font-semibold flex items-center justify-center gap-2 bg-[#0969da] text-white border-transparent";
            btnDark.className = "flex-1 py-2 px-3 rounded border font-semibold flex items-center justify-center gap-2 ui-panel border-[var(--border-color)] text-[var(--text-secondary)]";
        } else {
            btnDark.className = "flex-1 py-2 px-3 rounded border font-semibold flex items-center justify-center gap-2 bg-[#1f6feb] text-white border-transparent";
            btnLight.className = "flex-1 py-2 px-3 rounded border font-semibold flex items-center justify-center gap-2 ui-panel border-[var(--border-color)] text-[var(--text-secondary)]";
        }
    }
}

/* SIDEBAR TOGGLE */
function toggleSidebar() {
    const sidebar = document.getElementById("mainSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const isMobile = window.innerWidth < 768;

    if (isMobile) {
        const isOpen = sidebar.classList.contains("sidebar-mobile-open");
        if (isOpen) {
            sidebar.classList.remove("sidebar-mobile-open");
            backdrop.classList.add("hidden");
        } else {
            sidebar.classList.add("sidebar-mobile-open");
            backdrop.classList.remove("hidden");
        }
    } else {
        const isCollapsed = sidebar.classList.toggle("sidebar-collapsed");
        localStorage.setItem("netops_sidebar_collapsed", isCollapsed ? "1" : "0");
    }
}

function restoreSidebarState() {
    if (window.innerWidth >= 768) {
        const isCollapsed = localStorage.getItem("netops_sidebar_collapsed") === "1";
        if (isCollapsed) document.getElementById("mainSidebar").classList.add("sidebar-collapsed");
    }
}

async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (currentSessionId) {
        options.headers['Authorization'] = `Bearer ${currentSessionId}`;
    }
    return fetch(url, options);
}

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
    }
}

function toggleAuthMode(mode) {
    if (mode === 'register') {
        document.getElementById("loginForm").classList.add("hidden");
        document.getElementById("registerForm").classList.remove("hidden");
        document.getElementById("authSubtitle").innerText = "Új hozzáférési kérelem";
    } else {
        document.getElementById("registerForm").classList.add("hidden");
        document.getElementById("loginForm").classList.remove("hidden");
        document.getElementById("authSubtitle").innerText = "Rendszer hitelesítés";
    }
}

/* JELSZÓVISSZAÁLLÍTÁS TOKEN ELLENŐRZÉSE AZ URL-BEN */
function checkPasswordResetTokenInUrl() {
    const hash = window.location.hash;
    if (hash.includes('reset-token=')) {
        const token = hash.split('reset-token=')[1].split('&')[0];
        if (token) {
            document.getElementById("resetTokenValue").value = token;
            document.getElementById("resetPwModal").classList.remove("hidden");
            document.getElementById("resetPwModal").classList.add("flex");
        }
    }
}

function openForgotPwModal() {
    document.getElementById("forgotIdentifier").value = "";
    document.getElementById("forgotMsg").classList.add("hidden");
    document.getElementById("forgotPwModal").classList.remove("hidden");
    document.getElementById("forgotPwModal").classList.add("flex");
}

function closeForgotPwModal() {
    document.getElementById("forgotPwModal").classList.add("hidden");
    document.getElementById("forgotPwModal").classList.remove("flex");
}

async function handleSendForgotPassword(e) {
    e.preventDefault();
    const idVal = document.getElementById("forgotIdentifier").value.trim();
    const msgEl = document.getElementById("forgotMsg");

    try {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: idVal })
        });
        const data = await res.json();
        msgEl.className = "text-[11px] text-emerald-500 font-mono";
        msgEl.innerText = data.message || "Link elküldve!";
        msgEl.classList.remove("hidden");
    } catch (err) {
        msgEl.className = "text-[11px] text-rose-500 font-mono";
        msgEl.innerText = "Kommunikációs hiba a szerverrel!";
        msgEl.classList.remove("hidden");
    }
}

async function handleExecutePasswordReset(e) {
    e.preventDefault();
    const token = document.getElementById("resetTokenValue").value;
    const p1 = document.getElementById("resetNewPassword").value;
    const p2 = document.getElementById("resetConfirmPassword").value;
    const msgEl = document.getElementById("resetMsg");

    if (p1 !== p2) {
        msgEl.className = "text-[11px] text-rose-500 font-mono";
        msgEl.innerText = "A két új jelszó nem egyezik meg!";
        msgEl.classList.remove("hidden");
        return;
    }

    try {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_password: p1 })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message || "Jelszó sikeresen megváltoztatva! Most már bejelentkezhetsz.");
            window.location.hash = "";
            document.getElementById("resetPwModal").classList.add("hidden");
            document.getElementById("resetPwModal").classList.remove("flex");
            checkAuth();
        } else {
            msgEl.className = "text-[11px] text-rose-500 font-mono";
            msgEl.innerText = data.error || "Hiba a visszaállítás során!";
            msgEl.classList.remove("hidden");
        }
    } catch (err) {
        msgEl.className = "text-[11px] text-rose-500 font-mono";
        msgEl.innerText = "Szerver hiba!";
        msgEl.classList.remove("hidden");
    }
}

async function checkAuth() {
    try {
        const res = await authFetch('/api/auth/check');
        const data = await res.json();
        if (data.authenticated) {
            document.getElementById("loginScreen").classList.add("hidden");
            document.getElementById("appScreen").classList.remove("hidden");
            document.getElementById("appScreen").classList.add("flex");
            await loadUserInfo();
        } else {
            document.getElementById("loginScreen").classList.remove("hidden");
            document.getElementById("appScreen").classList.add("hidden");
        }
    } catch (err) {
        console.error("Auth hiba:", err);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById("loginUsername").value;
    const p = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("loginError");

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        if (res.ok) {
            if (data.session_id) {
                currentSessionId = data.session_id;
                localStorage.setItem("session_id", data.session_id);
            }
            errEl.classList.add("hidden");
            checkAuth();
        } else {
            errEl.innerText = data.error || "Sikertelen azonosítás!";
            errEl.classList.remove("hidden");
        }
    } catch (err) {
        errEl.innerText = "Hálózati hiba a szerver felé!";
        errEl.classList.remove("hidden");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const u = document.getElementById("regUsername").value;
    const disp = document.getElementById("regDisplayName").value;
    const email = document.getElementById("regEmail").value;
    const p = document.getElementById("regPassword").value;
    const msgEl = document.getElementById("regMsg");

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, display_name: disp, email: email, password: p })
        });
        const data = await res.json();
        if (res.ok) {
            msgEl.className = "text-[11px] text-emerald-500 font-mono";
            msgEl.innerText = data.message;
            msgEl.classList.remove("hidden");
        } else {
            msgEl.className = "text-[11px] text-rose-500 font-mono";
            msgEl.innerText = data.error || "Regisztrációs hiba!";
            msgEl.classList.remove("hidden");
        }
    } catch (err) {
        msgEl.className = "text-[11px] text-rose-500 font-mono";
        msgEl.innerText = "Kommunikációs hiba!";
        msgEl.classList.remove("hidden");
    }
}

async function handleLogout() {
    await authFetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem("session_id");
    window.location.reload();
}

async function loadUserInfo() {
    const res = await authFetch('/api/user/info');
    userPermissions = await res.json();

    // Profil widget frissítése a bal felső sarokban
    const displayName = userPermissions.display_name || userPermissions.username;
    document.getElementById("headerDisplayName").innerText = displayName;
    document.getElementById("headerUsername").innerText = userPermissions.username;
    document.getElementById("userAvatarLetter").innerText = displayName.charAt(0).toUpperCase();
    document.getElementById("headerRoleBadge").innerText = userPermissions.role_name || userPermissions.role.toUpperCase();

    // Jogosultságfüggő elemek
    const perms = userPermissions.permissions || {};
    const isSuper = userPermissions.is_superadmin;

    if (isSuper || perms.can_access_admin) {
        document.getElementById("superAdminBtn").classList.remove("hidden");
        document.getElementById("superAdminBtn").classList.add("flex");
    } else {
        document.getElementById("superAdminBtn").classList.add("hidden");
    }

    if (!isSuper && perms.can_manage_dbs) {
        document.getElementById("dbAdminBtn").classList.remove("hidden");
        document.getElementById("dbAdminBtn").classList.add("flex");
    } else {
        document.getElementById("dbAdminBtn").classList.add("hidden");
    }

    if (!isSuper && !perms.can_edit_devices) {
        document.getElementById("addDevBtn").style.display = 'none';
    } else {
        document.getElementById("addDevBtn").style.display = 'flex';
    }

    if (!isSuper && !perms.can_manage_blocks) {
        document.getElementById("addBlockBtn").style.display = 'none';
        document.getElementById("editTitleBtn").style.display = 'none';
    } else {
        document.getElementById("addBlockBtn").style.display = 'flex';
        document.getElementById("editTitleBtn").style.display = 'inline-block';
    }

    // DB választó feltöltése
    const dbSelect = document.getElementById("dbSelector");
    dbSelect.innerHTML = "";
    userPermissions.databases.forEach(db => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.innerText = db.replace("_", " ").toUpperCase();
        dbSelect.appendChild(opt);
    });

    if (userPermissions.preferred_db && userPermissions.databases.includes(userPermissions.preferred_db)) {
        currentDb = userPermissions.preferred_db;
    } else if (userPermissions.databases.includes(userPermissions.system_default_db)) {
        currentDb = userPermissions.system_default_db;
    } else if (userPermissions.databases.length > 0) {
        currentDb = userPermissions.databases[0];
    } else {
        currentDb = "default";
    }
    dbSelect.value = currentDb;

    loadData();
}

async function switchDatabase(dbName) {
    currentDb = dbName;
    loadData();
}

async function loadData() {
    try {
        const res = await authFetch(`/api/data?db=${currentDb}&_t=${Date.now()}`, { cache: "no-store" });
        appData = await res.json();
        if (!appData.blocks) appData.blocks = [];
        if (!appData.devices) appData.devices = [];
        render();
    } catch (err) {
        console.error("Adatbetöltési hiba:", err);
    }
}

async function saveData() {
    const perms = userPermissions.permissions || {};
    if (!userPermissions.is_superadmin && !perms.can_edit_devices) {
        alert("Nincs írási jogosultságod ebben a partícióban!");
        return;
    }

    try {
        const res = await authFetch(`/api/data?db=${currentDb}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData, null, 2)
        });
        if (!res.ok) {
            const err = await res.json();
            alert(err.error || "Mentési hiba!");
            return;
        }
        render();
    } catch (err) {
        alert("Mentési hiba a szerveren!");
    }
}

function render() {
    document.getElementById("appTitleDisplay").innerText = (appData.title || "Network Manager Spektrumevents");
    document.getElementById("appSubtitleDisplay").innerText = appData.subtitle || "Spektrum Ops";

    const search = document.getElementById("searchInput").value.toLowerCase();
    const deptF = document.getElementById("deptFilter").value;
    const statusF = document.getElementById("statusFilter").value;
    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_devices;
    const canDelete = userPermissions.is_superadmin || perms.can_delete_devices;
    const canBlocks = userPermissions.is_superadmin || perms.can_manage_blocks;

    const filteredDevs = appData.devices.filter(d => {
        const matchSearch = d.name.toLowerCase().includes(search) || d.ip.includes(search) || (d.mac && d.mac.toLowerCase().includes(search));
        const matchDept = !deptF || d.dept === deptF;
        const matchStatus = !statusF || d.status === statusF;
        return matchSearch && matchDept && matchStatus;
    });

    document.getElementById("statTotal").innerText = appData.devices.length;
    document.getElementById("statActive").innerText = appData.devices.filter(d => d.status === 'active').length;
    
    const depts = [...new Set(appData.blocks.map(b => b.dept).concat(appData.devices.map(d => d.dept)))].filter(Boolean);
    document.getElementById("statDepts").innerText = depts.length;
    document.getElementById("statBlocks").innerText = appData.blocks.length;

    const deptFilterSelect = document.getElementById("deptFilter");
    const prevDeptFilter = deptFilterSelect.value;
    deptFilterSelect.innerHTML = `<option value="">Összes zóna / részleg</option>`;
    depts.forEach(dept => {
        const opt = document.createElement("option");
        opt.value = dept;
        opt.innerText = dept;
        if (dept === prevDeptFilter) opt.selected = true;
        deptFilterSelect.appendChild(opt);
    });

    const contentArea = document.getElementById("contentArea");
    contentArea.innerHTML = "";

    const blocks = [...appData.blocks];
    blocks.push({ id: "unassigned", cidr: "Besorolatlan zóna", dept: "Egyéb", label: "CIDR Blokkon kívüli hostok" });

    blocks.forEach(block => {
        let blockDevs = [];
        if (block.id === 'unassigned') {
            blockDevs = filteredDevs.filter(d => !d.block_id || !appData.blocks.some(b => b.id === d.block_id));
        } else {
            blockDevs = filteredDevs.filter(d => d.block_id === block.id);
        }

        if (block.id === 'unassigned' && blockDevs.length === 0) return;
        if (deptF && block.dept !== deptF && blockDevs.length === 0) return;

        const blockCard = document.createElement("div");
        blockCard.className = "ui-panel border rounded-md overflow-hidden shadow-sm";

        let rowsHTML = "";
        if (blockDevs.length === 0) {
            rowsHTML = `<tr><td colspan="6" class="p-3 text-center text-[var(--text-muted)] font-mono text-[11px]">Nincs konfigurált host ebben az alhálózatban.</td></tr>`;
        } else {
            blockDevs.forEach(d => {
                const isActive = d.status === 'active';
                rowsHTML += `
                    <tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition">
                        <td class="px-3 py-1.5 w-8">
                            <span class="inline-block w-2 h-2 rounded-full ${esc(isActive ? 'bg-emerald-500' : 'bg-slate-500')}" title="${esc(isActive ? 'Online' : 'Offline')}"></span>
                        </td>
                        <td class="px-3 py-1.5 font-semibold text-[var(--text-primary)] whitespace-nowrap">${esc(d.name)}</td>
                        <td class="px-3 py-1.5 font-mono text-[var(--text-primary)] whitespace-nowrap font-bold">${esc(d.ip)}</td>
                        <td class="px-3 py-1.5 font-mono text-[var(--text-secondary)] text-[11px] whitespace-nowrap">${(d.mac) ? esc(d.mac) : '<span class="text-[var(--text-muted)]">—</span>'}</td>
                        <td class="px-3 py-1.5 text-[var(--text-secondary)] max-w-xs truncate text-[11px] font-mono">${(d.notes) ? esc(d.notes) : '<span class="text-[var(--text-muted)]">—</span>'}</td>
                        <td class="px-3 py-1.5 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-2">
                                ${d.image ? `<button onclick="openImageViewer(${jsq(d.image)})" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Fotó"><i class="fa-solid fa-image"></i></button>` : ''}
                                <button onclick="openPrintModalForDevice(${jsq(d.id)})" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Címke nyomtatása"><i class="fa-solid fa-print"></i></button>
                                ${canEdit ? `<button onclick="openAddModal(${jsq(d.id)})" class="text-[var(--text-muted)] hover:text-blue-500" title="Szerkesztés"><i class="fa-solid fa-pen"></i></button>` : ''}
                                ${canDelete ? `<button onclick="deleteDevice(${jsq(d.id)})" class="text-[var(--text-muted)] hover:text-rose-500" title="Törlés"><i class="fa-solid fa-trash"></i></button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            });
        }

        blockCard.innerHTML = `
            <div class="px-3 py-2 ui-subtle border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 font-mono">
                    <span class="font-bold text-[var(--text-primary)] text-xs">${esc(block.cidr)}</span>
                    <span class="text-[var(--text-muted)]">|</span>
                    <span class="text-[var(--text-secondary)] text-[11px] font-sans">${esc(block.label || 'Nincs címke')}</span>
                    <span class="px-1.5 py-0.2 rounded ui-panel border border-[var(--border-color)] text-[var(--text-primary)] text-[10px] uppercase font-sans">${esc(block.dept)}</span>
                    <span class="text-[var(--text-muted)] text-[10px]">(${esc(blockDevs.length)} host)</span>
                </div>
                ${block.id !== 'unassigned' && canBlocks ? `
                    <button onclick="deleteBlock(${jsq(block.id)})" class="text-[11px] text-[var(--text-muted)] hover:text-rose-500 flex items-center gap-1">
                        <i class="fa-solid fa-trash text-[10px]"></i> Törlés
                    </button>` : ''}
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ui-panel">
                            <th class="px-3 py-1.5 w-8">Állapot</th>
                            <th class="px-3 py-1.5">Hosztnév</th>
                            <th class="px-3 py-1.5">IPv4 Cím</th>
                            <th class="px-3 py-1.5">MAC Cím</th>
                            <th class="px-3 py-1.5">Műszaki Megjegyzés</th>
                            <th class="px-3 py-1.5 text-right">Művelet</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
            </div>
        `;
        contentArea.appendChild(blockCard);
    });
}

/* MODULÁRIS FIÓKBEÁLLÍTÁSOK MENÜ */
function switchProfileTab(tab) {
    document.getElementById("profTabGeneral").classList.add("hidden");
    document.getElementById("profTabSecurity").classList.add("hidden");
    document.getElementById("profTabSessions").classList.add("hidden");

    const defClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-hover)] flex items-center gap-2";
    const actClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-white bg-[#1f6feb] flex items-center gap-2";

    document.getElementById("profTabBtnGeneral").className = defClass;
    document.getElementById("profTabBtnSecurity").className = defClass;
    document.getElementById("profTabBtnSessions").className = defClass;

    if (tab === 'general') {
        document.getElementById("profTabGeneral").classList.remove("hidden");
        document.getElementById("profTabBtnGeneral").className = actClass;
    } else if (tab === 'security') {
        document.getElementById("profTabSecurity").classList.remove("hidden");
        document.getElementById("profTabBtnSecurity").className = actClass;
    } else if (tab === 'sessions') {
        document.getElementById("profTabSessions").classList.remove("hidden");
        document.getElementById("profTabBtnSessions").className = actClass;
    }
}

function openProfileModal() {
    document.getElementById("profInputDisplayName").value = userPermissions.display_name || userPermissions.username;
    document.getElementById("profInputEmail").value = userPermissions.email || "";
    document.getElementById("profInputUsername").value = userPermissions.username;
    document.getElementById("profDetailRole").innerText = userPermissions.role_name || userPermissions.role.toUpperCase();
    document.getElementById("profDetailDbs").innerText = userPermissions.databases.join(", ") || "Nincs";

    document.getElementById("profOldPassword").value = "";
    document.getElementById("profNewPassword").value = "";

    switchProfileTab('general');
    document.getElementById("profileModal").classList.remove("hidden");
    document.getElementById("profileModal").classList.add("flex");
}

function closeProfileModal() {
    document.getElementById("profileModal").classList.add("hidden");
    document.getElementById("profileModal").classList.remove("flex");
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    const newName = document.getElementById("profInputUsername").value.trim();
    const newDisplay = document.getElementById("profInputDisplayName").value.trim();
    const newEmail = document.getElementById("profInputEmail").value.trim();
    if (!newName) return;

    const res = await authFetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_username: newName, display_name: newDisplay, email: newEmail })
    });
    const data = await res.json();
    if (res.ok) {
        alert(data.message || "Profil adatok mentve!");
        await loadUserInfo();
    } else {
        alert(data.error || "Hiba a módosításkor!");
    }
}

async function handleProfilePasswordChange(e) {
    e.preventDefault();
    const old_pw = document.getElementById("profOldPassword").value;
    const new_pw = document.getElementById("profNewPassword").value;

    const res = await authFetch('/api/user/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: old_pw, new_password: new_pw })
    });
    const data = await res.json();
    if (res.ok) {
        alert("Jelszavad sikeresen megváltoztatva!");
        document.getElementById("profOldPassword").value = "";
        document.getElementById("profNewPassword").value = "";
        switchProfileTab('general');
    } else {
        alert(data.error || "Hiba a jelszó módosításakor!");
    }
}

/* RENDSZER BEÁLLÍTÁSOK */
function openSettingsModal() {
    const myDbSel = document.getElementById("setMyPreferredDb");
    myDbSel.innerHTML = "";
    userPermissions.databases.forEach(db => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.innerText = db.replace("_", " ").toUpperCase();
        if (db === userPermissions.preferred_db) opt.selected = true;
        myDbSel.appendChild(opt);
    });

    if (userPermissions.is_superadmin) {
        document.getElementById("globalDefaultDbContainer").classList.remove("hidden");
        const globSel = document.getElementById("setGlobalDefaultDb");
        globSel.innerHTML = "";
        userPermissions.all_databases.forEach(db => {
            const opt = document.createElement("option");
            opt.value = db;
            opt.innerText = db.replace("_", " ").toUpperCase();
            if (db === userPermissions.system_default_db) opt.selected = true;
            globSel.appendChild(opt);
        });
    } else {
        document.getElementById("globalDefaultDbContainer").classList.add("hidden");
    }

    const currentTheme = localStorage.getItem("netops_theme") || "dark";
    applyTheme(currentTheme);

    document.getElementById("settingsModal").classList.remove("hidden");
    document.getElementById("settingsModal").classList.add("flex");
}

function closeSettingsModal() {
    document.getElementById("settingsModal").classList.add("hidden");
    document.getElementById("settingsModal").classList.remove("flex");
}

async function handleSaveSettings(e) {
    e.preventDefault();
    const payload = {
        preferred_db: document.getElementById("setMyPreferredDb").value
    };

    if (userPermissions.is_superadmin) {
        payload.system_default_db = document.getElementById("setGlobalDefaultDb").value;
    }

    const res = await authFetch('/api/user/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
        alert("Beállítások mentve!");
        closeSettingsModal();
        await loadUserInfo();
    } else {
        alert(data.error || "Hiba a mentéskor!");
    }
}

/* FŐADMINISZTRÁCIÓ & SZEREPKÖRÖK */
function switchAdminTab(tab) {
    document.getElementById("adminTabUsers").classList.add("hidden");
    document.getElementById("adminTabRoles").classList.add("hidden");
    document.getElementById("adminTabDatabases").classList.add("hidden");
    document.getElementById("adminTabRequests").classList.add("hidden");

    const defClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-hover)] flex items-center gap-2";
    const actClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-white bg-[#1f6feb] flex items-center gap-2";

    document.getElementById("tabBtnUsers").className = defClass;
    document.getElementById("tabBtnRoles").className = defClass;
    document.getElementById("tabBtnDatabases").className = defClass;
    document.getElementById("tabBtnRequests").className = defClass;

    if (tab === 'users') {
        document.getElementById("adminTabUsers").classList.remove("hidden");
        document.getElementById("tabBtnUsers").className = actClass;
    } else if (tab === 'roles') {
        document.getElementById("adminTabRoles").classList.remove("hidden");
        document.getElementById("tabBtnRoles").className = actClass;
    } else if (tab === 'databases') {
        document.getElementById("adminTabDatabases").classList.remove("hidden");
        document.getElementById("tabBtnDatabases").className = actClass;
    } else if (tab === 'requests') {
        document.getElementById("adminTabRequests").classList.remove("hidden");
        document.getElementById("tabBtnRequests").className = actClass;
    }
}

async function openUserAdminModal() {
    if (!userPermissions.is_superadmin) {
        alert("Kizárólag Főadminisztrátor nyithatja meg!");
        return;
    }
    await renderAdminData();
    resetUserForm();
    resetRoleForm();
    switchAdminTab('users');
    document.getElementById("userAdminModal").classList.remove("hidden");
    document.getElementById("userAdminModal").classList.add("flex");
}

function closeUserAdminModal() {
    document.getElementById("userAdminModal").classList.add("hidden");
    document.getElementById("userAdminModal").classList.remove("flex");
}

async function renderAdminData() {
    const res = await authFetch('/api/admin/users');
    if (!res.ok) return;
    const data = await res.json();
    availableRoles = data.roles || {};

    // Szerepkör választó betöltése a felhasználó szerkesztőbe
    const roleSelect = document.getElementById("newRole");
    roleSelect.innerHTML = "";
    Object.keys(availableRoles).forEach(rKey => {
        const r = availableRoles[rKey];
        const opt = document.createElement("option");
        opt.value = rKey;
        opt.innerText = `${r.name} (${rKey})`;
        roleSelect.appendChild(opt);
    });

    // Szerepkörök listája (RBAC TAB)
    const roleContainer = document.getElementById("roleListContainer");
    roleContainer.innerHTML = "";
    Object.keys(availableRoles).forEach(rKey => {
        const r = availableRoles[rKey];
        const card = document.createElement("div");
        card.className = "flex items-center justify-between p-2.5 ui-panel border border-[var(--border-color)] rounded text-xs";
        
        const permsArr = [];
        if (r.permissions.can_edit_devices) permsArr.push("Szerkesztés");
        if (r.permissions.can_delete_devices) permsArr.push("Törlés");
        if (r.permissions.can_manage_blocks) permsArr.push("Blokkok");
        if (r.permissions.can_manage_dbs) permsArr.push("DB Admin");
        if (r.permissions.can_access_admin) permsArr.push("Főadmin");

        card.innerHTML = `
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-[var(--text-primary)]">${esc(r.name)}</span>
                    <span class="font-mono text-[10px] text-amber-500 uppercase px-1 rounded ui-subtle border border-[var(--border-color)]">${esc(rKey)}</span>
                    ${r.is_system ? '<span class="text-[9px] text-[var(--text-muted)] font-mono">[Rendszer]</span>' : ''}
                </div>
                <div class="text-[10px] text-[var(--text-muted)] mt-0.5">${esc(r.description || 'Nincs leírás')}</div>
                <div class="text-[10px] text-[var(--text-secondary)] font-mono mt-1">Jogok: ${esc(permsArr.join(", ") || 'Nincs külön jog')}</div>
            </div>
            <div>
                <button onclick="editRole(${jsq(rKey)})" class="px-2 py-1 rounded ui-subtle border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <i class="fa-solid fa-pen"></i> Konfigurálás
                </button>
            </div>
        `;
        roleContainer.appendChild(card);
    });

    // Partíciók listája
    const dbContainer = document.getElementById("dbListContainer");
    dbContainer.innerHTML = "";
    (data.all_databases || []).forEach(db => {
        const item = document.createElement("div");
        item.className = "flex items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs";
        item.innerHTML = `
            <span class="font-mono text-[var(--text-primary)]"><i class="fa-solid fa-database mr-2 text-[var(--text-muted)]"></i>${esc(db.toUpperCase())}</span>
            <div class="flex items-center gap-2">
                <button onclick="switchDatabase(${jsq(db)}); closeUserAdminModal();" class="text-xs text-blue-500 hover:underline">Megnyitás</button>
                ${db !== 'default' ? `<button onclick="deleteDatabase(${jsq(db)})" class="text-[var(--text-muted)] hover:text-rose-500 ml-2"><i class="fa-solid fa-trash"></i></button>` : '<span class="text-[10px] text-[var(--text-muted)] font-mono ml-2">[Alapértelmezett]</span>'}
            </div>
        `;
        dbContainer.appendChild(item);
    });

    // Függő regisztrációk
    const pContainer = document.getElementById("pendingUsersContainer");
    pContainer.innerHTML = "";
    const pendingUsers = data.users.filter(u => u.status === 'pending');
    if (pendingUsers.length === 0) {
        document.getElementById("pendingUsersSection").classList.add("hidden");
    } else {
        document.getElementById("pendingUsersSection").classList.remove("hidden");
        pendingUsers.forEach(u => {
            const card = document.createElement("div");
            card.className = "flex items-center justify-between p-2 ui-panel border border-amber-500/30 rounded text-xs";
            card.innerHTML = `
                <div class="space-y-0.5">
                    <div class="font-semibold text-[var(--text-primary)]"><i class="fa-solid fa-user-clock text-amber-500 mr-2"></i>${esc(u.display_name || u.username)}</div>
                    <div class="text-[10px] text-[var(--text-muted)] font-mono">${esc(u.username)} &bull; ${esc(u.email || 'Nincs e-mail')}</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="approveUser(${jsq(u.username)}, 'approve')" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Jóváhagyás</button>
                    <button onclick="approveUser(${jsq(u.username)}, 'reject')" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasítás</button>
                </div>
            `;
            pContainer.appendChild(card);
        });
    }

    // Kérelmek
    const reqContainer = document.getElementById("dbRequestsContainer");
    reqContainer.innerHTML = "";
    if ((data.db_requests || []).length === 0) {
        reqContainer.innerHTML = `<p class="text-xs text-[var(--text-muted)] font-mono italic">Nincs elbírálásra váró kérelem.</p>`;
    } else {
        data.db_requests.forEach(r => {
            const card = document.createElement("div");
            card.className = "flex items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs";
            card.innerHTML = `
                <div>
                    <span class="font-medium text-[var(--text-primary)]">${esc(r.username)}</span> &rarr; <span class="text-[var(--text-secondary)] font-mono">${esc(r.database.toUpperCase())}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="approveDbRequest(${jsq(r.username)}, ${jsq(r.database)}, 'approve')" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Elfogad</button>
                    <button onclick="approveDbRequest(${jsq(r.username)}, ${jsq(r.database)}, 'reject')" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasít</button>
                </div>
            `;
            reqContainer.appendChild(card);
        });
    }

    // Meglévő felhasználók
    const uContainer = document.getElementById("userListContainer");
    uContainer.innerHTML = "";
    data.users.filter(u => u.status !== 'pending').forEach(u => {
        const card = document.createElement("div");
        card.className = "flex flex-wrap items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs gap-2";
        
        const rDef = availableRoles[u.role] || { name: u.role };
        let roleBadge = `<span class="ui-subtle text-[var(--text-secondary)] border border-[var(--border-color)] px-1.5 py-0.5 rounded font-mono text-[10px] uppercase">${esc(rDef.name)}</span>`;
        if (u.is_superadmin || u.role === 'superadmin') {
            roleBadge = `<span class="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold">SUPERADMIN</span>`;
        }

        card.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-user text-[var(--text-muted)]"></i>
                <div>
                    <span class="font-medium text-[var(--text-primary)]">${esc(u.display_name || u.username)}</span>
                    <span class="text-[10px] font-mono text-[var(--text-muted)]">(${esc(u.username)})</span>
                    ${u.email ? `<span class="text-[10px] font-mono text-[var(--text-secondary)] ml-1">&lt;${esc(u.email)}&gt;</span>` : ''}
                </div>
                ${roleBadge}
            </div>
            <div class="text-[var(--text-secondary)] font-mono text-[11px]">
                Partíciók: <span class="font-semibold text-[var(--text-primary)]">${esc(u.databases.join(", ") || "Nincs")}</span>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="editUser(${jsq(u.username)}, ${jsq(u.display_name || '')}, ${jsq(u.email || '')}, ${jsq(u.role)}, ${jsq(u.databases.join(","))})" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><i class="fa-solid fa-pen"></i></button>
                ${userPermissions.is_superadmin && !u.is_superadmin ? `<button onclick="deleteUser(${jsq(u.username)})" class="text-[var(--text-muted)] hover:text-rose-500 ml-1"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        `;
        uContainer.appendChild(card);
    });

    // DB hozzárendelő lista a szerkesztőben
    const dbSel = document.getElementById("newDbSelect");
    dbSel.innerHTML = "";
    (data.all_databases || []).forEach(db => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.innerText = db.replace("_", " ").toUpperCase();
        opt.className = "py-1 px-2 hover:bg-[var(--panel-hover)] cursor-pointer";
        dbSel.appendChild(opt);
    });
}

/* SZEREPKÖR SZERKESZTÉS LOGIKA */
function editRole(rKey) {
    const r = availableRoles[rKey];
    if (!r) return;

    document.getElementById("roleKeyInput").value = rKey;
    document.getElementById("roleKeyInput").readOnly = true;
    document.getElementById("roleNameInput").value = r.name || '';
    document.getElementById("roleDescInput").value = r.description || '';

    const perms = r.permissions || {};
    document.getElementById("permEditDevs").checked = !!perms.can_edit_devices;
    document.getElementById("permDeleteDevs").checked = !!perms.can_delete_devices;
    document.getElementById("permManageBlocks").checked = !!perms.can_manage_blocks;
    document.getElementById("permManageDbs").checked = !!perms.can_manage_dbs;
    document.getElementById("permAccessAdmin").checked = !!perms.can_access_admin;

    document.getElementById("roleFormTitle").innerText = `Szerepkör Szerkesztése: ${r.name}`;
}

function resetRoleForm() {
    document.getElementById("roleKeyInput").value = "";
    document.getElementById("roleKeyInput").readOnly = false;
    document.getElementById("roleNameInput").value = "";
    document.getElementById("roleDescInput").value = "";
    document.getElementById("permEditDevs").checked = true;
    document.getElementById("permDeleteDevs").checked = false;
    document.getElementById("permManageBlocks").checked = false;
    document.getElementById("permManageDbs").checked = false;
    document.getElementById("permAccessAdmin").checked = false;
    document.getElementById("roleFormTitle").innerText = "Új Szerepkör Létrehozása";
}

async function handleSaveRole(e) {
    e.preventDefault();
    const key = document.getElementById("roleKeyInput").value.trim().toLowerCase();
    const name = document.getElementById("roleNameInput").value.trim();
    const desc = document.getElementById("roleDescInput").value.trim();

    const permissions = {
        can_edit_devices: document.getElementById("permEditDevs").checked,
        can_delete_devices: document.getElementById("permDeleteDevs").checked,
        can_manage_blocks: document.getElementById("permManageBlocks").checked,
        can_manage_dbs: document.getElementById("permManageDbs").checked,
        can_access_admin: document.getElementById("permAccessAdmin").checked
    };

    const res = await authFetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, name, description: desc, permissions })
    });

    const data = await res.json();
    if (res.ok) {
        alert(data.message || "Szerepkör frissítve!");
        await renderAdminData();
        resetRoleForm();
    } else {
        alert(data.error || "Hiba a szerepkör mentésekor!");
    }
}

/* DB ADMIN MODAL */
async function openDbAdminModal() {
    const res = await authFetch('/api/db-admin/requests');
    if (!res.ok) {
        alert("Nincs DB Admin jogosultságod!");
        return;
    }
    const data = await res.json();
    document.getElementById("dbAdminManagedList").innerText = data.managed_databases.join(", ").toUpperCase() || "Nincs felügyelt DB";

    const reqContainer = document.getElementById("dbAdminRequestsContainer");
    reqContainer.innerHTML = "";
    if (data.db_requests.length === 0) {
        reqContainer.innerHTML = `<p class="text-xs text-[var(--text-muted)] font-mono italic">Nincs elbírálásra váró kérelem a te partícióidhoz.</p>`;
    } else {
        data.db_requests.forEach(r => {
            const card = document.createElement("div");
            card.className = "flex items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs";
            card.innerHTML = `
                <div>
                    <span class="font-medium text-[var(--text-primary)]">${esc(r.username)}</span> &rarr; <span class="text-[var(--text-secondary)] font-mono">${esc(r.database.toUpperCase())}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="approveDbRequest(${jsq(r.username)}, ${jsq(r.database)}, 'approve'); openDbAdminModal();" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Elfogad</button>
                    <button onclick="approveDbRequest(${jsq(r.username)}, ${jsq(r.database)}, 'reject'); openDbAdminModal();" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasít</button>
                </div>
            `;
            reqContainer.appendChild(card);
        });
    }

    document.getElementById("dbAdminModal").classList.remove("hidden");
    document.getElementById("dbAdminModal").classList.add("flex");
}

function closeDbAdminModal() {
    document.getElementById("dbAdminModal").classList.add("hidden");
    document.getElementById("dbAdminModal").classList.remove("flex");
}

async function approveUser(username, action) {
    await authFetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, action })
    });
    renderAdminData();
}

async function approveDbRequest(username, database, action) {
    await authFetch('/api/admin/approve-db-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, database, action })
    });
    if (userPermissions.is_superadmin) renderAdminData();
}

async function handleCreateDb(e) {
    e.preventDefault();
    const name = document.getElementById("newDbNameInput").value;
    const res = await authFetch('/api/admin/create-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_name: name })
    });
    if (res.ok) {
        document.getElementById("newDbNameInput").value = "";
        alert(`Adatbázis partíció (${name}) létrehozva!`);
        await loadUserInfo();
        renderAdminData();
    } else {
        const err = await res.json();
        alert(err.error || "Hiba az adatbázis létrehozásakor!");
    }
}

async function deleteDatabase(dbName) {
    if (confirm(`BIZTOSAN TÖRÖLNI KÍVÁNOD A(Z) [${dbName.toUpperCase()}] PARTÍCIÓT? Minden adat véglegesen elveszik!`)) {
        const res = await authFetch(`/api/admin/databases/${dbName}`, { method: 'DELETE' });
        if (res.ok) {
            alert(`Partíció (${dbName}) törölve!`);
            await loadUserInfo();
            renderAdminData();
        } else {
            const err = await res.json();
            alert(err.error || "Hiba a törléskor!");
        }
    }
}

function editUser(uName, dName, email, role, dbsStr) {
    const uInput = document.getElementById("newUsername");
    uInput.value = uName;
    uInput.dataset.oldUsername = uName;
    document.getElementById("newDisplayName").value = dName || uName;
    document.getElementById("newEmail").value = email || '';
    document.getElementById("newPassword").value = "";
    document.getElementById("newRole").value = role;

    const dbs = dbsStr ? dbsStr.split(',') : [];
    const select = document.getElementById("newDbSelect");
    Array.from(select.options).forEach(opt => opt.selected = dbs.includes(opt.value));

    document.getElementById("userFormTitle").innerHTML = `Munkatárs Szerkesztése: <span class="font-mono text-[var(--text-primary)]">${esc(dName || uName)}</span>`;
}

function resetUserForm() {
    const uInput = document.getElementById("newUsername");
    uInput.value = "";
    delete uInput.dataset.oldUsername;
    document.getElementById("newDisplayName").value = "";
    document.getElementById("newEmail").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("newRole").value = "editor";
    const select = document.getElementById("newDbSelect");
    Array.from(select.options).forEach(opt => opt.selected = false);
    document.getElementById("userFormTitle").innerHTML = `Munkatárs Rögzítése / Módosítása`;
}

async function handleSaveUser(e) {
    e.preventDefault();
    const uInput = document.getElementById("newUsername");
    const u = uInput.value.trim();
    const oldU = uInput.dataset.oldUsername || u;
    const dispName = document.getElementById("newDisplayName").value.trim() || u;
    const email = document.getElementById("newEmail").value.trim().toLowerCase();
    const p = document.getElementById("newPassword").value;
    const r = document.getElementById("newRole").value;
    const select = document.getElementById("newDbSelect");
    const selectedDbs = Array.from(select.selectedOptions).map(opt => opt.value);

    const res = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_username: oldU, username: u, display_name: dispName, email: email, password: p, role: r, databases: selectedDbs })
    });

    if (res.ok) {
        await renderAdminData();
        resetUserForm();
        alert(`Kolléga (${dispName}) adatai mentve!`);
    } else {
        const err = await res.json();
        alert(err.error || "Hiba a mentés során!");
    }
}

async function deleteUser(uName) {
    if (confirm(`Biztosan törlöd "${uName}" fiókját?`)) {
        await authFetch(`/api/admin/users/${uName}`, { method: 'DELETE' });
        renderAdminData();
    }
}

/* IGÉNYLŐ MODAL */
function openRequestDbModal() {
    const select = document.getElementById("availableDbSelect");
    select.innerHTML = "";
    userPermissions.all_databases.forEach(db => {
        if (!userPermissions.databases.includes(db)) {
            const opt = document.createElement("option");
            opt.value = db;
            opt.innerText = db.toUpperCase();
            select.appendChild(opt);
        }
    });

    if (select.options.length === 0) {
        alert("Minden meglévő partícióhoz rendelkezel hozzáféréssel!");
        return;
    }

    document.getElementById("requestDbModal").classList.remove("hidden");
    document.getElementById("requestDbModal").classList.add("flex");
}
function closeRequestDbModal() { document.getElementById("requestDbModal").classList.add("hidden"); document.getElementById("requestDbModal").classList.remove("flex"); }

async function handleSendDbRequest(e) {
    e.preventDefault();
    const db = document.getElementById("availableDbSelect").value;
    const res = await authFetch('/api/user/request-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database: db })
    });

    if (res.ok) {
        alert(`Kérelem leadva a(z) [${db.toUpperCase()}] partícióra!`);
        closeRequestDbModal();
    }
}

/* ESZKÖZ ÉS BLOKK KEZELÉS */
function populateDeviceBlockDropdown(selectedBlockId = "") {
    const select = document.getElementById("devBlockSelect");
    select.innerHTML = "";

    if (appData.blocks.length === 0) {
        const opt = document.createElement("option");
        opt.value = "__NEW__";
        opt.innerText = "+ Új Blokk és Zóna megadása...";
        select.appendChild(opt);
    } else {
        appData.blocks.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.innerText = `${b.cidr} - ${b.dept} (${b.label || 'Nincs címke'})`;
            if (b.id === selectedBlockId) opt.selected = true;
            select.appendChild(opt);
        });

        const newOpt = document.createElement("option");
        newOpt.value = "__NEW__";
        newOpt.innerText = "+ Új Blokk és Zóna megadása...";
        newOpt.className = "text-amber-500 font-bold";
        select.appendChild(newOpt);
    }
    handleBlockSelectChange(select.value);
}

function handleBlockSelectChange(val) {
    const newBlockFields = document.getElementById("newBlockFields");
    if (val === "__NEW__") newBlockFields.classList.remove("hidden");
    else newBlockFields.classList.add("hidden");
}

function previewDeviceImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById("devImageData").value = e.target.result;
            document.getElementById("imagePreview").src = e.target.result;
            document.getElementById("imagePreviewContainer").classList.remove("hidden");
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function removeDeviceImage() {
    document.getElementById("devImageInput").value = "";
    document.getElementById("devImageData").value = "";
    document.getElementById("imagePreview").src = "";
    document.getElementById("imagePreviewContainer").classList.add("hidden");
}

function openAddModal(id = null) {
    document.getElementById("deviceForm").reset();
    document.getElementById("deviceId").value = "";
    removeDeviceImage();

    let targetBlockId = "";
    if (id) {
        const dev = appData.devices.find(d => d.id === id);
        if (dev) {
            document.getElementById("modalTitle").innerText = "Eszköz Módosítása";
            document.getElementById("deviceId").value = dev.id;
            document.getElementById("devName").value = dev.name;
            document.getElementById("devIp").value = dev.ip;
            document.getElementById("devMac").value = dev.mac || '';
            document.getElementById("devStatus").value = dev.status;
            document.getElementById("devNotes").value = dev.notes || '';
            targetBlockId = dev.block_id || "";

            if (dev.image) {
                document.getElementById("devImageData").value = dev.image;
                document.getElementById("imagePreview").src = dev.image;
                document.getElementById("imagePreviewContainer").classList.remove("hidden");
            }
        }
    } else {
        document.getElementById("modalTitle").innerText = "Új Eszköz Rögzítése";
    }

    populateDeviceBlockDropdown(targetBlockId);
    document.getElementById("deviceModal").classList.remove("hidden");
    document.getElementById("deviceModal").classList.add("flex");
}
function closeModal() { document.getElementById("deviceModal").classList.add("hidden"); }

async function saveDevice(e) {
    e.preventDefault();
    const id = document.getElementById("deviceId").value;
    const blockSel = document.getElementById("devBlockSelect").value;

    let blockId = blockSel;
    let deptName = "";

    if (blockSel === "__NEW__") {
        deptName = document.getElementById("devCustomDept").value.trim();
        const cidrName = document.getElementById("devCustomCidr").value.trim();

        if (!deptName || !cidrName) {
            alert("Új blokk esetén add meg a Zónát és az IP CIDR tartományt is!");
            return;
        }

        blockId = "b_" + Date.now();
        appData.blocks.push({ id: blockId, dept: deptName, cidr: cidrName, label: "Automatikus Blokk" });
    } else {
        const foundBlock = appData.blocks.find(b => b.id === blockSel);
        if (foundBlock) deptName = foundBlock.dept;
    }

    const devData = {
        id: id ? id : "d_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
        name: document.getElementById("devName").value,
        ip: document.getElementById("devIp").value,
        mac: document.getElementById("devMac").value,
        block_id: blockId,
        dept: deptName,
        status: document.getElementById("devStatus").value,
        image: document.getElementById("devImageData").value || "",
        notes: document.getElementById("devNotes").value
    };

    if (id) {
        const idx = appData.devices.findIndex(d => d.id === id);
        if (idx !== -1) appData.devices[idx] = devData;
        else appData.devices.push(devData);
    } else { 
        appData.devices.push(devData); 
    }

    closeModal();
    await saveData();
}

async function deleteDevice(id) {
    if (confirm("Biztosan törölni szeretnéd az eszközt?")) {
        appData.devices = appData.devices.filter(d => d.id !== id);
        await saveData();
    }
}

function openImageViewer(imgSrc) {
    document.getElementById("fullImageView").src = imgSrc;
    document.getElementById("imageViewerModal").classList.remove("hidden");
    document.getElementById("imageViewerModal").classList.add("flex");
}
function closeImageViewer() {
    document.getElementById("imageViewerModal").classList.add("hidden");
    document.getElementById("imageViewerModal").classList.remove("flex");
}

function openAddBlockModal() { document.getElementById("blockModal").classList.remove("hidden"); document.getElementById("blockModal").classList.add("flex"); }
function closeBlockModal() { document.getElementById("blockModal").classList.add("hidden"); }

async function saveBlock(e) {
    e.preventDefault();
    appData.blocks.push({
        id: "b_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        dept: document.getElementById("blockDept").value,
        cidr: document.getElementById("blockCidr").value,
        label: document.getElementById("blockLabel").value
    });
    closeBlockModal();
    await saveData();
}

async function deleteBlock(id) {
    if (confirm("Törlöd a blokkot? Az ehhez tartozó eszközök átsorolódnak a Besorolatlan zónába.")) {
        appData.blocks = appData.blocks.filter(b => b.id !== id);
        await saveData();
    }
}

async function editTitle() {
    const newTitle = prompt("Új főcím:", appData.title);
    if (newTitle) {
        appData.title = newTitle;
        await saveData();
    }
}

/* NYOMTATÁS */
let labelsToPrint = [];

function openPrintModalForDevice(id) {
    const dev = appData.devices.find(d => d.id === id);
    if (!dev) return;
    labelsToPrint = [dev];
    generateLabelsHTML();
    document.getElementById("printModal").classList.remove("hidden");
    document.getElementById("printModal").classList.add("flex");
}

function openPrintModalForAll() {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const deptF = document.getElementById("deptFilter").value;
    const statusF = document.getElementById("statusFilter").value;

    labelsToPrint = appData.devices.filter(d => {
        const matchSearch = d.name.toLowerCase().includes(search) || d.ip.includes(search) || (d.mac && d.mac.toLowerCase().includes(search));
        const matchDept = !deptF || d.dept === deptF;
        const matchStatus = !statusF || d.status === statusF;
        return matchSearch && matchDept && matchStatus;
    });

    if (labelsToPrint.length === 0) {
        alert("Nincs nyomtatható eszköz az adott szűrésben!");
        return;
    }

    generateLabelsHTML();
    document.getElementById("printModal").classList.remove("hidden");
    document.getElementById("printModal").classList.add("flex");
}

function closePrintModal() {
    document.getElementById("printModal").classList.add("hidden");
    document.getElementById("printModal").classList.remove("flex");
}

function generateLabelsHTML() {
    const container = document.getElementById("labelsPrintContainer");
    container.innerHTML = "";

    labelsToPrint.forEach(dev => {
        const card = document.createElement("div");
        card.className = "label-print-card bg-white text-slate-900 border border-slate-300 rounded p-2.5 shadow-sm flex flex-col justify-between";
        card.innerHTML = `
            <div class="border-b border-black pb-1 mb-1.5 flex justify-between items-baseline">
                <h4 class="font-bold text-xs text-black uppercase tracking-tight truncate">${esc(dev.name)}</h4>
                <span class="text-[10px] text-gray-700 font-mono uppercase">${esc(dev.dept || 'Részleg nélkül')}</span>
            </div>
            <div class="space-y-0.5">
                <div class="flex items-baseline justify-between">
                    <span class="text-[10px] font-bold text-gray-600 uppercase font-mono">IP:</span>
                    <span class="text-base font-bold font-mono tracking-wider text-black">${esc(dev.ip)}</span>
                </div>
                ${dev.mac ? `
                <div class="flex items-baseline justify-between text-xs font-mono">
                    <span class="text-[10px] font-bold text-gray-600">MAC:</span>
                    <span class="font-semibold text-gray-800">${esc(dev.mac)}</span>
                </div>` : ''}
                ${dev.notes ? `
                <div class="text-[10px] text-gray-600 font-mono border-t border-gray-200 pt-1 mt-1 truncate">${esc(dev.notes)}</div>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

initTheme();
restoreSidebarState();
checkPasswordResetTokenInUrl();
checkAuth();
