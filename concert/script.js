let currentDb = "turne_2026";
let userPermissions = { username: "", display_name: "", email: "", is_superadmin: false, role: "editor", role_name: "Szervező", permissions: {}, databases: [], all_databases: [], preferred_db: "turne_2026", system_default_db: "turne_2026" };
let appData = { title: "Turné 2026", subtitle: "Koncertmenedzsment", concerts: [] };
let currentSessionId = localStorage.getItem("session_id") || "";
let availableRoles = {};

function initTheme() {
    const savedTheme = localStorage.getItem("concert_theme") || "dark";
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    const isLight = (theme === 'light');
    if (isLight) document.body.classList.add('theme-light');
    else document.body.classList.remove('theme-light');
    localStorage.setItem("concert_theme", theme);
    
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

function toggleSidebar() {
    const sidebar = document.getElementById("mainSidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (window.innerWidth < 768) {
        if (sidebar.classList.contains("sidebar-mobile-open")) {
            sidebar.classList.remove("sidebar-mobile-open");
            backdrop.classList.add("hidden");
        } else {
            sidebar.classList.add("sidebar-mobile-open");
            backdrop.classList.remove("hidden");
        }
    } else {
        sidebar.classList.toggle("sidebar-collapsed");
    }
}

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
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
        document.getElementById("authSubtitle").innerText = "Turné & Produkció Rendszer";
    }
}

window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.getElementById("searchInput").focus();
    } else if (e.key === "Escape") {
        closeModal();
        closeProfileModal();
        closeSettingsModal();
        closeUserAdminModal();
        closeDbAdminModal();
        closeRequestDbModal();
        closeForgotPwModal();
    } else if (e.key.toLowerCase() === "n" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        e.preventDefault();
        openAddModal();
    }
});

async function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (currentSessionId) options.headers['Authorization'] = `Bearer ${currentSessionId}`;
    return fetch(url, options);
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

    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (res.ok) {
        currentSessionId = data.session_id;
        localStorage.setItem("session_id", data.session_id);
        errEl.classList.add("hidden");
        checkAuth();
    } else {
        errEl.innerText = data.error || "Hiba!";
        errEl.classList.remove("hidden");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: document.getElementById("regUsername").value,
            display_name: document.getElementById("regDisplayName").value,
            email: document.getElementById("regEmail").value,
            password: document.getElementById("regPassword").value
        })
    });
    const data = await res.json();
    const msgEl = document.getElementById("regMsg");
    msgEl.innerText = data.message || data.error;
    msgEl.className = res.ok ? "text-[11px] text-emerald-500 font-mono" : "text-[11px] text-rose-500 font-mono";
    msgEl.classList.remove("hidden");
}

async function handleLogout() {
    await authFetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem("session_id");
    window.location.reload();
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
    const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: document.getElementById("forgotIdentifier").value })
    });
    const data = await res.json();
    document.getElementById("forgotMsg").innerText = data.message;
    document.getElementById("forgotMsg").classList.remove("hidden");
}

async function handleExecutePasswordReset(e) {
    e.preventDefault();
    const token = document.getElementById("resetTokenValue").value;
    const p1 = document.getElementById("resetNewPassword").value;
    const p2 = document.getElementById("resetConfirmPassword").value;
    const msgEl = document.getElementById("resetMsg");

    if (p1 !== p2) {
        msgEl.innerText = "A jelszavak nem egyeznek!";
        msgEl.className = "text-[11px] text-rose-500 font-mono";
        msgEl.classList.remove("hidden");
        return;
    }

    const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: p1 })
    });
    const data = await res.json();
    if (res.ok) {
        alert(data.message || "Jelszó frissítve!");
        window.location.hash = "";
        document.getElementById("resetPwModal").classList.add("hidden");
        checkAuth();
    } else {
        msgEl.innerText = data.error || "Hiba!";
        msgEl.className = "text-[11px] text-rose-500 font-mono";
        msgEl.classList.remove("hidden");
    }
}

