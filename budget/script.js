let currentDb = "default";
let userPermissions = { username: "", display_name: "", email: "", is_superadmin: false, role: "editor", role_name: "Szerkesztő", permissions: {}, databases: [], all_databases: [], preferred_db: "default", system_default_db: "default" };
let appData = { 
    title: "Budget Manager Spektrumevents", 
    subtitle: "Turné & Koncert Költségvetés", 
    trip_config: { distance_km: 0, consumption_l: 10, fuel_price: 620, tolls: 0, accommodation: 0, catering: 0, other_expenses: 0, fee_income: 0 },
    blocks: [], 
    devices: [] 
};
let currentSessionId = localStorage.getItem("session_id") || "";
let availableRoles = {};

/* TÉMAKEZELŐ */
function initTheme() {
    const savedTheme = localStorage.getItem("budget_theme") || "dark";
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const isLight = (theme === 'light');
    if (isLight) {
        document.body.classList.add('theme-light');
    } else {
        document.body.classList.remove('theme-light');
    }
    localStorage.setItem("budget_theme", theme);
    
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
        localStorage.setItem("budget_sidebar_collapsed", isCollapsed ? "1" : "0");
    }
}

function restoreSidebarState() {
    if (window.innerWidth >= 768) {
        const isCollapsed = localStorage.getItem("budget_sidebar_collapsed") === "1";
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
        document.getElementById("authSubtitle").innerText = "Pénzügyi & Logisztikai Rendszer";
    }
}

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

    const displayName = userPermissions.display_name || userPermissions.username;
    document.getElementById("headerDisplayName").innerText = displayName;
    document.getElementById("headerUsername").innerText = userPermissions.username;
    document.getElementById("userAvatarLetter").innerText = displayName.charAt(0).toUpperCase();
    document.getElementById("headerRoleBadge").innerText = userPermissions.role_name || userPermissions.role.toUpperCase();

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

    if (!isSuper && perms.can_edit === false) {
        document.getElementById("addDevBtn").style.display = 'none';
        document.getElementById("addBlockBtn").style.display = 'none';
        document.getElementById("editTitleBtn").style.display = 'none';
    } else {
        document.getElementById("addDevBtn").style.display = 'flex';
        document.getElementById("addBlockBtn").style.display = 'flex';
        document.getElementById("editTitleBtn").style.display = 'inline-block';
    }

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
        if (!appData.trip_config) {
            appData.trip_config = { distance_km: 0, consumption_l: 10, fuel_price: 620, tolls: 0, accommodation: 0, catering: 0, other_expenses: 0, fee_income: 0 };
        }
        populateTripFields();
        render();
    } catch (err) {
        console.error("Adatbetöltési hiba:", err);
    }
}

function populateTripFields() {
    const tc = appData.trip_config || {};
    document.getElementById("calcDistance").value = tc.distance_km || 0;
    document.getElementById("calcConsumption").value = tc.consumption_l || 10;
    document.getElementById("calcFuelPrice").value = tc.fuel_price || 620;
    document.getElementById("calcTolls").value = tc.tolls || 0;
    document.getElementById("calcAccom").value = tc.accommodation || 0;
    document.getElementById("calcCatering").value = tc.catering || 0;
    document.getElementById("calcOther").value = tc.other_expenses || 0;
    document.getElementById("calcIncome").value = tc.fee_income || 0;
    updateCalc(false);
}

function updateCalc(shouldSave = true) {
    const dist = parseFloat(document.getElementById("calcDistance").value) || 0;
    const cons = parseFloat(document.getElementById("calcConsumption").value) || 0;
    const price = parseFloat(document.getElementById("calcFuelPrice").value) || 0;
    const tolls = parseFloat(document.getElementById("calcTolls").value) || 0;
    const accom = parseFloat(document.getElementById("calcAccom").value) || 0;
    const cater = parseFloat(document.getElementById("calcCatering").value) || 0;
    const other = parseFloat(document.getElementById("calcOther").value) || 0;
    const income = parseFloat(document.getElementById("calcIncome").value) || 0;

    const fuelCost = Math.round((dist / 100) * cons * price);
    const totalCost = fuelCost + tolls + accom + cater + other;
    const profit = income - totalCost;

    document.getElementById("fuelCostDisplay").innerText = fuelCost.toLocaleString("hu-HU") + " Ft";
    document.getElementById("totalCostDisplay").innerText = totalCost.toLocaleString("hu-HU") + " Ft";
    document.getElementById("profitDisplay").innerText = profit.toLocaleString("hu-HU") + " Ft";
    document.getElementById("statCostMini").innerText = totalCost.toLocaleString("hu-HU") + " Ft";

    if (profit < 0) {
        document.getElementById("profitDisplay").className = "font-mono font-bold text-rose-500 text-xs";
    } else {
        document.getElementById("profitDisplay").className = "font-mono font-bold text-emerald-400 text-xs";
    }

    appData.trip_config = {
        distance_km: dist, consumption_l: cons, fuel_price: price, tolls: tolls,
        accommodation: accom, catering: cater, other_expenses: other, fee_income: income
    };

    if (shouldSave) saveData();
}

