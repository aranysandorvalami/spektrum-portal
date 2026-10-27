let currentDb = "default";
let userPermissions = { 
    username: "", 
    display_name: "", 
    email: "", 
    is_superadmin: false, 
    role: "editor", 
    role_name: "Szerkesztő", 
    permissions: {}, 
    databases: [], 
    all_databases: [], 
    preferred_db: "default", 
    system_default_db: "default" 
};
let appData = { title: "Library Manager Spektrumevents", subtitle: "Zenekari Rack & Leltárkezelő Rendszer", devices: [] };
let currentSessionId = localStorage.getItem("session_id") || "";
let availableRoles = {};
let currentAdminUsersList = [];
let html5QrCodeScanner = null;
let isScanCooldown = false;
let pendingScanResult = null;
let lastScannedCode = null;
let lastScannedTime = 0;
let currentEditingDeviceInventory = [];

/* BIZTONSÁGOS HTML ESCAPE */
function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* TÉMAKEZELŐ */
function initTheme() {
    const savedTheme = localStorage.getItem("library_theme") || "dark";
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const isLight = (theme === 'light');
    if (isLight) {
        document.body.classList.add('theme-light');
    } else {
        document.body.classList.remove('theme-light');
    }
    localStorage.setItem("library_theme", theme);
    
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
        localStorage.setItem("library_sidebar_collapsed", isCollapsed ? "1" : "0");
    }
}