async function loadUserInfo() {
    const res = await authFetch('/api/user/info');
    userPermissions = await res.json();

    const displayName = userPermissions.display_name || userPermissions.username;
    document.getElementById("headerDisplayName").innerText = displayName;
    document.getElementById("headerUsername").innerText = userPermissions.username;
    document.getElementById("userAvatarLetter").innerText = displayName.charAt(0).toUpperCase();
    document.getElementById("headerRoleBadge").innerText = userPermissions.role_name || userPermissions.role.toUpperCase();

    const isSuper = userPermissions.is_superadmin;
    const perms = userPermissions.permissions || {};

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

    if (!isSuper && perms.can_edit_concerts === false) {
        document.getElementById("addConcertBtn").style.display = 'none';
        document.getElementById("editTitleBtn").style.display = 'none';
    } else {
        document.getElementById("addConcertBtn").style.display = 'flex';
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

    if (userPermissions.preferred_db && userPermissions.databases.includes(userPermissions.preferred_db)) currentDb = userPermissions.preferred_db;
    else if (userPermissions.databases.includes(userPermissions.system_default_db)) currentDb = userPermissions.system_default_db;
    else if (userPermissions.databases.length > 0) currentDb = userPermissions.databases[0];
    else currentDb = "turne_2026";
    dbSelect.value = currentDb;

    loadData();
}

async function switchDatabase(dbName) {
    currentDb = dbName;
    loadData();
}

async function loadData() {
    try {
        const res = await authFetch(`/api/data?db=${currentDb}&_t=${Date.now()}`);
        appData = await res.json();
        if (!appData.concerts) appData.concerts = [];
        render();
    } catch (err) {
        console.error("Adatbetöltési hiba:", err);
    }
}

async function saveData() {
    try {
        await authFetch(`/api/data?db=${currentDb}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appData, null, 2)
        });
        render();
    } catch (err) {
        alert("Mentési hiba!");
    }
}

async function toggleTask(taskId, isDone) {
    await authFetch('/api/task/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, is_done: isDone })
    });
    loadData();
}

function render() {
    document.getElementById("appTitleDisplay").innerText = appData.title || "Turné 2026";
    document.getElementById("appSubtitleDisplay").innerText = appData.subtitle || "Koncertmenedzsment";

    const search = document.getElementById("searchInput").value.toLowerCase();
    const statusF = document.getElementById("statusFilter").value;
    const perms = userPermissions.permissions || {};
    const canEdit = userPermissions.is_superadmin || perms.can_edit_concerts !== false;
    const canDelete = userPermissions.is_superadmin || perms.can_delete_concerts !== false;

    const filteredConcerts = appData.concerts.filter(c => {
        const matchTasks = Array.isArray(c.tasks) && c.tasks.some(t => t.text.toLowerCase().includes(search));
        const matchSearch = c.title.toLowerCase().includes(search) || 
                            (c.city && c.city.toLowerCase().includes(search)) || 
                            (c.venue && c.venue.toLowerCase().includes(search)) ||
                            matchTasks;
        const matchStatus = !statusF || c.status === statusF;
        return matchSearch && matchStatus;
    });

    document.getElementById("statTotal").innerText = appData.concerts.length;
    document.getElementById("statPlanned").innerText = appData.concerts.filter(c => c.status === 'planned').length;
    document.getElementById("statConfirmed").innerText = appData.concerts.filter(c => c.status === 'confirmed').length;

    let pendingCount = 0;
    appData.concerts.forEach(c => {
        if (Array.isArray(c.tasks)) pendingCount += c.tasks.filter(t => !t.is_done).length;
    });
    document.getElementById("statPendingTasks").innerText = pendingCount;

    const contentArea = document.getElementById("contentArea");
    contentArea.innerHTML = "";

    if (filteredConcerts.length === 0) {
        contentArea.innerHTML = `<div class="ui-panel border rounded-md p-6 text-center text-[var(--text-muted)] font-mono text-[11px]">Nincs koncert a megadott szűrésnek megfelelően.</div>`;
        return;
    }

    const card = document.createElement("div");
    card.className = "ui-panel border rounded-md overflow-hidden shadow-sm";

    let rowsHTML = "";
    filteredConcerts.forEach(c => {
        let statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">Tervezett</span>';
        if (c.status === 'confirmed') statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">Visszaigazolt</span>';
        else if (c.status === 'done') statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">Megvalósult</span>';
        else if (c.status === 'cancelled') statusBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">Lemondva</span>';

        let tasksHTML = '';
        if (Array.isArray(c.tasks) && c.tasks.length > 0) {
            tasksHTML = c.tasks.map(t => `
                <label class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded ui-subtle border border-[var(--border-color)] text-[10px] cursor-pointer hover:bg-[var(--panel-hover)]">
                    <input type="checkbox" onchange="toggleTask(${Number(t.id) || 0}, this.checked)" ${esc(t.is_done ? 'checked' : '')} class="rounded text-blue-600">
                    <span class="${esc(t.is_done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)] font-medium')}">${esc(t.text)}</span>
                </label>
            `).join('');
        }

        rowsHTML += `
            <tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition align-top">
                <td class="px-3 py-2 whitespace-nowrap font-mono text-[11px] font-bold text-[var(--text-primary)]">
                    ${esc(c.concert_date || '—')}
                    <div class="text-[9px] text-[var(--text-muted)] font-normal">${esc(c.show_time ? 'Kezdés: ' + c.show_time : '')}</div>
                </td>
                <td class="px-3 py-2">
                    <div class="font-bold text-[var(--text-primary)] text-xs flex items-center gap-2">
                        <span>${esc(c.title)}</span>
                        ${statusBadge}
                    </div>
                    <div class="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        <i class="fa-solid fa-location-dot text-rose-500 mr-1"></i> ${esc(c.city || '')} &bull; ${esc(c.venue || '')}
                    </div>
                    ${tasksHTML ? `<div class="mt-2 flex flex-wrap gap-1.5 items-center">${tasksHTML}</div>` : ''}
                </td>
                <td class="px-3 py-2 text-[var(--text-secondary)] whitespace-nowrap text-[11px] font-mono">
                    ${c.contact_name ? `<div>${esc(c.contact_name)}</div>` : ''}
                    ${c.contact_phone ? `<div class="text-[10px] text-[var(--text-muted)]">${esc(c.contact_phone)}</div>` : '—'}
                </td>
                <td class="px-3 py-2 text-[var(--text-secondary)] text-[11px] font-mono max-w-xs truncate">
                    ${esc(c.notes || '—')}
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                    <div class="inline-flex items-center gap-2">
                        ${canEdit ? `<button onclick="openAddModal(${jsq(c.id)})" class="text-[var(--text-muted)] hover:text-blue-500" title="Szerkesztés"><i class="fa-solid fa-pen"></i></button>` : ''}
                        ${canDelete ? `<button onclick="deleteConcert(${jsq(c.id)})" class="text-[var(--text-muted)] hover:text-rose-500" title="Törlés"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    card.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider ui-panel">
                        <th class="px-3 py-1.5">Dátum</th>
                        <th class="px-3 py-1.5">Koncert, Helyszín & Teendők</th>
                        <th class="px-3 py-1.5">Kapcsolat</th>
                        <th class="px-3 py-1.5">Megjegyzés</th>
                        <th class="px-3 py-1.5 text-right">Művelet</th>
                    </tr>
                </thead>
                <tbody>${rowsHTML}</tbody>
            </table>
        </div>
    `;
    contentArea.appendChild(card);
}

function addTaskRow(text = "", isDone = false) {
    const container = document.getElementById("tasksContainer");
    const div = document.createElement("div");
    div.className = "flex items-center gap-2 task-input-row";
    div.innerHTML = `
        <input type="checkbox" ${esc(isDone ? 'checked' : '')} class="task-done rounded text-blue-600">
        <input type="text" value="${esc(text)}" placeholder="pl. Rider és Stage Plan elküldve, szállás..." class="task-text form-control flex-1 rounded px-2 py-1">
        <button type="button" onclick="this.closest('.task-input-row').remove()" class="text-[var(--text-muted)] hover:text-rose-500"><i class="fa-solid fa-xmark"></i></button>
    `;
    container.appendChild(div);
}

function getTasksFromForm() {
    const rows = document.querySelectorAll(".task-input-row");
    const tasks = [];
    rows.forEach(r => {
        const text = r.querySelector(".task-text").value.trim();
        const isDone = r.querySelector(".task-done").checked;
        if (text) tasks.push({ text, is_done: isDone });
    });
    return tasks;
}

function openAddModal(id = null) {
    document.getElementById("concertForm").reset();
    document.getElementById("concertId").value = "";
    document.getElementById("tasksContainer").innerHTML = "";

    if (id) {
        const c = appData.concerts.find(item => item.id === id);
        if (c) {
            document.getElementById("modalTitle").innerText = "Koncert Módosítása";
            document.getElementById("concertId").value = c.id;
            document.getElementById("cTitle").value = c.title;
            document.getElementById("cStatus").value = c.status || 'planned';
            document.getElementById("cCity").value = c.city || '';
            document.getElementById("cVenue").value = c.venue || '';
            document.getElementById("cDate").value = c.concert_date || '';
            document.getElementById("cGateOpen").value = c.gate_open || '';
            document.getElementById("cShowTime").value = c.show_time || '';
            document.getElementById("cContactName").value = c.contact_name || '';
            document.getElementById("cContactPhone").value = c.contact_phone || '';
            document.getElementById("cNotes").value = c.notes || '';

            if (Array.isArray(c.tasks)) {
                c.tasks.forEach(t => addTaskRow(t.text, t.is_done));
            }
        }
    } else {
        document.getElementById("modalTitle").innerText = "Új Koncert Rögzítése";
        addTaskRow("Technikai rider és stage plan elküldve", false);
        addTaskRow("Szállás és utazás megszervezve", false);
        addTaskRow("Plakát és promóciós anyagok jóváhagyva", false);
    }

    document.getElementById("concertModal").classList.remove("hidden");
    document.getElementById("concertModal").classList.add("flex");
}
function closeModal() { 
    document.getElementById("concertModal").classList.add("hidden"); 
    document.getElementById("concertModal").classList.remove("flex"); 
}

async function saveConcert(e) {
    e.preventDefault();
    const id = document.getElementById("concertId").value;
    const cData = {
        id: id ? id : "c_" + Date.now(),
        title: document.getElementById("cTitle").value,
        status: document.getElementById("cStatus").value,
        city: document.getElementById("cCity").value,
        venue: document.getElementById("cVenue").value,
        concert_date: document.getElementById("cDate").value,
        gate_open: document.getElementById("cGateOpen").value,
        show_time: document.getElementById("cShowTime").value,
        contact_name: document.getElementById("cContactName").value,
        contact_phone: document.getElementById("cContactPhone").value,
        notes: document.getElementById("cNotes").value,
        tasks: getTasksFromForm()
    };

    if (id) {
        const idx = appData.concerts.findIndex(item => item.id === id);
        if (idx !== -1) appData.concerts[idx] = cData;
    } else {
        appData.concerts.push(cData);
    }

    closeModal();
    await saveData();
}

async function deleteConcert(id) {
    if (confirm("Biztosan törlöd ezt a koncertet a turnéból?")) {
        appData.concerts = appData.concerts.filter(c => c.id !== id);
        await saveData();
    }
}

function exportToCSV() {
    if (appData.concerts.length === 0) return alert("Nincs exportálható koncert!");
    const headers = ["ID", "Datum", "Koncert_Neve", "Statusz", "Varos", "Helyszin", "Kezdes", "Felelos", "Telefon", "Jegyzet"];
    const rows = appData.concerts.map(c => [
        c.id, c.concert_date || "", `"${(c.title || "").replace(/"/g, '""')}"`, c.status,
        `"${(c.city || "").replace(/"/g, '""')}"`, `"${(c.venue || "").replace(/"/g, '""')}"`,
        c.show_time || "", `"${(c.contact_name || "").replace(/"/g, '""')}"`, c.contact_phone || "", `"${(c.notes || "").replace(/"/g, '""')}"`
    ]);
    const csv = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `turne_${currentDb}_${Date.now()}.csv`;
    link.click();
}

/* 1. FIÓKBEÁLLÍTÁSOK */
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

function switchProfileTab(tab) {
    document.getElementById("profTabGeneral").classList.toggle("hidden", tab !== 'general');
    document.getElementById("profTabSecurity").classList.toggle("hidden", tab !== 'security');
    document.getElementById("profTabSessions").classList.toggle("hidden", tab !== 'sessions');

    const defClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-hover)] flex items-center gap-2";
    const actClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-white bg-[#1f6feb] flex items-center gap-2";

    document.getElementById("profTabBtnGeneral").className = tab === 'general' ? actClass : defClass;
    document.getElementById("profTabBtnSecurity").className = tab === 'security' ? actClass : defClass;
    document.getElementById("profTabBtnSessions").className = tab === 'sessions' ? actClass : defClass;
}

async function handleUpdateProfile(e) {
    e.preventDefault();
    const res = await authFetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            new_username: document.getElementById("profInputUsername").value.trim(),
            display_name: document.getElementById("profInputDisplayName").value.trim(),
            email: document.getElementById("profInputEmail").value.trim()
        })
    });
    const data = await res.json();
    if (res.ok) { 
        alert(data.message || "Profil mentve!"); 
        loadUserInfo(); 
    } else {
        alert(data.error || "Hiba a mentéskor!");
    }
}