async function saveData() {
    const perms = userPermissions.permissions || {};
    if (!userPermissions.is_superadmin && perms.can_edit === false) {
        alert("Nincs írási jogosultságod ebben a projektben!");
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
    document.getElementById("appTitleDisplay").innerText = (appData.title || "Budget Manager Spektrumevents");
    document.getElementById("appSubtitleDisplay").innerText = appData.subtitle || "Turné & Koncert Költségvetés";

    const search = document.getElementById("searchInput").value.toLowerCase();
    const deptF = document.getElementById("deptFilter").value;
    const statusF = document.getElementById("statusFilter").value;
    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit !== false;
    const canDelete = userPermissions.is_superadmin || perms.can_delete !== false;

    const filteredDevs = appData.devices.filter(d => {
        const matchSearch = d.name.toLowerCase().includes(search) || d.ip.includes(search) || (d.mac && d.mac.toLowerCase().includes(search)) || (d.responsible && d.responsible.toLowerCase().includes(search));
        const matchDept = !deptF || d.dept === deptF;
        const matchStatus = !statusF || d.status === statusF;
        return matchSearch && matchDept && matchStatus;
    });

    document.getElementById("statTotal").innerText = appData.devices.length;
    document.getElementById("statActive").innerText = appData.devices.filter(d => d.status === 'active').length;
    document.getElementById("statBlocks").innerText = appData.blocks.length;

    const depts = [...new Set(appData.blocks.map(b => b.dept).concat(appData.devices.map(d => d.dept)))].filter(Boolean);
    const deptFilterSelect = document.getElementById("deptFilter");
    const prevDeptFilter = deptFilterSelect.value;
    deptFilterSelect.innerHTML = `<option value="">Összes részleg</option>`;
    depts.forEach(dept => {
        const opt = document.createElement("option");
        opt.value = dept;
        opt.innerText = dept;
        if (dept === prevDeptFilter) opt.selected = true;
        deptFilterSelect.appendChild(opt);
    });

    const contentArea = document.getElementById("blocksContainer");
    contentArea.innerHTML = "";

    const blocks = [...appData.blocks];
    blocks.push({ id: "unassigned", cidr: "Besorolatlan tételek", dept: "Egyéb", label: "Kategórián kívüli felszerelés" });

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
            rowsHTML = `<tr><td colspan="6" class="p-3 text-center text-[var(--text-muted)] font-mono text-[11px]">Nincs tétel rögzítve ebben a kategóriában.</td></tr>`;
        } else {
            blockDevs.forEach(d => {
                const isActive = d.status === 'active';
                rowsHTML += `
                    <tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition">
                        <td class="px-3 py-1.5 w-8">
                            <span class="inline-block w-2 h-2 rounded-full ${esc(isActive ? 'bg-emerald-500' : 'bg-amber-500')}" title="${esc(isActive ? 'Bepakolva' : 'Hiányzik')}"></span>
                        </td>
                        <td class="px-3 py-1.5 font-semibold text-[var(--text-primary)] whitespace-nowrap">${esc(d.name)}</td>
                        <td class="px-3 py-1.5 font-mono text-[var(--text-primary)] whitespace-nowrap font-bold">${esc(d.ip)}</td>
                        <td class="px-3 py-1.5 font-mono text-[var(--text-secondary)] text-[11px] whitespace-nowrap">${(d.mac) ? esc(d.mac) : '<span class="text-[var(--text-muted)]">—</span>'}</td>
                        <td class="px-3 py-1.5 text-[var(--text-secondary)] max-w-xs truncate text-[11px] font-mono">
                            ${d.responsible ? `<span class="text-amber-500 mr-2"><i class="fa-solid fa-user mr-1 text-[10px]"></i>${esc(d.responsible)}</span>` : ''}
                            ${esc(d.notes || '')}
                        </td>
                        <td class="px-3 py-1.5 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-2">
                                ${d.image ? `<button onclick="openImageViewer(${jsq(d.image)})" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Fotó"><i class="fa-solid fa-image"></i></button>` : ''}
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
                    <span class="text-[var(--text-muted)] text-[10px]">(${esc(blockDevs.length)} tétel)</span>
                </div>
                ${block.id !== 'unassigned' && canDelete ? `
                    <button onclick="deleteBlock(${jsq(block.id)})" class="text-[11px] text-[var(--text-muted)] hover:text-rose-500 flex items-center gap-1">
                        <i class="fa-solid fa-trash text-[10px]"></i> Kategória törlése
                    </button>` : ''}
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ui-panel">
                            <th class="px-3 py-1.5 w-8">Állapot</th>
                            <th class="px-3 py-1.5">Felszerelés</th>
                            <th class="px-3 py-1.5">Mennyiség</th>
                            <th class="px-3 py-1.5">Tároló / Rack</th>
                            <th class="px-3 py-1.5">Felelős / Megjegyzés</th>
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
    document.getElementById("profSessionIdDisplay").innerText = currentSessionId || "N/A";

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

    const currentTheme = localStorage.getItem("budget_theme") || "dark";
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

    const roleSelect = document.getElementById("newRole");
    roleSelect.innerHTML = "";
    Object.keys(availableRoles).forEach(rKey => {
        const r = availableRoles[rKey];
        const opt = document.createElement("option");
        opt.value = rKey;
        opt.innerText = `${r.name} (${rKey})`;
        roleSelect.appendChild(opt);
    });

    const roleContainer = document.getElementById("roleListContainer");
    roleContainer.innerHTML = "";
    Object.keys(availableRoles).forEach(rKey => {
        const r = availableRoles[rKey];
        const card = document.createElement("div");
        card.className = "flex items-center justify-between p-2.5 ui-panel border border-[var(--border-color)] rounded text-xs";
        card.innerHTML = `
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-[var(--text-primary)]">${esc(r.name)}</span>
                    <span class="font-mono text-[10px] text-amber-500 uppercase px-1 rounded ui-subtle border border-[var(--border-color)]">${esc(rKey)}</span>
                </div>
                <div class="text-[10px] text-[var(--text-muted)] mt-0.5">${esc(r.description || 'Nincs leírás')}</div>
            </div>
        `;
        roleContainer.appendChild(card);
    });

    const dbContainer = document.getElementById("dbListContainer");
    dbContainer.innerHTML = "";
    (data.all_databases || []).forEach(db => {
        const item = document.createElement("div");
        item.className = "flex items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs";
        item.innerHTML = `
            <span class="font-mono text-[var(--text-primary)]"><i class="fa-solid fa-calendar mr-2 text-[var(--text-muted)]"></i>${esc(db.toUpperCase())}</span>
            <div class="flex items-center gap-2">
                <button onclick="switchDatabase(${jsq(db)}); closeUserAdminModal();" class="text-xs text-blue-500 hover:underline">Megnyitás</button>
                ${db !== 'default' ? `<button onclick="deleteDatabase(${jsq(db)})" class="text-[var(--text-muted)] hover:text-rose-500 ml-2"><i class="fa-solid fa-trash"></i></button>` : '<span class="text-[10px] text-[var(--text-muted)] font-mono ml-2">[Alapértelmezett]</span>'}
            </div>
        `;
        dbContainer.appendChild(item);
    });

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
                Projektek: <span class="font-semibold text-[var(--text-primary)]">${esc(u.databases.join(", ") || "Nincs")}</span>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="editUser(${jsq(u.username)}, ${jsq(u.display_name || '')}, ${jsq(u.email || '')}, ${jsq(u.role)}, ${jsq(u.databases.join(","))})" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><i class="fa-solid fa-pen"></i></button>
                ${userPermissions.is_superadmin && !u.is_superadmin ? `<button onclick="deleteUser(${jsq(u.username)})" class="text-[var(--text-muted)] hover:text-rose-500 ml-1"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        `;
        uContainer.appendChild(card);
    });

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

/* DB ADMIN MODAL */
async function openDbAdminModal() {
    const res = await authFetch('/api/db-admin/requests');
    if (!res.ok) {
        alert("Nincs DB Admin jogosultságod!");
        return;
    }
    const data = await res.json();
    document.getElementById("dbAdminManagedList").innerText = data.managed_databases.join(", ").toUpperCase() || "Nincs felügyelt projekt";

    const reqContainer = document.getElementById("dbAdminRequestsContainer");
    reqContainer.innerHTML = "";
    if (data.db_requests.length === 0) {
        reqContainer.innerHTML = `<p class="text-xs text-[var(--text-muted)] font-mono italic">Nincs elbírálásra váró kérelem a te projektjeidhez.</p>`;
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
        alert(`Projekt (${name}) létrehozva!`);
        await loadUserInfo();
        renderAdminData();
    } else {
        const err = await res.json();
        alert(err.error || "Hiba a projekt létrehozásakor!");
    }
}

async function deleteDatabase(dbName) {
    if (confirm(`BIZTOSAN TÖRÖLNI KÍVÁNOD A(Z) [${dbName.toUpperCase()}] PROJEKTET? Minden adat véglegesen elveszik!`)) {
        const res = await authFetch(`/api/admin/databases/${dbName}`, { method: 'DELETE' });
        if (res.ok) {
            alert(`Projekt (${dbName}) törölve!`);
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

    document.getElementById("userFormTitle").innerHTML = `Tag Szerkesztése: <span class="font-mono text-[var(--text-primary)]">${esc(dName || uName)}</span>`;
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
    document.getElementById("userFormTitle").innerHTML = `Tag Rögzítése / Módosítása`;
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
        alert(`Tag (${dispName}) adatai mentve!`);
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
        alert("Minden meglévő projekthez rendelkezel hozzáféréssel!");
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
        alert(`Kérelem leadva a(z) [${db.toUpperCase()}] projektre!`);
        closeRequestDbModal();
    }
}

/* ESZKÖZ ÉS KATEGÓRIA KEZELÉS */
function populateDeviceBlockDropdown(selectedBlockId = "") {
    const select = document.getElementById("devBlockSelect");
    select.innerHTML = "";

    if (appData.blocks.length === 0) {
        const opt = document.createElement("option");
        opt.value = "__NEW__";
        opt.innerText = "+ Új Kategória és Részleg megadása...";
        select.appendChild(opt);
    } else {
        appData.blocks.forEach(b => {
            const opt = document.createElement("option");
            opt.value = b.id;
            opt.innerText = `${b.cidr} - ${b.dept} (${b.label || 'Nincs leírás'})`;
            if (b.id === selectedBlockId) opt.selected = true;
            select.appendChild(opt);
        });

        const newOpt = document.createElement("option");
        newOpt.value = "__NEW__";
        newOpt.innerText = "+ Új Kategória és Részleg...";
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
            document.getElementById("modalTitle").innerText = "Felszerelés Módosítása";
            document.getElementById("deviceId").value = dev.id;
            document.getElementById("devName").value = dev.name;
            document.getElementById("devIp").value = dev.ip;
            document.getElementById("devMac").value = dev.mac || '';
            document.getElementById("devResponsible").value = dev.responsible || '';
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
        document.getElementById("modalTitle").innerText = "Új Felszerelés Rögzítése";
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
            alert("Új kategória esetén add meg a Részleget és a Megnevezést!");
            return;
        }

        blockId = "b_" + Date.now();
        appData.blocks.push({ id: blockId, dept: deptName, cidr: cidrName, label: "Kategória" });
    } else {
        const foundBlock = appData.blocks.find(b => b.id === blockSel);
        if (foundBlock) deptName = foundBlock.dept;
    }

    const devData = {
        id: id ? id : "d_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
        name: document.getElementById("devName").value,
        ip: document.getElementById("devIp").value,
        mac: document.getElementById("devMac").value,
        responsible: document.getElementById("devResponsible").value,
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
    if (confirm("Biztosan törölni szeretnéd ezt a tételt?")) {
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
    if (confirm("Törlöd ezt a kategóriát?")) {
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

initTheme();
restoreSidebarState();
checkPasswordResetTokenInUrl();
checkAuth();