function restoreSidebarState() {
    if (window.innerWidth >= 768) {
        const isCollapsed = localStorage.getItem("library_sidebar_collapsed") === "1";
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
        document.getElementById("authSubtitle").innerText = "Leltár & Rack Rendszer";
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

    if (p1.length < 8) {
        msgEl.className = "text-[11px] text-rose-500 font-mono";
        msgEl.innerText = "A jelszónak legalább 8 karakter hosszúnak kell lennie!";
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
            alert(data.message || "Jelszó megváltoztatva! Most már bejelentkezhetsz.");
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
        msgEl.innerText = "Szerver kapcsolódási hiba!";
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

    if (p.length < 8) {
        msgEl.className = "text-[11px] text-rose-500 font-mono";
        msgEl.innerText = "A jelszónak legalább 8 karakter hosszúnak kell lennie!";
        msgEl.classList.remove("hidden");
        return;
    }

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
    if (!res.ok) {
        return;
    }
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
        document.getElementById("superAdminBtn").classList.remove("flex");
    }

    if (!isSuper && perms.can_manage_dbs) {
        document.getElementById("dbAdminBtn").classList.remove("hidden");
        document.getElementById("dbAdminBtn").classList.add("flex");
    } else {
        document.getElementById("dbAdminBtn").classList.add("hidden");
        document.getElementById("dbAdminBtn").classList.remove("flex");
    }

    if (!isSuper && perms.can_edit_devices === false) {
        document.getElementById("addDevBtn").style.display = 'none';
        document.getElementById("editTitleBtn").style.display = 'none';
    } else {
        document.getElementById("addDevBtn").style.display = 'flex';
        document.getElementById("editTitleBtn").style.display = 'inline-block';
    }

    const dbSelect = document.getElementById("dbSelector");
    dbSelect.innerHTML = "";
    userPermissions.databases.forEach(db => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.innerText = db.replaceAll("_", " ").toUpperCase();
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

    await loadData();
}

async function switchDatabase(dbName) {
    currentDb = dbName;
    const dbSelector = document.getElementById("dbSelector");
    if (dbSelector) {
        let exists = Array.from(dbSelector.options).some(o => o.value === dbName);
        if (!exists) {
            const opt = document.createElement("option");
            opt.value = dbName;
            opt.innerText = dbName.replaceAll("_", " ").toUpperCase();
            dbSelector.appendChild(opt);
        }
        dbSelector.value = dbName;
    }
    await loadData();
}

async function loadData() {
    try {
        const res = await authFetch(`/api/data?db=${encodeURIComponent(currentDb)}&_t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) {
            console.error("Adatbetöltési hiba státusz:", res.status);
            return;
        }
        appData = await res.json();
        if (!appData.devices) appData.devices = [];
        render();
    } catch (err) {
        console.error("Adatbetöltési hiba:", err);
    }
}

async function saveData() {
    const perms = userPermissions.permissions || {};
    if (!userPermissions.is_superadmin && perms.can_edit_devices === false) {
        alert("Nincs írási jogosultságod ebben a partícióban!");
        await loadData();
        return false;
    }

    try {
        const res = await authFetch(`/api/data?db=${encodeURIComponent(currentDb)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData, null, 2)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Mentési hiba!");
            await loadData();
            return false;
        }
        render();
        return true;
    } catch (err) {
        alert("Mentési hiba a szerveren!");
        await loadData();
        return false;
    }
}

/* FŐ TÁBLÁZAT ÉS LISTA MEGJELENÍTÉS (XSS-VÉDETT) */
function render() {
    document.getElementById("appTitleDisplay").innerText = (appData.title || "Library Manager Spektrumevents");
    document.getElementById("appSubtitleDisplay").innerText = appData.subtitle || "Zenekari Leltár & Rack Rendszer";

    const search = document.getElementById("searchInput").value.toLowerCase();
    const catF = document.getElementById("catFilter").value;
    const statusF = document.getElementById("statusFilter").value;
    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_devices !== false;
    const canDelete = userPermissions.is_superadmin || perms.can_delete_devices !== false;

    const filteredDevs = appData.devices.filter(d => {
        const matchItems = Array.isArray(d.inventory) && d.inventory.some(i => 
            (i.name && i.name.toLowerCase().includes(search)) ||
            (i.qty && i.qty.toLowerCase().includes(search)) ||
            (i.condition && i.condition.toLowerCase().includes(search))
        );

        const matchSearch = (d.name && d.name.toLowerCase().includes(search)) || 
                            (d.barcode && d.barcode.toLowerCase().includes(search)) || 
                            (d.rack_id && d.rack_id.toLowerCase().includes(search)) ||
                            matchItems;

        const matchCat = !catF || d.cat === catF;
        const matchStatus = !statusF || d.status === statusF;
        return matchSearch && matchCat && matchStatus;
    });

    document.getElementById("statTotal").innerText = appData.devices.length;
    document.getElementById("statInStock").innerText = appData.devices.filter(d => d.status === 'in_stock').length;
    document.getElementById("statAway").innerText = appData.devices.filter(d => d.status === 'away').length;
    document.getElementById("statRepair").innerText = appData.devices.filter(d => d.status === 'repair').length;

    const allCategories = [...new Set(appData.devices.map(d => d.cat || "Egyéb"))];
    const catFilterSelect = document.getElementById("catFilter");
    const prevCat = catFilterSelect.value;
    catFilterSelect.innerHTML = `<option value="">Összes kategória</option>`;
    allCategories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.innerText = cat;
        if (cat === prevCat) opt.selected = true;
        catFilterSelect.appendChild(opt);
    });

    const contentArea = document.getElementById("contentArea");
    contentArea.innerHTML = "";

    if (filteredDevs.length === 0) {
        contentArea.innerHTML = `<div class="ui-panel border rounded-md p-6 text-center text-[var(--text-muted)] font-mono text-[11px]">Nincs találat a leltárban.</div>`;
        return;
    }

    const activeCats = catF ? [catF] : [...new Set(filteredDevs.map(d => d.cat || "Egyéb"))];

    activeCats.forEach(cat => {
        const catDevs = filteredDevs.filter(d => (d.cat || "Egyéb") === cat);
        if (catDevs.length === 0) return;

        const catCard = document.createElement("div");
        catCard.className = "ui-panel border rounded-md overflow-hidden shadow-sm";

        let rowsHTML = "";
        catDevs.forEach(d => {
            let statusDot = 'bg-emerald-500';
            let statusTitle = 'Raktáron';
            if (d.status === 'away') { statusDot = 'bg-amber-500'; statusTitle = 'Elvíve'; }
            else if (d.status === 'ordered') { statusDot = 'bg-cyan-500'; statusTitle = 'Beszerzés alatt'; }
            else if (d.status === 'repair') { statusDot = 'bg-rose-500'; statusTitle = 'Szervizben'; }

            const invCount = Array.isArray(d.inventory) ? d.inventory.length : 0;
            
            let invButtonHTML = "";
            if (invCount > 0) {
                invButtonHTML = `<button onclick="openRackInventoryModal(this.dataset.devid)" data-devid="${escapeHtml(d.id)}" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded ui-subtle border border-amber-500/30 text-amber-500 hover:text-amber-400 hover:border-amber-500 text-[10px] font-mono transition" title="Rack leltár megnyitása">
                     <i class="fa-solid fa-boxes-stacked text-[10px]"></i>
                     <span>${invCount} tétel</span>
                   </button>`;
            } else if (canEdit) {
                invButtonHTML = `<button onclick="openRackInventoryModal(this.dataset.devid)" data-devid="${escapeHtml(d.id)}" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded ui-subtle border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-light)] text-[10px] transition" title="Új belső leltár hozzáadása">
                     <i class="fa-solid fa-plus text-[9px]"></i>
                     <span>Leltár hozzáadása</span>
                   </button>`;
            } else {
                invButtonHTML = `<span class="text-[var(--text-muted)] text-[10px] font-mono">0 tétel</span>`;
            }

            rowsHTML += `
                <tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition align-middle">
                    <td class="px-3 py-2 w-8">
                        <span class="inline-block w-2 h-2 rounded-full ${statusDot}" title="${statusTitle}"></span>
                    </td>
                    <td class="px-3 py-2">
                        <span class="font-semibold text-[var(--text-primary)]">${escapeHtml(d.name)}</span>
                    </td>
                    <td class="px-3 py-2 whitespace-nowrap">
                        ${invButtonHTML}
                    </td>
                    <td class="px-3 py-2 font-mono text-[var(--text-primary)] whitespace-nowrap font-bold">${d.rack_id ? escapeHtml(d.rack_id) : '<span class="text-[var(--text-muted)]">—</span>'}</td>
                    <td class="px-3 py-2 font-mono text-[var(--text-secondary)] text-[11px] whitespace-nowrap">${d.barcode ? escapeHtml(d.barcode) : '<span class="text-[var(--text-muted)]">—</span>'}</td>
                    <td class="px-3 py-2 text-[var(--text-secondary)] max-w-xs truncate text-[11px] font-mono">${d.notes ? escapeHtml(d.notes) : '<span class="text-[var(--text-muted)]">—</span>'}</td>
                    <td class="px-3 py-2 text-right whitespace-nowrap">
                        <div class="inline-flex items-center gap-2">
                            ${d.image ? `<button onclick="openDeviceImageViewer(this.dataset.devid)" data-devid="${escapeHtml(d.id)}" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Fotó"><i class="fa-solid fa-image"></i></button>` : ''}
                            <button onclick="openRackInventoryModal(this.dataset.devid)" data-devid="${escapeHtml(d.id)}" class="text-[var(--text-muted)] hover:text-amber-500" title="Belső Leltár Megnyitása"><i class="fa-solid fa-boxes-stacked"></i></button>
                            <button onclick="openLabelDesignerForDevice(this.dataset.devid)" data-devid="${escapeHtml(d.id)}" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]" title="Címke / Leltárlap"><i class="fa-solid fa-tag"></i></button>
                            ${canEdit ? `<button onclick="openAddModal(this.dataset.devid)" data-devid="${escapeHtml(d.id)}" class="text-[var(--text-muted)] hover:text-blue-500" title="Szerkesztés"><i class="fa-solid fa-pen"></i></button>` : ''}
                            ${canDelete ? `<button onclick="deleteDevice(this.dataset.devid)" data-devid="${escapeHtml(d.id)}" class="text-[var(--text-muted)] hover:text-rose-500" title="Törlés"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });

        catCard.innerHTML = `
            <div class="px-3 py-2 ui-subtle border-b border-[var(--border-color)] flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 font-mono">
                    <span class="font-bold text-[var(--text-primary)] text-xs">${escapeHtml(cat)}</span>
                    <span class="text-[var(--text-muted)] text-[10px]">(${catDevs.length} eszköz)</span>
                </div>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ui-panel">
                            <th class="px-3 py-1.5 w-8">Állapot</th>
                            <th class="px-3 py-1.5">Eszköz Neve</th>
                            <th class="px-3 py-1.5 w-36">Belső Leltár</th>
                            <th class="px-3 py-1.5">Rack Szám</th>
                            <th class="px-3 py-1.5">Vonalkód</th>
                            <th class="px-3 py-1.5">Műszaki Megjegyzés</th>
                            <th class="px-3 py-1.5 text-right">Művelet</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHTML}</tbody>
                </table>
            </div>
        `;
        contentArea.appendChild(catCard);
    });
}

/* ========================================================
   RACK BELSŐ LELTÁR KEZELŐ MODUL
   ======================================================== */
function openRackInventoryModal(devId) {
    const dev = appData.devices.find(d => d.id === devId);
    if (!dev) return;

    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_devices !== false;

    document.getElementById("rackInvDevId").value = dev.id;
    document.getElementById("rackInvDeviceName").innerText = dev.name;
    document.getElementById("rackInvSubDetails").innerText = `${dev.cat || 'Kategória'} • Rack: ${dev.rack_id || 'Nincs'} • Vonalkód: ${dev.barcode || 'Nincs'}`;

    const addBtn = document.querySelector("#rackInventoryModal button[onclick='addModalInventoryRow()']");
    const saveBtn = document.querySelector("#rackInventoryModal button[onclick*='requestSubmit']");
    if (addBtn) addBtn.style.display = canEdit ? "inline-flex" : "none";
    if (saveBtn) saveBtn.style.display = canEdit ? "inline-flex" : "none";

    const tbody = document.getElementById("rackInvTableBody");
    tbody.innerHTML = "";

    const items = Array.isArray(dev.inventory) ? dev.inventory : [];
    items.forEach(item => {
        renderRackInventoryRow(item.name, item.qty, item.condition, canEdit);
    });

    updateRackInvCounters();

    document.getElementById("rackInventoryModal").classList.remove("hidden");
    document.getElementById("rackInventoryModal").classList.add("flex");
}

function closeRackInventoryModal() {
    document.getElementById("rackInventoryModal").classList.add("hidden");
    document.getElementById("rackInventoryModal").classList.remove("flex");
}

function addModalInventoryRow() {
    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_devices !== false;
    if (!canEdit) return;

    renderRackInventoryRow("", "1db", "Jó", true);
    updateRackInvCounters();
    
    const inputs = document.querySelectorAll(".rack-inv-name");
    if (inputs.length > 0) {
        inputs[inputs.length - 1].focus();
    }
}

function renderRackInventoryRow(name = "", qty = "1db", condition = "Jó", canEdit = true) {
    const tbody = document.getElementById("rackInvTableBody");
    const tr = document.createElement("tr");
    tr.className = "hover:bg-[var(--panel-hover)] transition rack-inv-row";
    
    tr.innerHTML = `
        <td class="p-2">
            <input type="text" value="${escapeHtml(name)}" ${canEdit ? '' : 'readonly'} placeholder="pl. Shure SM58 mikrofon vagy XLR kábel" class="rack-inv-name form-control w-full rounded px-2 py-1 text-xs font-medium" required>
        </td>
        <td class="p-2">
            <input type="text" value="${escapeHtml(qty)}" ${canEdit ? '' : 'readonly'} placeholder="pl. 4db" class="rack-inv-qty form-control w-full rounded px-2 py-1 text-xs font-mono" required>
        </td>
        <td class="p-2">
            <select class="rack-inv-cond form-control w-full rounded px-2 py-1 text-xs" ${canEdit ? '' : 'disabled'}>
                <option value="Jó" ${condition === 'Jó' || !condition ? 'selected' : ''}>Jó</option>
                <option value="Új / Kiváló" ${condition === 'Új / Kiváló' ? 'selected' : ''}>Új / Kiváló</option>
                <option value="Kopott" ${condition === 'Kopott' ? 'selected' : ''}>Kopott</option>
                <option value="Sérült / Hibás" ${condition === 'Sérült / Hibás' ? 'selected' : ''}>Sérült / Hibás</option>
                <option value="Beszerzés alatt" ${condition === 'Beszerzés alatt' ? 'selected' : ''}>Beszerzés alatt</option>
            </select>
        </td>
        <td class="p-2 text-center">
            ${canEdit ? `
                <button type="button" onclick="removeRackInvRow(this)" class="text-[var(--text-muted)] hover:text-rose-500 p-1" title="Tétel törlése">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            ` : '<span class="text-[var(--text-muted)]">—</span>'}
        </td>
    `;
    tbody.appendChild(tr);
}

function removeRackInvRow(btn) {
    const row = btn.closest(".rack-inv-row");
    if (row) {
        row.remove();
        updateRackInvCounters();
    }
}

function updateRackInvCounters() {
    const rows = document.querySelectorAll(".rack-inv-row");
    const counter = document.getElementById("rackInvCounter");
    const emptyMsg = document.getElementById("rackInvEmptyMessage");

    counter.innerText = `${rows.length} tétel rögzítve`;
    if (rows.length === 0) {
        emptyMsg.classList.remove("hidden");
    } else {
        emptyMsg.classList.add("hidden");
    }
}

async function saveRackInventory(e) {
    e.preventDefault();
    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_devices !== false;
    if (!canEdit) {
        alert("Csak olvasási jogosultságod van!");
        closeRackInventoryModal();
        return;
    }

    const devId = document.getElementById("rackInvDevId").value;
    const dev = appData.devices.find(d => d.id === devId);

    if (!dev) {
        alert("A keresett eszköz nem található!");
        return;
    }

    const rows = document.querySelectorAll(".rack-inv-row");
    const newInventory = [];
    rows.forEach(tr => {
        const name = tr.querySelector(".rack-inv-name").value.trim();
        const qty = tr.querySelector(".rack-inv-qty").value.trim();
        const condition = tr.querySelector(".rack-inv-cond").value;
        if (name) {
            newInventory.push({ name, qty: qty || "1db", condition: condition || "Jó" });
        }
    });

    dev.inventory = newInventory;
    closeRackInventoryModal();
    await saveData();
}

/* PROFIL MODAL */
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
    const newEmail = document.getElementById("profInputEmail").value.trim().toLowerCase();
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

    if (new_pw.length < 8) {
        alert("Az új jelszónak legalább 8 karakter hosszúnak kell lennie!");
        return;
    }

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
        opt.innerText = db.replaceAll("_", " ").toUpperCase();
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
            opt.innerText = db.replaceAll("_", " ").toUpperCase();
            if (db === userPermissions.system_default_db) opt.selected = true;
            globSel.appendChild(opt);
        });
    } else {
        document.getElementById("globalDefaultDbContainer").classList.add("hidden");
    }

    const currentTheme = localStorage.getItem("library_theme") || "dark";
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
    const perms = userPermissions.permissions || {};
    if (!userPermissions.is_superadmin && !perms.can_access_admin) {
        alert("Nincs hozzáférési jogosultságod a Főadminisztrációs Központhoz!");
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
    currentAdminUsersList = data.users || [];

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
        
        const permsArr = [];
        if (r.permissions.can_edit_devices) permsArr.push("Szerkesztés");
        if (r.permissions.can_delete_devices) permsArr.push("Törlés");
        if (r.permissions.can_manage_dbs) permsArr.push("DB Admin");
        if (r.permissions.can_access_admin) permsArr.push("Főadmin");

        card.innerHTML = `
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-[var(--text-primary)]">${escapeHtml(r.name)}</span>
                    <span class="font-mono text-[10px] text-amber-500 uppercase px-1 rounded ui-subtle border border-[var(--border-color)]">${escapeHtml(rKey)}</span>
                    ${r.is_system ? '<span class="text-[9px] text-[var(--text-muted)] font-mono">[Rendszer]</span>' : ''}
                </div>
                <div class="text-[10px] text-[var(--text-muted)] mt-0.5">${escapeHtml(r.description || 'Nincs leírás')}</div>
                <div class="text-[10px] text-[var(--text-secondary)] font-mono mt-1">Jogok: ${escapeHtml(permsArr.join(", ") || 'Nincs külön jog')}</div>
            </div>
            <div>
                <button onclick="editRole(this.dataset.rolekey)" data-rolekey="${escapeHtml(rKey)}" class="px-2 py-1 rounded ui-subtle border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    <i class="fa-solid fa-pen"></i> Konfigurálás
                </button>
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
            <span class="font-mono text-[var(--text-primary)]"><i class="fa-solid fa-database mr-2 text-[var(--text-muted)]"></i>${escapeHtml(db.toUpperCase())}</span>
            <div class="flex items-center gap-2">
                <button onclick="switchDatabase(this.dataset.db); closeUserAdminModal();" data-db="${escapeHtml(db)}" class="text-xs text-blue-500 hover:underline">Megnyitás</button>
                ${db !== 'default' ? `<button onclick="deleteDatabase(this.dataset.db)" data-db="${escapeHtml(db)}" class="text-[var(--text-muted)] hover:text-rose-500 ml-2"><i class="fa-solid fa-trash"></i></button>` : '<span class="text-[10px] text-[var(--text-muted)] font-mono ml-2">[Alapértelmezett]</span>'}
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
                    <div class="font-semibold text-[var(--text-primary)]"><i class="fa-solid fa-user-clock text-amber-500 mr-2"></i>${escapeHtml(u.display_name || u.username)}</div>
                    <div class="text-[10px] text-[var(--text-muted)] font-mono">${escapeHtml(u.username)} &bull; ${escapeHtml(u.email || 'Nincs e-mail')}</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="approveUser(this.dataset.user, 'approve')" data-user="${escapeHtml(u.username)}" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Jóváhagyás</button>
                    <button onclick="approveUser(this.dataset.user, 'reject')" data-user="${escapeHtml(u.username)}" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasítás</button>
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
                    <span class="font-medium text-[var(--text-primary)]">${escapeHtml(r.username)}</span> &rarr; <span class="text-[var(--text-secondary)] font-mono">${escapeHtml(r.database.toUpperCase())}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="approveDbRequest(this.dataset.user, this.dataset.db, 'approve')" data-user="${escapeHtml(r.username)}" data-db="${escapeHtml(r.database)}" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Elfogad</button>
                    <button onclick="approveDbRequest(this.dataset.user, this.dataset.db, 'reject')" data-user="${escapeHtml(r.username)}" data-db="${escapeHtml(r.database)}" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasít</button>
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
        let roleBadge = `<span class="ui-subtle text-[var(--text-secondary)] border border-[var(--border-color)] px-1.5 py-0.5 rounded font-mono text-[10px] uppercase">${escapeHtml(rDef.name)}</span>`;
        if (u.is_superadmin || u.role === 'superadmin') {
            roleBadge = `<span class="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold">SUPERADMIN</span>`;
        }

        card.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-user text-[var(--text-muted)]"></i>
                <div>
                    <span class="font-medium text-[var(--text-primary)]">${escapeHtml(u.display_name || u.username)}</span>
                    <span class="text-[10px] font-mono text-[var(--text-muted)]">(${escapeHtml(u.username)})</span>
                    ${u.email ? `<span class="text-[10px] font-mono text-[var(--text-secondary)] ml-1">&lt;${escapeHtml(u.email)}&gt;</span>` : ''}
                </div>
                ${roleBadge}
            </div>
            <div class="text-[var(--text-secondary)] font-mono text-[11px]">
                Partíciók: <span class="font-semibold text-[var(--text-primary)]">${escapeHtml(u.databases.join(", ") || "Nincs")}</span>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="editUserByUsername(this.dataset.user)" data-user="${escapeHtml(u.username)}" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><i class="fa-solid fa-pen"></i></button>
                ${userPermissions.is_superadmin && !u.is_superadmin ? `<button onclick="deleteUser(this.dataset.user)" data-user="${escapeHtml(u.username)}" class="text-[var(--text-muted)] hover:text-rose-500 ml-1"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        `;
        uContainer.appendChild(card);
    });

    const dbSel = document.getElementById("newDbSelect");
    dbSel.innerHTML = "";
    (data.all_databases || []).forEach(db => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.innerText = db.replaceAll("_", " ").toUpperCase();
        opt.className = "py-1 px-2 hover:bg-[var(--panel-hover)] cursor-pointer";
        dbSel.appendChild(opt);
    });
}

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
                    <span class="font-medium text-[var(--text-primary)]">${escapeHtml(r.username)}</span> &rarr; <span class="text-[var(--text-secondary)] font-mono">${escapeHtml(r.database.toUpperCase())}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="approveDbRequest(this.dataset.user, this.dataset.db, 'approve'); openDbAdminModal();" data-user="${escapeHtml(r.username)}" data-db="${escapeHtml(r.database)}" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Elfogad</button>
                    <button onclick="approveDbRequest(this.dataset.user, this.dataset.db, 'reject'); openDbAdminModal();" data-user="${escapeHtml(r.username)}" data-db="${escapeHtml(r.database)}" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasít</button>
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
    if (confirm(`BIZTOSAN TÖRÖLNI KÍVÁNOD A(Z) [${dbName.toUpperCase()}] PARTÍCIÓT?`)) {
        const res = await authFetch(`/api/admin/databases/${encodeURIComponent(dbName)}`, { method: 'DELETE' });
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

/* BIZTONSÁGOS FELHASZNÁLÓ SZERKESZTŐ (OBRIEN ÉS APOSZTRÓF BIZTOS) */
function editUserByUsername(uName) {
    const u = currentAdminUsersList.find(x => x.username === uName);
    if (!u) return;

    const uInput = document.getElementById("newUsername");
    uInput.value = u.username;
    uInput.dataset.oldUsername = u.username;
    document.getElementById("newDisplayName").value = u.display_name || u.username;
    document.getElementById("newEmail").value = u.email || '';
    document.getElementById("newPassword").value = "";
    document.getElementById("newRole").value = u.role;

    const dbs = Array.isArray(u.databases) ? u.databases : [];
    const select = document.getElementById("newDbSelect");
    Array.from(select.options).forEach(opt => opt.selected = dbs.includes(opt.value));

    document.getElementById("userFormTitle").innerText = `Munkatárs Szerkesztése: ${u.display_name || u.username}`;
    switchAdminTab('users');
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
    document.getElementById("userFormTitle").innerText = "Munkatárs Rögzítése / Módosítása";
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

    if (p && p.trim().length > 0 && p.trim().length < 8) {
        alert("Az új jelszónak legalább 8 karakter hosszúnak kell lennie!");
        return;
    }

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
        const res = await authFetch(`/api/admin/users/${encodeURIComponent(uName)}`, { method: 'DELETE' });
        if (res.ok) {
            renderAdminData();
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Hiba a törlés során!");
        }
    }
}

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

/* ESZKÖZ MODAL ÉS KÉP */
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

function generateRandomBarcode() {
    const rand = "BND-" + Math.floor(100000 + Math.random() * 900000);
    document.getElementById("devBarcode").value = rand;
}

function openAddModal(id = null) {
    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_devices !== false;
    if (!canEdit) {
        alert("Nincs jogosultságod eszközök szerkesztésére vagy hozzáadására!");
        return;
    }

    document.getElementById("deviceForm").reset();
    document.getElementById("deviceId").value = "";
    removeDeviceImage();
    currentEditingDeviceInventory = [];

    const labelEl = document.getElementById("formInventoryCountLabel");
    const btnEl = document.getElementById("formOpenInvModalBtn");

    if (id) {
        const dev = appData.devices.find(d => d.id === id);
        if (dev) {
            document.getElementById("modalTitle").innerText = "Eszköz Módosítása";
            document.getElementById("deviceId").value = dev.id;
            document.getElementById("devName").value = dev.name;
            document.getElementById("devCat").value = dev.cat || 'Hangtechnika';
            document.getElementById("devStatus").value = dev.status || 'in_stock';
            document.getElementById("devBarcode").value = dev.barcode || '';
            document.getElementById("devRackId").value = dev.rack_id || '';
            document.getElementById("devNotes").value = dev.notes || '';

            currentEditingDeviceInventory = Array.isArray(dev.inventory) ? [...dev.inventory] : [];
            const invLen = currentEditingDeviceInventory.length;
            labelEl.innerText = `${invLen} tétel van hozzárendelve ehhez a rackhez.`;
            btnEl.disabled = false;
            btnEl.classList.remove("opacity-50", "cursor-not-allowed");

            if (dev.image) {
                document.getElementById("devImageData").value = dev.image;
                document.getElementById("imagePreview").src = dev.image;
                document.getElementById("imagePreviewContainer").classList.remove("hidden");
            }
        }
    } else {
        document.getElementById("modalTitle").innerText = "Új Eszköz Rögzítése";
        generateRandomBarcode();
        labelEl.innerText = "Mentés után a dedikált gombbal tölthetsz fel belső leltárt.";
        btnEl.disabled = true;
        btnEl.classList.add("opacity-50", "cursor-not-allowed");
    }

    document.getElementById("deviceModal").classList.remove("hidden");
    document.getElementById("deviceModal").classList.add("flex");
}
function closeModal() { document.getElementById("deviceModal").classList.add("hidden"); }

function openRackInventoryFromForm() {
    const devId = document.getElementById("deviceId").value;
    if (devId) {
        closeModal();
        openRackInventoryModal(devId);
    }
}

async function saveDevice(e) {
    e.preventDefault();
    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_devices !== false;
    if (!canEdit) {
        alert("Nincs szerkesztési jogosultságod!");
        closeModal();
        return;
    }

    const id = document.getElementById("deviceId").value;
    const existingDev = id ? appData.devices.find(d => d.id === id) : null;
    const inventory = existingDev && Array.isArray(existingDev.inventory) ? existingDev.inventory : [];

    const devData = {
        id: id ? id : "dev_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
        name: document.getElementById("devName").value.trim(),
        cat: document.getElementById("devCat").value,
        status: document.getElementById("devStatus").value,
        barcode: document.getElementById("devBarcode").value.trim(),
        rack_id: document.getElementById("devRackId").value.trim(),
        inventory: inventory,
        image: document.getElementById("devImageData").value || "",
        notes: document.getElementById("devNotes").value.trim()
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
    const perms = userPermissions.permissions || {};
    const canDelete = userPermissions.is_superadmin || perms.can_delete_devices !== false;
    if (!canDelete) {
        alert("Nincs jogosultságod eszköz törlésére!");
        return;
    }

    if (confirm("Biztosan törlöd ezt az eszközt a leltárból?")) {
        appData.devices = appData.devices.filter(d => d.id !== id);
        await saveData();
    }
}

function openDeviceImageViewer(devId) {
    const dev = appData.devices.find(d => d.id === devId);
    if (dev && dev.image) {
        openImageViewer(dev.image);
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

async function editTitle() {
    const perms = userPermissions.permissions || {};
    if (!userPermissions.is_superadmin && perms.can_edit_devices === false) {
        alert("Nincs módosítási jogosultságod!");
        return;
    }

    const newTitle = prompt("Új főcím:", appData.title);
    if (newTitle !== null) {
        appData.title = newTitle;
        await saveData();
    }
}

/* KAMERÁS CSIPPANTÓ */
function toggleScanMode() {
    const mode = document.getElementById("scanModeSelect").value;
    const btnContainer = document.getElementById("manualScanBtnContainer");
    if (mode === 'manual') btnContainer.classList.remove("hidden");
    else btnContainer.classList.add("hidden");
}

function openScannerModal() {
    document.getElementById("scannerModal").classList.remove("hidden");
    document.getElementById("scannerModal").classList.add("flex");
    document.getElementById("scanResultCard").classList.add("hidden");
    
    isScanCooldown = false;
    pendingScanResult = null;
    lastScannedCode = null;
    lastScannedTime = 0;
    toggleScanMode();

    setTimeout(() => {
        if (!html5QrCodeScanner) {
            html5QrCodeScanner = new Html5Qrcode("reader");
        }
        html5QrCodeScanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            onScanSuccess,
            () => {}
        ).catch(err => {
            console.log("Kamera nem elérhető:", err);
        });
    }, 300);
}

function closeScannerModal() {
    if (html5QrCodeScanner) {
        html5QrCodeScanner.stop().then(() => {
            document.getElementById("scannerModal").classList.add("hidden");
            document.getElementById("scannerModal").classList.remove("flex");
        }).catch(() => {
            document.getElementById("scannerModal").classList.add("hidden");
            document.getElementById("scannerModal").classList.remove("flex");
        });
    } else {
        document.getElementById("scannerModal").classList.add("hidden");
        document.getElementById("scannerModal").classList.remove("flex");
    }
}

function onScanSuccess(decodedText) {
    const scanMode = document.getElementById("scanModeSelect").value;
    if (scanMode === 'manual') {
        pendingScanResult = decodedText;
        return;
    }
    if (isScanCooldown) return;

    const now = Date.now();
    // 2.5 mp védelmi debounce duplikált beolvasás ellen 0 mp cooldown választásakor is
    if (decodedText === lastScannedCode && (now - lastScannedTime) < 2500) {
        return;
    }

    lastScannedCode = decodedText;
    lastScannedTime = now;

    let cooldownSec = parseInt(document.getElementById("scanCooldownSelect").value, 10);
    if (isNaN(cooldownSec) || cooldownSec < 2) {
        cooldownSec = 2;
    }

    processScannedCode(decodedText);
    startScanCooldown(cooldownSec);
}

function handleManualBarcodeSubmit(e) {
    e.preventDefault();
    const code = document.getElementById("manualBarcodeInput").value.trim();
    if (code) {
        processScannedCode(code);
        document.getElementById("manualBarcodeInput").value = "";
    }
}

function triggerManualScan() {
    if (!pendingScanResult) {
        alert("Irányítsd a kamerát egy kódra!");
        return;
    }
    if (isScanCooldown) return;

    let cooldownSec = parseInt(document.getElementById("scanCooldownSelect").value, 10);
    if (isNaN(cooldownSec) || cooldownSec < 2) {
        cooldownSec = 2;
    }

    processScannedCode(pendingScanResult);
    pendingScanResult = null;
    startScanCooldown(cooldownSec);
}

function startScanCooldown(seconds) {
    isScanCooldown = true;
    let remaining = seconds;

    const resultCard = document.getElementById("scanResultCard");
    let cooldownDiv = document.getElementById("cooldownTimerBadge");
    if (!cooldownDiv) {
        cooldownDiv = document.createElement("div");
        cooldownDiv.id = "cooldownTimerBadge";
        cooldownDiv.className = "text-center text-[10px] font-bold text-amber-500 ui-panel p-1.5 rounded border border-amber-500/40 mt-1.5 font-mono";
        resultCard.appendChild(cooldownDiv);
    }
    cooldownDiv.innerText = `Következő csippantás: ${remaining}mp...`;

    const interval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            const badge = document.getElementById("cooldownTimerBadge");
            if (badge) badge.innerText = `Következő csippantás: ${remaining}mp...`;
        } else {
            clearInterval(interval);
            isScanCooldown = false;
            const badge = document.getElementById("cooldownTimerBadge");
            if (badge) badge.remove();
        }
    }, 1000);
}