async function handleProfilePasswordChange(e) {
    e.preventDefault();
    const res = await authFetch('/api/user/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            old_password: document.getElementById("profOldPassword").value,
            new_password: document.getElementById("profNewPassword").value
        })
    });
    const data = await res.json();
    if (res.ok) {
        alert("Jelszó sikeresen frissítve!");
        document.getElementById("profOldPassword").value = "";
        document.getElementById("profNewPassword").value = "";
        switchProfileTab('general');
    } else {
        alert(data.error || "Hiba a jelszó módosításakor!");
    }
}

/* 2. RENDSZER BEÁLLÍTÁSOK */
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

    const currentTheme = localStorage.getItem("concert_theme") || "dark";
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
        alert("Beállítások elmentve!");
        closeSettingsModal();
        await loadUserInfo();
    } else {
        alert(data.error || "Hiba!");
    }
}

/* 3. FŐADMINISZTRÁCIÓ (RBAC, USEREK, PARTÍCIÓK) */
function switchAdminTab(tab) {
    document.getElementById("adminTabUsers").classList.add("hidden");
    document.getElementById("adminTabRoles").classList.add("hidden");
    document.getElementById("adminTabDatabases").classList.add("hidden");
    document.getElementById("adminTabRequests").classList.add("hidden");

    const defClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-hover)] flex items-center gap-2";
    const actClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-white bg-[#1f6feb] flex items-center gap-2";

    document.getElementById("tabBtnUsers").className = (tab === 'users') ? actClass : defClass;
    document.getElementById("tabBtnRoles").className = (tab === 'roles') ? actClass : defClass;
    document.getElementById("tabBtnDatabases").className = (tab === 'databases') ? actClass : defClass;
    document.getElementById("tabBtnRequests").className = (tab === 'requests') ? actClass : defClass;

    if (tab === 'users') document.getElementById("adminTabUsers").classList.remove("hidden");
    else if (tab === 'roles') document.getElementById("adminTabRoles").classList.remove("hidden");
    else if (tab === 'databases') document.getElementById("adminTabDatabases").classList.remove("hidden");
    else if (tab === 'requests') document.getElementById("adminTabRequests").classList.remove("hidden");
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

    const roleSelect = document.getElementById("newRole");
    roleSelect.innerHTML = "";
    Object.keys(availableRoles).forEach(rKey => {
        const r = availableRoles[rKey];
        const opt = document.createElement("option");
        opt.value = rKey;
        opt.innerText = `${r.name} (${rKey})`;
        roleSelect.appendChild(opt);
    });

    // Szerepkörök listája
    const roleContainer = document.getElementById("roleListContainer");
    roleContainer.innerHTML = "";
    Object.keys(availableRoles).forEach(rKey => {
        const r = availableRoles[rKey];
        const card = document.createElement("div");
        card.className = "flex items-center justify-between p-2.5 ui-panel border border-[var(--border-color)] rounded text-xs";
        
        const permsArr = [];
        if (r.permissions.can_edit_concerts) permsArr.push("Szerkesztés");
        if (r.permissions.can_delete_concerts) permsArr.push("Törlés");
        if (r.permissions.can_manage_dbs) permsArr.push("Turné Admin");
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

    // Turnék / Partíciók listája
    const dbContainer = document.getElementById("dbListContainer");
    dbContainer.innerHTML = "";
    (data.all_databases || []).forEach(db => {
        const item = document.createElement("div");
        item.className = "flex items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs";
        item.innerHTML = `
            <span class="font-mono text-[var(--text-primary)]"><i class="fa-solid fa-route mr-2 text-[var(--text-muted)]"></i>${esc(db.toUpperCase())}</span>
            <div class="flex items-center gap-2">
                <button onclick="switchDatabase(${jsq(db)}); closeUserAdminModal();" class="text-xs text-blue-500 hover:underline">Megnyitás</button>
                ${db !== 'turne_2026' ? `<button onclick="deleteDatabase(${jsq(db)})" class="text-[var(--text-muted)] hover:text-rose-500 ml-2"><i class="fa-solid fa-trash"></i></button>` : '<span class="text-[10px] text-[var(--text-muted)] font-mono ml-2">[Alapértelmezett]</span>'}
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
                <div>
                    <div class="font-semibold text-[var(--text-primary)]">${esc(u.display_name || u.username)}</div>
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

    // Munkatársak listája
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
                Turnék: <span class="font-semibold text-[var(--text-primary)]">${esc(u.databases.join(", ") || "Nincs")}</span>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="editUser(${jsq(u.username)}, ${jsq(u.display_name || '')}, ${jsq(u.email || '')}, ${jsq(u.role)}, ${jsq(u.databases.join(","))})" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><i class="fa-solid fa-pen"></i></button>
                ${userPermissions.is_superadmin && !u.is_superadmin ? `<button onclick="deleteUser(${jsq(u.username)})" class="text-[var(--text-muted)] hover:text-rose-500 ml-1"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
        `;
        uContainer.appendChild(card);
    });

    // Turné választó a felhasználó szerkesztőben
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

function editRole(rKey) {
    const r = availableRoles[rKey];
    if (!r) return;

    document.getElementById("roleKeyInput").value = rKey;
    document.getElementById("roleKeyInput").readOnly = true;
    document.getElementById("roleNameInput").value = r.name || '';
    document.getElementById("roleDescInput").value = r.description || '';

    const perms = r.permissions || {};
    document.getElementById("permEditConcerts").checked = !!perms.can_edit_concerts;
    document.getElementById("permDeleteConcerts").checked = !!perms.can_delete_concerts;
    document.getElementById("permManageDbs").checked = !!perms.can_manage_dbs;
    document.getElementById("permAccessAdmin").checked = !!perms.can_access_admin;

    document.getElementById("roleFormTitle").innerText = `Szerepkör Szerkesztése: ${r.name}`;
    switchAdminTab('roles');
}

function resetRoleForm() {
    document.getElementById("roleKeyInput").value = "";
    document.getElementById("roleKeyInput").readOnly = false;
    document.getElementById("roleNameInput").value = "";
    document.getElementById("roleDescInput").value = "";
    document.getElementById("permEditConcerts").checked = true;
    document.getElementById("permDeleteConcerts").checked = false;
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
        can_edit_concerts: document.getElementById("permEditConcerts").checked,
        can_delete_concerts: document.getElementById("permDeleteConcerts").checked,
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
        alert(data.message || "Szerepkör mentve!");
        await renderAdminData();
        resetRoleForm();
    } else {
        alert(data.error || "Hiba a szerepkör mentésekor!");
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
        alert(`Turné partíció (${name}) létrehozva!`);
        await loadUserInfo();
        renderAdminData();
    } else {
        const err = await res.json();
        alert(err.error || "Hiba a turné létrehozásakor!");
    }
}

async function deleteDatabase(dbName) {
    if (confirm(`BIZTOSAN TÖRÖLNI KÍVÁNOD A(Z) [${dbName.toUpperCase()}] TURNÉT?`)) {
        const res = await authFetch(`/api/admin/databases/${dbName}`, { method: 'DELETE' });
        if (res.ok) {
            alert(`Turné (${dbName}) törölve!`);
            await loadUserInfo();
            renderAdminData();
        } else {
            const err = await res.json();
            alert(err.error || "Hiba a törléskor!");
        }
    }
}

/* 4. TURNÉ FELÜGYELET (DB ADMINOKNAK) */
async function openDbAdminModal() {
    const res = await authFetch('/api/db-admin/requests');
    if (!res.ok) {
        alert("Nincs Turné Admin jogosultságod!");
        return;
    }
    const data = await res.json();
    document.getElementById("dbAdminManagedList").innerText = data.managed_databases.join(", ").toUpperCase() || "Nincs felügyelt turné";

    const reqContainer = document.getElementById("dbAdminRequestsContainer");
    reqContainer.innerHTML = "";
    if (data.db_requests.length === 0) {
        reqContainer.innerHTML = `<p class="text-xs text-[var(--text-muted)] font-mono italic">Nincs elbírálásra váró kérelem a turnéidhoz.</p>`;
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

/* TURNÉ CSATLAKOZÁS IGÉNYLÉSE */
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
        alert("Minden meglévő turnéhez rendelkezel hozzáféréssel!");
        return;
    }

    document.getElementById("requestDbModal").classList.remove("hidden");
    document.getElementById("requestDbModal").classList.add("flex");
}
function closeRequestDbModal() { 
    document.getElementById("requestDbModal").classList.add("hidden"); 
    document.getElementById("requestDbModal").classList.remove("flex"); 
}

async function handleSendDbRequest(e) {
    e.preventDefault();
    const db = document.getElementById("availableDbSelect").value;
    const res = await authFetch('/api/user/request-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ database: db })
    });

    if (res.ok) {
        alert(`Kérelem leadva a(z) [${db.toUpperCase()}] turnéra!`);
        closeRequestDbModal();
    }
}

async function editTitle() {
    const newTitle = prompt("Új turné főcím:", appData.title);
    if (newTitle) { 
        appData.title = newTitle; 
        await saveData(); 
    }
}

/* INICIALIZÁLÁS */
initTheme();
checkPasswordResetTokenInUrl();
checkAuth();