function processScannedCode(code) {
    const dev = appData.devices.find(d => 
        (d.barcode && d.barcode.toLowerCase() === code.toLowerCase()) || 
        (d.rack_id && d.rack_id.toLowerCase() === code.toLowerCase()) ||
        d.id === code
    );

    const resultCard = document.getElementById("scanResultCard");
    resultCard.classList.remove("hidden");

    if (!dev) {
        resultCard.className = "bg-rose-950/40 border border-rose-500/40 p-3 rounded text-center space-y-1";
        resultCard.innerHTML = `
            <div class="text-rose-400 font-bold flex items-center justify-center gap-1.5 text-xs">
                <i class="fa-solid fa-triangle-exclamation"></i> Ismeretlen Kód: <span class="font-mono underline">${escapeHtml(code)}</span>
            </div>
            <p class="text-[10px] text-[var(--text-muted)]">Nincs ilyen eszköz a zenekari leltárban!</p>
        `;
        return;
    }

    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_devices !== false;
    
    // Viewer felhasználó esetén nem módosítjuk a státuszt
    if (!canEdit) {
        resultCard.className = "bg-amber-950/50 border border-amber-500/50 p-3 rounded text-center space-y-1";
        resultCard.innerHTML = `
            <div class="text-amber-400 font-bold flex items-center justify-center gap-1.5 text-xs">
                <i class="fa-solid fa-eye"></i> Megfigyelő (Viewer) Mód
            </div>
            <p class="text-[10px] text-[var(--text-secondary)]">Eszköz azonosítva: <strong class="text-white">${escapeHtml(dev.name)}</strong> (Státusz módosításához szerkesztői jog szükséges!)</p>
        `;
        return;
    }

    // Szervizben vagy beszerzés alatt lévő eszköz védelme
    if (dev.status === 'repair' || dev.status === 'ordered') {
        const statusName = dev.status === 'repair' ? "SZERVIZBEN" : "BESZERZÉS ALATT";
        if (!confirm(`Figyelem! A(z) "${dev.name}" eszköz jelenleg ${statusName} státuszban van.\nBiztosan visszahelyezed raktárba?`)) {
            resultCard.className = "bg-blue-950/50 border border-blue-500/50 p-3 rounded text-center space-y-1";
            resultCard.innerHTML = `
                <div class="text-blue-300 font-bold flex items-center justify-center gap-1.5 text-xs">
                    <i class="fa-solid fa-info-circle"></i> Státusz nem módosult
                </div>
                <p class="text-[10px] text-[var(--text-secondary)]">${escapeHtml(dev.name)} megmaradt <strong>${statusName}</strong> állapotban.</p>
            `;
            return;
        }
    }

    const oldStatus = dev.status;
    const newStatus = (oldStatus === 'in_stock') ? 'away' : 'in_stock';
    dev.status = newStatus;
    saveData();

    let statusText = newStatus === 'away' ? 'ELVÍVE / KONCERTRE KIKÉRVE' : 'VISSZAHOZVA A RAKTÁRBA';
    let bgClass = newStatus === 'away' ? 'bg-amber-950/50 border-amber-500/50 text-amber-300' : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300';

    resultCard.className = `${bgClass} border p-3 rounded space-y-1.5`;
    resultCard.innerHTML = `
        <div class="flex items-center justify-between border-b border-[var(--border-color)] pb-1">
            <span class="text-[9px] font-bold uppercase tracking-wider font-mono">Csippantva</span>
            <span class="font-mono text-[10px]">${escapeHtml(dev.barcode || dev.rack_id)}</span>
        </div>
        <div class="flex items-center gap-2">
            <div class="p-1.5 ui-panel rounded text-white"><i class="fa-solid fa-box text-base"></i></div>
            <div>
                <h4 class="font-bold text-[var(--text-primary)] text-xs">${escapeHtml(dev.name)}</h4>
                <p class="text-[10px] font-semibold">${statusText}</p>
            </div>
        </div>
    `;
}

/* CÍMKE ÉS RACK NYOMTATÓ */
function openLabelDesignerForDevice(id) {
    openLabelDesignerModal(id);
}

function openLabelDesignerModal(selectedDevId = null) {
    const select = document.getElementById("labelDeviceSelect");
    select.innerHTML = "";
    
    if (appData.devices.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.innerText = "Nincs még eszköz felvéve";
        select.appendChild(opt);
    } else {
        appData.devices.forEach(d => {
            const opt = document.createElement("option");
            opt.value = d.id;
            opt.innerText = `${d.name} (${d.rack_id || d.barcode || 'Nincs ID'})`;
            if (selectedDevId && d.id === selectedDevId) opt.selected = true;
            select.appendChild(opt);
        });
    }

    document.getElementById("labelDesignerModal").classList.remove("hidden");
    document.getElementById("labelDesignerModal").classList.add("flex");
    updateLabelPreview();
}

function closeLabelDesignerModal() {
    document.getElementById("labelDesignerModal").classList.add("hidden");
    document.getElementById("labelDesignerModal").classList.remove("flex");
}

function updateLabelPreview() {
    const devId = document.getElementById("labelDeviceSelect").value;
    const bandName = document.getElementById("labelBandName").value || "SPEKTRUM BAND";
    const labelType = document.getElementById("labelType").value;
    const codeType = document.getElementById("labelCodeType").value;
    const extraText = document.getElementById("labelExtraText").value;

    const dev = appData.devices.find(d => d.id === devId) || {
        name: "Minta Rack Keverő",
        cat: "Hangtechnika",
        rack_id: "RACK-01",
        barcode: "BND-1001",
        inventory: []
    };

    document.getElementById("prevBandName").innerText = bandName;
    document.getElementById("prevRackId").innerText = dev.rack_id ? `RACK / ID: ${dev.rack_id}` : `ID: ${dev.barcode || 'BND-1001'}`;
    document.getElementById("prevDevName").innerText = dev.name;
    document.getElementById("prevDevDept").innerText = dev.cat || "Technika";
    document.getElementById("prevExtraText").innerText = extraText;

    const printBox = document.getElementById("printableArea");
    const prevInvContainer = document.getElementById("prevInventoryContainer");
    const prevInvBody = document.getElementById("prevInventoryTableBody");

    if (labelType === 'rack_sheet') {
        printBox.style.width = "100%";
        printBox.style.maxWidth = "480px";
        prevInvContainer.classList.remove("hidden");

        prevInvBody.innerHTML = "";
        if (Array.isArray(dev.inventory) && dev.inventory.length > 0) {
            dev.inventory.forEach(i => {
                const tr = document.createElement("tr");
                tr.className = "border-b border-gray-200";
                tr.innerHTML = `
                    <td class="py-0.5 text-left font-medium">${escapeHtml(i.name)}</td>
                    <td class="py-0.5 text-center font-mono">${escapeHtml(i.qty || '1db')}</td>
                    <td class="py-0.5 text-right font-bold">${escapeHtml(i.condition || 'Jó')}</td>
                `;
                prevInvBody.appendChild(tr);
            });
        } else {
            prevInvBody.innerHTML = `<tr><td colspan="3" class="py-1 text-center text-gray-500 italic">Nincsenek egyedi tételek felvéve.</td></tr>`;
        }
    } else {
        prevInvContainer.classList.add("hidden");
        if (labelType === 'rack') {
            printBox.style.width = "320px";
        } else if (labelType === 'cable') {
            printBox.style.width = "220px";
        } else if (labelType === 'qr') {
            printBox.style.width = "240px";
        }
    }

    const codeValue = dev.barcode || dev.rack_id || dev.id || "BND-1001";
    const barcodeSvg = document.getElementById("barcodeCanvas");
    const qrcodeDiv = document.getElementById("qrcodeCanvas");

    if (codeType === 'barcode') {
        barcodeSvg.classList.remove("hidden");
        qrcodeDiv.classList.add("hidden");
        barcodeSvg.innerHTML = ""; // Korábbi SVG kitörlése
        try {
            JsBarcode("#barcodeCanvas", codeValue, {
                format: "CODE128",
                width: 1.5,
                height: 35,
                displayValue: true,
                fontSize: 9,
                margin: 2
            });
        } catch (e) {
            console.error("Barcode hiba:", e);
            barcodeSvg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="red" font-size="10">Érvénytelen kód (CODE128)</text>`;
        }
    } else {
        barcodeSvg.classList.add("hidden");
        barcodeSvg.innerHTML = "";
        qrcodeDiv.classList.remove("hidden");
        qrcodeDiv.innerHTML = "";
        try {
            new QRCode(qrcodeDiv, {
                text: codeValue,
                width: 65,
                height: 65
            });
        } catch (e) {
            console.error("QR hiba:", e);
            qrcodeDiv.innerHTML = `<span class="text-rose-500 text-[9px]">QR Hiba</span>`;
        }
    }
}

function printGeneratedLabel() { window.print(); }

initTheme();
restoreSidebarState();
checkPasswordResetTokenInUrl();
checkAuth();