let currentDb = "default";
let userPermissions = { username: "", display_name: "", email: "", is_superadmin: false, role: "editor", role_name: "Szerkesztő", permissions: {}, databases: [], all_databases: [], preferred_db: "default", system_default_db: "default" };
let appData = { title: "Rider Manager Spektrumevents", subtitle: "Spektrum StageOps", riders: [] };
let currentRiderId = null;
let copyPlotMode = 'stage';
let currentSessionId = localStorage.getItem("session_id") || "";
let adminCacheData = null;

const PRESET_ICONS = {
    'power_230v': `<div style="text-align:center; background:#1f6feb; color:#fff; padding:2px 6px; border-radius:4px; font-weight:bold;"><span style="font-size:15px;">⚡</span><br><span style="font-size:9px;">230V Schuko</span></div>`,
    'power_drop': `<div style="text-align:center; background:#161b22; border:1px solid #30363d; color:#e6edf3; padding:2px 6px; border-radius:4px;"><span style="font-size:12px;">🔌🔌🔌</span><br><span style="font-size:8px;">Power Drop</span></div>`,
    'power_cee_16a': `<div style="text-align:center; background:#dc2626; color:#fff; padding:3px 6px; border-radius:4px; font-weight:bold; border:1px solid #fca5a5;"><span style="font-size:14px;">🔴 CEE 16A</span><br><span style="font-size:8px;">3-PHASE</span></div>`,
    'power_cee_32a': `<div style="text-align:center; background:#991b1b; color:#fff; padding:3px 6px; border-radius:4px; font-weight:bold; border:2px solid #ef4444;"><span style="font-size:14px;">🔴 CEE 32A</span><br><span style="font-size:8px;">3-PHASE</span></div>`,
    'straight_stand': `<div style="text-align:center;"><div style="font-size:18px;">🎙️</div><span style="font-size:9px;">Egyenes Állvány</span></div>`,
    'boom_stand': `<div style="text-align:center;"><div style="font-size:17px; transform: rotate(-20deg);">🎙️╲</div><span style="font-size:9px;">Gém Állvány</span></div>`,
    'pedalboard': `<div style="text-align:center; background:#161b22; padding:2px 5px; border-radius:4px; border:1px solid #30363d;"><span style="font-size:10px;">🎛️ 🔴 🟢 🔵</span><br><span style="font-size:8px;">Pedalboard</span></div>`,
    'di_box': `<div style="text-align:center; background:#d97706; color:#000; padding:1px 5px; border-radius:3px; font-weight:bold; font-size:9px;">📦 DI-BOX</div>`,
    'drums': `<div style="text-align:center;"><div style="font-size:26px;">🥁</div><span style="font-size:10px; font-weight:bold;">DOBOK</span></div>`,
    'guitar_amp': `<div style="text-align:center; background:#161b22; border:1px solid #30363d; padding:3px; border-radius:4px;"><span style="font-size:16px;">🎸</span><br><span style="font-size:9px;">GITÁR AMP</span></div>`,
    'bass_amp': `<div style="text-align:center; background:#161b22; border:1px solid #1f6feb; padding:3px; border-radius:4px;"><span style="font-size:16px;">🔊</span><br><span style="font-size:9px;">BASS AMP</span></div>`,
    'wedge': `<div style="text-align:center; background:#1c2128; border-bottom:2px solid #1f6feb; padding:2px 6px;"><span style="font-size:12px;">🔊</span><br><span style="font-size:8px;">MONITOR</span></div>`,
    'iem_monitor': `<div style="text-align:center; background:#0284c7; color:#fff; padding:3px 6px; border-radius:4px; font-weight:bold; border:1px solid #38bdf8;"><span style="font-size:13px;">🎧 IEM</span><br><span style="font-size:8px;">IN-EAR</span></div>`
};

const LIGHT_PRESET_ICONS = {
    'spot_moving': `<div style="text-align:center; background:#f59e0b; color:#000; padding:3px 6px; border-radius:4px; font-weight:bold;"><span style="font-size:15px;">🔆 SPOT</span><br><span style="font-size:8px;">Moving Head</span></div>`,
    'beam_moving': `<div style="text-align:center; background:#0284c7; color:#fff; padding:3px 6px; border-radius:4px; font-weight:bold; border:1px solid #38bdf8;"><span style="font-size:15px;">🔦 BEAM</span><br><span style="font-size:8px;">Sharp Beam</span></div>`,
    'wash_moving': `<div style="text-align:center; background:#059669; color:#fff; padding:3px 6px; border-radius:4px; font-weight:bold;"><span style="font-size:15px;">🌈 WASH</span><br><span style="font-size:8px;">RGBW Wash</span></div>`,
    'led_bar': `<div style="text-align:center; background:#7c3aed; color:#fff; padding:2px 8px; border-radius:3px; font-weight:bold; border:1px solid #a78bfa;"><span style="font-size:11px;">🚥 PIXEL BAR</span></div>`,
    'strobe': `<div style="text-align:center; background:#e2e8f0; color:#000; padding:3px 6px; border-radius:4px; font-weight:bold; border:2px solid #38bdf8;"><span style="font-size:14px;">⚡ STROBE</span><br><span style="font-size:8px;">ATOMIC / JDC1</span></div>`,
    'blinder': `<div style="text-align:center; background:#ea580c; color:#fff; padding:3px 6px; border-radius:4px; font-weight:bold;"><span style="font-size:13px;">💥 BLINDER</span><br><span style="font-size:8px;">2/4-LITE MOLE</span></div>`,
    'floor_par': `<div style="text-align:center; background:#334155; color:#fff; padding:2px 6px; border-radius:4px; border:1px solid #94a3b8;"><span style="font-size:13px;">🏮 PAR</span><br><span style="font-size:8px;">Floor Uplight</span></div>`,
    'hazer': `<div style="text-align:center; background:#4f46e5; color:#fff; padding:2px 6px; border-radius:4px;"><span style="font-size:13px;">🌫️ HAZER</span><br><span style="font-size:8px;">Touring Hazer</span></div>`
};

/* TÉMAKEZELÉS */
function initTheme() {
    const savedTheme = localStorage.getItem("rider_theme") || "dark";
    setAppTheme(savedTheme, false);
}

function setAppTheme(theme, save = true) {
    const isLight = (theme === 'light');
    if (isLight) {
        document.body.classList.add('theme-light');
    } else {
        document.body.classList.remove('theme-light');
    }
    if (save) localStorage.setItem("rider_theme", theme);

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
        localStorage.setItem("rider_sidebar_collapsed", isCollapsed ? "1" : "0");
    }
}

function restoreSidebarState() {
    if (window.innerWidth >= 768) {
        const isCollapsed = localStorage.getItem("rider_sidebar_collapsed") === "1";
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
    document.getElementById("headerRoleBadge").innerText = userPermissions.is_superadmin ? "FŐADMIN" : (userPermissions.role_name || userPermissions.role).toUpperCase();

    const perms = userPermissions.permissions || {};
    const isSuper = userPermissions.is_superadmin;

    if (isSuper || perms.can_access_admin) {
        document.getElementById("adminUserBtn").classList.remove("hidden");
        document.getElementById("adminUserBtn").classList.add("flex");
    } else {
        document.getElementById("adminUserBtn").classList.add("hidden");
    }

    if (!isSuper && perms.can_manage_dbs) {
        document.getElementById("dbAdminBtn").classList.remove("hidden");
        document.getElementById("dbAdminBtn").classList.add("flex");
    } else {
        document.getElementById("dbAdminBtn").classList.add("hidden");
    }

    const dbSelect = document.getElementById("dbSelector");
    dbSelect.innerHTML = "";
    userPermissions.databases.forEach(db => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.innerText = db.replace("_", " ").toUpperCase();
        dbSelect.appendChild(opt);
    });

    if (userPermissions.databases.length > 0) {
        currentDb = userPermissions.databases.includes(userPermissions.preferred_db) ? userPermissions.preferred_db : userPermissions.databases[0];
        dbSelect.value = currentDb;
    }

    loadData();
}

async function switchDatabase(dbName) {
    currentDb = dbName;
    currentRiderId = null;
    loadData();
}

async function loadData() {
    try {
        const res = await authFetch(`/api/data?db=${currentDb}&_t=${Date.now()}`);
        appData = await res.json();
        if (!appData.riders) appData.riders = [];
        render();
    } catch (err) {
        console.error("Adatbetöltési hiba:", err);
    }
}

async function saveData() {
    const perms = userPermissions.permissions || {};
    if (!userPermissions.is_superadmin && perms.can_edit_riders === false) {
        alert("Nincs szerkesztési jogosultságod ehhez a munkatérhez!");
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
    document.getElementById("appTitleDisplay").innerText = appData.title || "Rider Manager";
    document.getElementById("appSubtitleDisplay").innerText = appData.subtitle || "Spektrum StageOps";

    // Metrikák frissítése
    document.getElementById("statTotalRiders").innerText = appData.riders.length;

    let stageCount = 0;
    let lightCount = 0;
    let inputCount = 0;

    const listEl = document.getElementById("riderList");
    listEl.innerHTML = "";

    if (appData.riders.length === 0) {
        listEl.innerHTML = `<p class="text-[11px] text-[var(--text-muted)] font-mono italic p-2">Nincs létrehozott rider.</p>`;
    }

    appData.riders.forEach(r => {
        const isSelected = (currentRiderId === r.id);
        if (isSelected) {
            stageCount = (r.stageElements || []).length;
            lightCount = (r.lightElements || []).length + (r.lighting || []).reduce((acc, curr) => acc + (parseInt(curr.qty) || 1), 0);
            inputCount = (r.inputs || []).length;
        }

        const btn = document.createElement("button");
        btn.onclick = () => selectRider(r.id);
        btn.className = `w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between ${isSelected ? 'bg-[#1f6feb] text-white font-bold' : 'ui-subtle text-[var(--text-secondary)] hover:bg-[var(--panel-hover)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'}`;
        btn.innerHTML = `
            <span class="truncate flex items-center gap-1.5"><i class="fa-solid fa-guitar text-[10px]"></i> ${esc(r.title)}</span>
            <span class="text-[10px] font-mono opacity-80">${esc((r.stageElements || []).length)} el.</span>
        `;
        listEl.appendChild(btn);
    });

    document.getElementById("statStageItems").innerText = stageCount;
    document.getElementById("statLightItems").innerText = lightCount;
    document.getElementById("statInputs").innerText = inputCount;

    if (currentRiderId) {
        const r = appData.riders.find(item => item.id === currentRiderId);
        if (r) {
            document.getElementById("noRiderSelected").classList.add("hidden");
            document.getElementById("riderEditor").classList.remove("hidden");
            document.getElementById("riderTitle").value = r.title;
            document.getElementById("currentRiderHeaderBadge").innerText = r.title;
            document.getElementById("techNotes").value = r.techNotes || "";
            renderTables(r);
            renderStagePlot(r);
            renderLightingPlot(r);
            return;
        }
    }

    document.getElementById("currentRiderHeaderBadge").innerText = "Nincs kiválasztva";
    document.getElementById("noRiderSelected").classList.remove("hidden");
    document.getElementById("riderEditor").classList.add("hidden");
}

function createNewRider() {
    const title = prompt("Új Rider megnevezése:", "Új Rider");
    if (!title) return;
    const newRider = {
        id: "r_" + Date.now(),
        title: title,
        techNotes: "",
        stageElements: [],
        lightElements: [],
        lighting: [],
        inputs: [],
        crew: [],
        vehicles: [],
        catering: []
    };
    appData.riders.push(newRider);
    currentRiderId = newRider.id;
    saveData();
}

function duplicateEntireRider() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;
    const newTitle = prompt("Klónozott Rider új neve:", r.title + " (Másolat)");
    if (!newTitle) return;

    const cloned = JSON.parse(JSON.stringify(r));
    cloned.id = "r_" + Date.now();
    cloned.title = newTitle;
    appData.riders.push(cloned);
    currentRiderId = cloned.id;
    saveData();
}

function selectRider(id) {
    currentRiderId = id;
    render();
}

function deleteRider() {
    if (!currentRiderId) return;
    if (confirm("BIZTOSAN TÖRÖLNI SZERETNÉD EZT A RIDER-T?")) {
        appData.riders = appData.riders.filter(r => r.id !== currentRiderId);
        currentRiderId = null;
        saveData();
    }
}

function updateRiderHeader() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (r) {
        r.title = document.getElementById("riderTitle").value;
        document.getElementById("currentRiderHeaderBadge").innerText = r.title;
    }
}

async function editTitle() {
    const newTitle = prompt("Új főcím:", appData.title);
    if (newTitle) {
        appData.title = newTitle;
        await saveData();
    }
}

function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(el => {
        el.className = "tab-btn py-1.5 px-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded flex items-center gap-1.5 whitespace-nowrap";
    });

    document.getElementById(`tab-${tabName}`).classList.remove("hidden");
    const activeBtn = document.getElementById(`tabBtn-${tabName}`);
    activeBtn.className = "tab-btn py-1.5 px-3 text-white bg-[#1f6feb] rounded flex items-center gap-1.5 whitespace-nowrap";
}

// ================= STAGE PLOT LOGIC =================
function addStagePreset(presetKey) {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;
    if (!r.stageElements) r.stageElements = [];

    r.stageElements.push({
        id: Date.now(),
        presetKey: presetKey,
        x: 80 + Math.random() * 200,
        y: 80 + Math.random() * 150
    });
    renderStagePlot(r);
}

function clearStagePlot() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (r && confirm("Törölni akarod az összes elemet a színpadról?")) {
        r.stageElements = [];
        renderStagePlot(r);
    }
}

function renderStagePlot(rider) {
    const canvas = document.getElementById("stageCanvas");
    if (!canvas) return;
    canvas.querySelectorAll(".stage-item").forEach(e => e.remove());

    (rider.stageElements || []).forEach(item => {
        const div = document.createElement("div");
        div.className = "stage-item absolute p-1.5 rounded ui-panel border border-[var(--border-color)] shadow-lg text-[var(--text-primary)] select-none z-10";
        div.style.left = item.x + "px";
        div.style.top = item.y + "px";

        let contentHTML = `<div class="text-right no-print"><span onclick="removeStageElement(${Number(item.id) || 0})" class="text-rose-500 font-bold hover:text-rose-400 cursor-pointer text-xs">&times;</span></div>`;
        if (item.presetKey && PRESET_ICONS[item.presetKey]) contentHTML += PRESET_ICONS[item.presetKey];
        div.innerHTML = contentHTML;

        let isDragging = false;
        let offsetX, offsetY;

        div.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - div.offsetLeft;
            offsetY = e.clientY - div.offsetTop;
            div.style.zIndex = "100";
        });

        document.addEventListener("mousemove", (e) => {
            if (isDragging) {
                item.x = e.clientX - offsetX;
                item.y = e.clientY - offsetY;
                div.style.left = item.x + "px";
                div.style.top = item.y + "px";
            }
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                div.style.zIndex = "10";
            }
        });

        canvas.appendChild(div);
    });
}

function removeStageElement(id) {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (r) {
        r.stageElements = r.stageElements.filter(e => e.id !== id);
        renderStagePlot(r);
    }
}

// ================= LIGHT / FLOOR PLOT LOGIC =================
function addLightPreset(presetKey) {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;
    if (!r.lightElements) r.lightElements = [];

    r.lightElements.push({
        id: Date.now(),
        presetKey: presetKey,
        x: 80 + Math.random() * 200,
        y: 80 + Math.random() * 150
    });
    renderLightingPlot(r);
}

function clearLightPlot() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (r && confirm("Törölni akarod az összes fénytechnikai elemet?")) {
        r.lightElements = [];
        renderLightingPlot(r);
    }
}

function renderLightingPlot(rider) {
    const canvas = document.getElementById("lightingCanvas");
    if (!canvas) return;
    canvas.querySelectorAll(".stage-item").forEach(e => e.remove());

    (rider.lightElements || []).forEach(item => {
        const div = document.createElement("div");
        div.className = "stage-item absolute p-1.5 rounded ui-panel border border-[var(--border-color)] shadow-lg text-[var(--text-primary)] select-none z-10";
        div.style.left = item.x + "px";
        div.style.top = item.y + "px";

        let contentHTML = `<div class="text-right no-print"><span onclick="removeLightElement(${Number(item.id) || 0})" class="text-rose-500 font-bold hover:text-rose-400 cursor-pointer text-xs">&times;</span></div>`;
        if (item.presetKey && LIGHT_PRESET_ICONS[item.presetKey]) contentHTML += LIGHT_PRESET_ICONS[item.presetKey];
        div.innerHTML = contentHTML;

        let isDragging = false;
        let offsetX, offsetY;

        div.addEventListener("mousedown", (e) => {
            isDragging = true;
            offsetX = e.clientX - div.offsetLeft;
            offsetY = e.clientY - div.offsetTop;
            div.style.zIndex = "100";
        });

        document.addEventListener("mousemove", (e) => {
            if (isDragging) {
                item.x = e.clientX - offsetX;
                item.y = e.clientY - offsetY;
                div.style.left = item.x + "px";
                div.style.top = item.y + "px";
            }
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                div.style.zIndex = "10";
            }
        });

        canvas.appendChild(div);
    });
}

function removeLightElement(id) {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (r) {
        r.lightElements = r.lightElements.filter(e => e.id !== id);
        renderLightingPlot(r);
    }
}

// ================= PLOT ÁTMÁSOLÁSA =================
function openCopyPlotModal(mode = 'stage') {
    copyPlotMode = mode;
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;

    document.getElementById("copyPlotModalTitle").innerHTML = mode === 'stage' 
        ? `<i class="fa-solid fa-copy text-[var(--text-muted)] mr-1.5"></i> Stage Plot Átmásolása`
        : `<i class="fa-solid fa-lightbulb text-[var(--text-muted)] mr-1.5"></i> Floor Lamp Plot Átmásolása`;

    const select = document.getElementById("targetRiderSelect");
    select.innerHTML = "";
    appData.riders.filter(item => item.id !== currentRiderId).forEach(other => {
        const opt = document.createElement("option");
        opt.value = other.id;
        opt.innerText = other.title;
        select.appendChild(opt);
    });

    document.getElementById("copyPlotModal").classList.remove("hidden");
    document.getElementById("copyPlotModal").classList.add("flex");
}

function closeCopyPlotModal() {
    document.getElementById("copyPlotModal").classList.add("hidden");
    document.getElementById("copyPlotModal").classList.remove("flex");
}

function executePlotCopy() {
    const targetId = document.getElementById("targetRiderSelect").value;
    const sourceRider = appData.riders.find(r => r.id === currentRiderId);
    const targetRider = appData.riders.find(r => r.id === targetId);

    if (!sourceRider || !targetRider) return;

    if (copyPlotMode === 'stage') {
        targetRider.stageElements = JSON.parse(JSON.stringify(sourceRider.stageElements || []));
    } else {
        targetRider.lightElements = JSON.parse(JSON.stringify(sourceRider.lightElements || []));
        targetRider.lighting = JSON.parse(JSON.stringify(sourceRider.lighting || []));
    }

    alert("Plot sikeresen átmásolva!");
    closeCopyPlotModal();
    saveData();
}

function copyPlotToNewRider() {
    const sourceRider = appData.riders.find(r => r.id === currentRiderId);
    if (!sourceRider) return;

    const newTitle = prompt("Új Rider megnevezése az átmásolt plothoz:", sourceRider.title + " (Másolat)");
    if (!newTitle) return;

    const newRider = {
        id: "r_" + Date.now(),
        title: newTitle,
        techNotes: "",
        stageElements: copyPlotMode === 'stage' ? JSON.parse(JSON.stringify(sourceRider.stageElements || [])) : [],
        lightElements: copyPlotMode === 'light' ? JSON.parse(JSON.stringify(sourceRider.lightElements || [])) : [],
        lighting: copyPlotMode === 'light' ? JSON.parse(JSON.stringify(sourceRider.lighting || [])) : [],
        inputs: [],
        crew: [],
        vehicles: [],
        catering: []
    };

    appData.riders.push(newRider);
    currentRiderId = newRider.id;
    closeCopyPlotModal();
    saveData();
}

// ================= TÁBLÁZATOK =================
function renderTables(rider) {
    const inBody = document.getElementById("inputTableBody");
    inBody.innerHTML = "";
    (rider.inputs || []).forEach((inp, i) => {
        inBody.innerHTML += `<tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition">
            <td class="px-3 py-1.5 font-bold font-mono text-[var(--accent-blue)]">${esc(i+1)}</td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(inp.source||'')}" placeholder="Forrás" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(inp.mic||'')}" placeholder="Mikrofon / DI" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5">
                <select class="form-control rounded px-2 py-1 w-full cursor-pointer" onchange="saveTableData()">
                    <option value="Nagy gémes" ${esc(inp.stand==='Nagy gémes'?'selected':'')}>🎙️ Nagy gémes állvány</option>
                    <option value="Kis gémes" ${esc(inp.stand==='Kis gémes'?'selected':'')}>🥁 Kis gémes állvány</option>
                    <option value="Egyenes" ${esc(inp.stand==='Egyenes'?'selected':'')}>🎤 Egyenes állvány</option>
                    <option value="Nincs" ${esc(inp.stand==='Nincs'?'selected':'')}>❌ Nincs</option>
                </select>
            </td>
            <td class="px-3 py-1.5 text-center"><input type="checkbox" ${esc(inp.p48?'checked':'')} onchange="saveTableData()" class="rounded text-[#1f6feb]"></td>
            <td class="px-3 py-1.5 no-print text-right"><button onclick="this.closest('tr').remove(); saveTableData();" class="text-[var(--text-muted)] hover:text-rose-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });

    const lightBody = document.getElementById("lightTableBody");
    lightBody.innerHTML = "";
    (rider.lighting || []).forEach((lit) => {
        lightBody.innerHTML += `<tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition">
            <td class="px-3 py-1.5"><input type="number" class="form-control rounded px-2 py-1 w-full text-center font-bold font-mono" value="${esc(lit.qty||1)}" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(lit.fixture||'')}" placeholder="Lámpa típusa" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(lit.mode||'')}" placeholder="DMX mód" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full font-mono text-[var(--accent-blue)]" value="${esc(lit.address||'')}" placeholder="Univ / CH" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(lit.pos||'')}" placeholder="Pozíció" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(lit.notes||'')}" placeholder="Megjegyzés" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5 no-print text-right"><button onclick="this.closest('tr').remove(); saveTableData();" class="text-[var(--text-muted)] hover:text-rose-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });

    const crewBody = document.getElementById("crewTableBody");
    crewBody.innerHTML = "";
    (rider.crew || []).forEach((c) => {
        crewBody.innerHTML += `<tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition">
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(c.name||'')}" placeholder="Név" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(c.role||'')}" placeholder="Munkakör" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full font-mono" value="${esc(c.phone||'')}" placeholder="+36..." onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(c.diet||'')}" placeholder="Diéta / Megjegyzés" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5 no-print text-right"><button onclick="this.closest('tr').remove(); saveTableData();" class="text-[var(--text-muted)] hover:text-rose-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });

    const vehicleBody = document.getElementById("vehicleTableBody");
    vehicleBody.innerHTML = "";
    (rider.vehicles || []).forEach((v) => {
        vehicleBody.innerHTML += `<tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition">
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full font-mono font-bold" value="${esc(v.plate||'')}" placeholder="ABC-123" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(v.type||'')}" placeholder="Jármű típusa" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(v.driver||'')}" placeholder="Sofőr neve" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full font-mono" value="${esc(v.phone||'')}" placeholder="Telefonszám" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(v.notes||'')}" placeholder="Megjegyzés" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5 no-print text-right"><button onclick="this.closest('tr').remove(); saveTableData();" class="text-[var(--text-muted)] hover:text-rose-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });

    const catBody = document.getElementById("cateringTableBody");
    catBody.innerHTML = "";
    (rider.catering || []).forEach((cat) => {
        catBody.innerHTML += `<tr class="border-b border-[var(--border-color)] hover:bg-[var(--panel-hover)] transition">
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(cat.item||'')}" placeholder="Tétel" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(cat.qty||'')}" placeholder="Mennyiség" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5"><input class="form-control rounded px-2 py-1 w-full" value="${esc(cat.notes||'')}" placeholder="Megjegyzés" onchange="saveTableData()"></td>
            <td class="px-3 py-1.5 no-print text-right"><button onclick="this.closest('tr').remove(); saveTableData();" class="text-[var(--text-muted)] hover:text-rose-500"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
    });
}

function addInputRow() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;
    if (!r.inputs) r.inputs = [];
    r.inputs.push({ source: "", mic: "", stand: "Nagy gémes", p48: false });
    renderTables(r);
}

function addLightRow() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;
    if (!r.lighting) r.lighting = [];
    r.lighting.push({ qty: 2, fixture: "", mode: "Standard", address: "", pos: "Floor", notes: "" });
    renderTables(r);
}

function addCrewRow() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;
    if (!r.crew) r.crew = [];
    r.crew.push({ name: "", role: "", phone: "", diet: "" });
    renderTables(r);
}

function addVehicleRow() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;
    if (!r.vehicles) r.vehicles = [];
    r.vehicles.push({ plate: "", type: "", driver: "", phone: "", notes: "" });
    renderTables(r);
}

function addCateringRow() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;
    if (!r.catering) r.catering = [];
    r.catering.push({ item: "", qty: "", notes: "" });
    renderTables(r);
}

function saveTableData() {
    const r = appData.riders.find(item => item.id === currentRiderId);
    if (!r) return;

    r.techNotes = document.getElementById("techNotes").value;

    const inputs = [];
    document.querySelectorAll("#inputTableBody tr").forEach(row => {
        const inputsEl = row.querySelectorAll("input");
        const selectEl = row.querySelector("select");
        if (inputsEl.length >= 2 && selectEl) {
            inputs.push({ source: inputsEl[0].value, mic: inputsEl[1].value, stand: selectEl.value, p48: inputsEl[2].checked });
        }
    });
    r.inputs = inputs;

    const lighting = [];
    document.querySelectorAll("#lightTableBody tr").forEach(row => {
        const inputsEl = row.querySelectorAll("input");
        if (inputsEl.length >= 5) {
            lighting.push({ qty: inputsEl[0].value, fixture: inputsEl[1].value, mode: inputsEl[2].value, address: inputsEl[3].value, pos: inputsEl[4].value, notes: inputsEl[5]?.value||"" });
        }
    });
    r.lighting = lighting;

    const crew = [];
    document.querySelectorAll("#crewTableBody tr").forEach(row => {
        const inputsEl = row.querySelectorAll("input");
        if (inputsEl.length >= 4) {
            crew.push({ name: inputsEl[0].value, role: inputsEl[1].value, phone: inputsEl[2].value, diet: inputsEl[3].value });
        }
    });
    r.crew = crew;

    const vehicles = [];
    document.querySelectorAll("#vehicleTableBody tr").forEach(row => {
        const inputsEl = row.querySelectorAll("input");
        if (inputsEl.length >= 5) {
            vehicles.push({ plate: inputsEl[0].value, type: inputsEl[1].value, driver: inputsEl[2].value, phone: inputsEl[3].value, notes: inputsEl[4].value });
        }
    });
    r.vehicles = vehicles;

    const catering = [];
    document.querySelectorAll("#cateringTableBody tr").forEach(row => {
        const inputsEl = row.querySelectorAll("input");
        if (inputsEl.length >= 3) {
            catering.push({ item: inputsEl[0].value, qty: inputsEl[1].value, notes: inputsEl[2].value });
        }
    });
    r.catering = catering;
}

// ================= PDF EXPORT =================
function openExportPdfModal() {
    document.getElementById("exportPdfModal").classList.remove("hidden");
    document.getElementById("exportPdfModal").classList.add("flex");
}
function closeExportPdfModal() {
    document.getElementById("exportPdfModal").classList.add("hidden");
    document.getElementById("exportPdfModal").classList.remove("flex");
}

function triggerCustomPrint() {
    const showStage = document.getElementById("expStageplot").checked;
    const showLight = document.getElementById("expLightplot").checked;
    const showInputs = document.getElementById("expInputs").checked;
    const showCrew = document.getElementById("expCrew").checked;
    const showCatering = document.getElementById("expCatering").checked;

    document.getElementById("tab-stageplot").style.display = showStage ? "block" : "none";
    document.getElementById("tab-lamp-plot").style.display = showLight ? "block" : "none";
    document.getElementById("tab-inputs").style.display = showInputs ? "block" : "none";
    document.getElementById("tab-crew").style.display = showCrew ? "block" : "none";
    document.getElementById("tab-catering").style.display = showCatering ? "block" : "none";

    closeExportPdfModal();
    window.print();

    setTimeout(() => {
        document.getElementById("tab-stageplot").style.display = "";
        document.getElementById("tab-lamp-plot").style.display = "";
        document.getElementById("tab-inputs").style.display = "";
        document.getElementById("tab-crew").style.display = "";
        document.getElementById("tab-catering").style.display = "";
        switchTab('stageplot');
    }, 1000);
}

// ================= SAJÁT FIÓK & PROFIL =================
function openProfileModal() {
    document.getElementById("profUsername").value = userPermissions.username || "";
    document.getElementById("profDisplayName").value = userPermissions.display_name || userPermissions.username;
    document.getElementById("profEmail").value = userPermissions.email || "";

    document.getElementById("profRoleDisplay").innerText = userPermissions.is_superadmin ? "Főadminisztrátor" : (userPermissions.role_name || userPermissions.role);
    document.getElementById("profDbsDisplay").innerText = (userPermissions.databases || []).join(", ") || "default";
    document.getElementById("profSessionIdDisplay").innerText = currentSessionId || "N/A";

    document.getElementById("oldOwnPassword").value = "";
    document.getElementById("newOwnPassword").value = "";

    switchProfileTab('general');
    document.getElementById("profileModal").classList.remove("hidden");
    document.getElementById("profileModal").classList.add("flex");
}

function closeProfileModal() {
    document.getElementById("profileModal").classList.add("hidden");
    document.getElementById("profileModal").classList.remove("flex");
}

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

async function handleUpdateProfile(e) {
    e.preventDefault();
    const newU = document.getElementById("profUsername").value.trim();
    const disp = document.getElementById("profDisplayName").value.trim();
    const em = document.getElementById("profEmail").value.trim();

    const res = await authFetch('/api/user/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_username: newU, display_name: disp, email: em })
    });
    const data = await res.json();
    if (res.ok) {
        alert(data.message || "Azonosító adatok sikeresen frissítve!");
        await loadUserInfo();
    } else {
        alert(data.error || "Hiba a mentés során!");
    }
}

async function handleChangeOwnPw(e) {
    e.preventDefault();
    const oldPw = document.getElementById("oldOwnPassword").value;
    const newPw = document.getElementById("newOwnPassword").value;

    const res = await authFetch('/api/user/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPw, new_password: newPw })
    });
    const data = await res.json();
    if (res.ok) {
        alert("Jelszavad sikeresen megváltozott!");
        document.getElementById("oldOwnPassword").value = "";
        document.getElementById("newOwnPassword").value = "";
        switchProfileTab('general');
    } else {
        alert(data.error || "Hiba!");
    }
}

// ================= BEÁLLÍTÁSOK =================
function openSettingsModal() {
    const prefSelect = document.getElementById("prefDefaultDb");
    prefSelect.innerHTML = "";
    userPermissions.databases.forEach(db => {
        const opt = document.createElement("option");
        opt.value = db;
        opt.innerText = db.replace('_', ' ').toUpperCase();
        if (db === userPermissions.preferred_db) opt.selected = true;
        prefSelect.appendChild(opt);
    });

    if (userPermissions.is_superadmin) {
        document.getElementById("superadminSettingsBlock").classList.remove("hidden");
        const sysSelect = document.getElementById("sysDefaultDb");
        sysSelect.innerHTML = "";
        userPermissions.all_databases.forEach(db => {
            const opt = document.createElement("option");
            opt.value = db;
            opt.innerText = db.replace('_', ' ').toUpperCase();
            if (db === userPermissions.system_default_db) opt.selected = true;
            sysSelect.appendChild(opt);
        });
    } else {
        document.getElementById("superadminSettingsBlock").classList.add("hidden");
    }

    const currentTheme = localStorage.getItem("rider_theme") || "dark";
    setAppTheme(currentTheme, false);

    document.getElementById("settingsModal").classList.remove("hidden");
    document.getElementById("settingsModal").classList.add("flex");
}

function closeSettingsModal() {
    document.getElementById("settingsModal").classList.add("hidden");
    document.getElementById("settingsModal").classList.remove("flex");
}

async function handleSavePreferences(e) {
    e.preventDefault();
    const prefDb = document.getElementById("prefDefaultDb").value;
    const sysDb = userPermissions.is_superadmin ? document.getElementById("sysDefaultDb").value : null;

    const res = await authFetch('/api/user/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_db: prefDb, system_default_db: sysDb })
    });
    const data = await res.json();
    if (res.ok) {
        alert(data.message || "Munkatér beállítások elmentve!");
        closeSettingsModal();
        await loadUserInfo();
    } else {
        alert(data.error || "Hiba!");
    }
}

// ================= DB ADMIN =================
async function openDbAdminModal() {
    const res = await authFetch('/api/db-admin/requests');
    const data = await res.json();
    const container = document.getElementById("dbAdminRequestsContainer");
    container.innerHTML = "";

    if (!data.db_requests || data.db_requests.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-[var(--text-muted)] italic font-mono">Nincs elbírálásra váró kérelem a munkatereidhez.</p>`;
    } else {
        data.db_requests.forEach(r => {
            container.innerHTML += `
                <div class="flex items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs">
                    <div><span class="font-medium text-[var(--text-primary)]">${esc(r.username)}</span> &rarr; <span class="text-[var(--text-secondary)] font-mono font-bold">${esc(r.database.toUpperCase())}</span></div>
                    <div class="flex gap-1.5">
                        <button onclick="approveDbRequest(${jsq(r.username)}, ${jsq(r.database)}, 'approve', true)" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Elfogad</button>
                        <button onclick="approveDbRequest(${jsq(r.username)}, ${jsq(r.database)}, 'reject', true)" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasít</button>
                    </div>
                </div>`;
        });
    }

    document.getElementById("dbAdminModal").classList.remove("hidden");
    document.getElementById("dbAdminModal").classList.add("flex");
}

function closeDbAdminModal() {
    document.getElementById("dbAdminModal").classList.add("hidden");
    document.getElementById("dbAdminModal").classList.remove("flex");
}

// ================= FŐADMIN KÖZPONT =================
async function openUserAdminModal() { 
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

function switchAdminTab(tab) {
    document.getElementById("adminTabUsers").classList.add("hidden");
    document.getElementById("adminTabRoles").classList.add("hidden");
    document.getElementById("adminTabDbs").classList.add("hidden");
    document.getElementById("adminTabRequests").classList.add("hidden");

    const defClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--panel-hover)] flex items-center gap-2";
    const actClass = "w-full text-left px-3 py-2 rounded text-[11px] font-semibold text-white bg-[#1f6feb] flex items-center gap-2";

    document.getElementById("tabBtnAdminUsers").className = defClass;
    document.getElementById("tabBtnAdminRoles").className = defClass;
    document.getElementById("tabBtnAdminDbs").className = defClass;
    document.getElementById("tabBtnAdminRequests").className = defClass;

    if (tab === 'users') {
        document.getElementById("adminTabUsers").classList.remove("hidden");
        document.getElementById("tabBtnAdminUsers").className = actClass;
    } else if (tab === 'roles') {
        document.getElementById("adminTabRoles").classList.remove("hidden");
        document.getElementById("tabBtnAdminRoles").className = actClass;
    } else if (tab === 'dbs') {
        document.getElementById("adminTabDbs").classList.remove("hidden");
        document.getElementById("tabBtnAdminDbs").className = actClass;
    } else if (tab === 'requests') {
        document.getElementById("adminTabRequests").classList.remove("hidden");
        document.getElementById("tabBtnAdminRequests").className = actClass;
    }
}

async function renderAdminData() {
    const res = await authFetch('/api/admin/users');
    adminCacheData = await res.json();
    const data = adminCacheData;

    const roleSelect = document.getElementById("newRole");
    roleSelect.innerHTML = "";
    Object.keys(data.roles || {}).forEach(rKey => {
        const r = data.roles[rKey];
        const opt = document.createElement("option");
        opt.value = rKey;
        opt.innerText = `${r.name} (${rKey})`;
        roleSelect.appendChild(opt);
    });

    const dbContainer = document.getElementById("dbListContainer");
    dbContainer.innerHTML = "";
    (data.all_databases || []).forEach(db => {
        dbContainer.innerHTML += `
            <div class="flex items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs">
                <span class="font-mono text-[var(--text-primary)]"><i class="fa-solid fa-database mr-2 text-[var(--text-muted)]"></i>${esc(db.toUpperCase())}</span>
                <div class="flex items-center gap-2">
                    <button onclick="switchDatabase(${jsq(db)}); closeUserAdminModal();" class="text-xs text-[#1f6feb] hover:underline">Megnyitás</button>
                    ${db !== 'default' ? `<button onclick="deleteDatabase(${jsq(db)})" class="text-[var(--text-muted)] hover:text-rose-500 ml-2"><i class="fa-solid fa-trash"></i></button>` : '<span class="text-[10px] text-[var(--text-muted)] italic ml-2">[Alapértelmezett]</span>'}
                </div>
            </div>`;
    });

    const pContainer = document.getElementById("pendingUsersContainer");
    pContainer.innerHTML = "";
    const pendingUsers = data.users.filter(u => u.status === 'pending');
    if (pendingUsers.length === 0) {
        document.getElementById("pendingUsersSection").classList.add("hidden");
    } else {
        document.getElementById("pendingUsersSection").classList.remove("hidden");
        pendingUsers.forEach(u => {
            pContainer.innerHTML += `
                <div class="flex items-center justify-between p-2 ui-panel border border-amber-500/30 rounded text-xs">
                    <div><span class="font-semibold text-[var(--text-primary)]">${esc(u.display_name || u.username)}</span> <span class="text-[10px] text-[var(--text-muted)] font-mono">(${esc(u.username)} &bull; ${esc(u.email || 'Nincs email')})</span></div>
                    <div class="flex gap-1.5">
                        <button onclick="approveUser(${jsq(u.username)}, 'approve')" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Elfogad</button>
                        <button onclick="approveUser(${jsq(u.username)}, 'reject')" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasít</button>
                    </div>
                </div>`;
        });
    }

    const reqContainer = document.getElementById("dbRequestsContainer");
    reqContainer.innerHTML = "";
    if (data.db_requests.length === 0) {
        reqContainer.innerHTML = `<p class="text-xs text-[var(--text-muted)] italic font-mono">Nincs csatlakozási kérelem.</p>`;
    } else {
        data.db_requests.forEach(r => {
            reqContainer.innerHTML += `
                <div class="flex items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs">
                    <div><span class="font-medium text-[var(--text-primary)]">${esc(r.username)}</span> &rarr; <span class="text-[var(--text-secondary)] font-mono font-bold">${esc(r.database.toUpperCase())}</span></div>
                    <div class="flex gap-1.5">
                        <button onclick="approveDbRequest(${jsq(r.username)}, ${jsq(r.database)}, 'approve')" class="px-2 py-0.5 bg-[#238636] text-white rounded text-[11px]">Elfogad</button>
                        <button onclick="approveDbRequest(${jsq(r.username)}, ${jsq(r.database)}, 'reject')" class="px-2 py-0.5 ui-panel text-rose-500 border border-[var(--border-light)] rounded text-[11px]">Elutasít</button>
                    </div>
                </div>`;
        });
    }

    const uContainer = document.getElementById("userListContainer");
    uContainer.innerHTML = "";
    data.users.filter(u => u.status !== 'pending').forEach(u => {
        const roleObj = data.roles[u.role] || { name: u.role };
        let roleBadge = `<span class="ui-subtle text-[var(--text-secondary)] border border-[var(--border-color)] px-1.5 py-0.5 rounded font-mono text-[10px] uppercase">${esc(roleObj.name)}</span>`;
        if (u.is_superadmin) roleBadge = `<span class="bg-amber-500/10 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono text-[10px] uppercase font-bold">FŐADMIN</span>`;

        uContainer.innerHTML += `
            <div class="flex flex-wrap items-center justify-between p-2 ui-panel border border-[var(--border-color)] rounded text-xs gap-2">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-user text-[var(--text-muted)]"></i>
                    <div>
                        <span class="font-medium text-[var(--text-primary)]">${esc(u.display_name || u.username)}</span>
                        <span class="text-[10px] font-mono text-[var(--text-muted)]">(${esc(u.username)})</span>
                        ${u.email ? `<span class="text-[10px] font-mono text-[var(--text-secondary)] ml-1">&lt;${esc(u.email)}&gt;</span>` : ''}
                    </div>
                    ${roleBadge}
                </div>
                <div class="text-[var(--text-secondary)] font-mono text-[11px]">Partíciók: <span class="text-[var(--text-primary)] font-semibold">${esc(u.databases.join(", ") || "Nincs")}</span></div>
                <div class="flex items-center gap-2">
                    <button onclick="editUser(${jsq(u.username)}, ${jsq(u.display_name || u.username)}, ${jsq(u.email || '')}, ${jsq(u.is_superadmin ? 'superadmin' : u.role)}, ${jsq(u.databases.join(","))})" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><i class="fa-solid fa-pen"></i></button>
                    ${!u.is_superadmin ? `<button onclick="deleteUser(${jsq(u.username)})" class="text-[var(--text-muted)] hover:text-rose-500 ml-1"><i class="fa-solid fa-trash"></i></button>` : ''}
                </div>
            </div>`;
    });

    const rContainer = document.getElementById("rolesListContainer");
    rContainer.innerHTML = "";
    Object.keys(data.roles || {}).forEach(rKey => {
        const r = data.roles[rKey];
        rContainer.innerHTML += `
            <div class="p-2.5 ui-panel border border-[var(--border-color)] rounded text-xs flex justify-between items-center">
                <div>
                    <span class="font-bold text-[var(--text-primary)]">${esc(r.name)}</span>
                    <span class="font-mono text-[10px] text-amber-500 ml-1">(${esc(rKey)})</span>
                    <p class="text-[11px] text-[var(--text-secondary)] mt-0.5">${esc(r.description || '')}</p>
                </div>
            </div>`;
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

async function approveUser(username, action) {
    await authFetch('/api/admin/approve-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, action }) });
    renderAdminData();
}

async function approveDbRequest(username, database, action, isFromDbAdmin = false) {
    await authFetch('/api/admin/approve-db-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, database, action }) });
    if (isFromDbAdmin) openDbAdminModal();
    else renderAdminData();
}

async function handleCreateDb(e) {
    e.preventDefault();
    const name = document.getElementById("newDbNameInput").value;
    const res = await authFetch('/api/admin/create-db', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ db_name: name }) });
    if (res.ok) {
        document.getElementById("newDbNameInput").value = "";
        alert(`Partíció (${name}) létrehozva!`);
        await loadUserInfo();
        renderAdminData();
    }
}

async function deleteDatabase(dbName) {
    if (confirm(`BIZTOSAN TÖRÖLNI KÍVÁNOD A(Z) [${dbName.toUpperCase()}] PARTÍCIÓT?`)) {
        const res = await authFetch(`/api/admin/databases/${dbName}`, { method: 'DELETE' });
        if (res.ok) {
            alert(`Partíció (${dbName}) törölve!`);
            await loadUserInfo();
            renderAdminData();
        }
    }
}

function editUser(uName, dispName, email, role, dbsStr) {
    const uInput = document.getElementById("newUsername");
    uInput.value = uName;
    uInput.dataset.oldUsername = uName;
    document.getElementById("newDisplayName").value = dispName;
    document.getElementById("newUserEmail").value = email;
    document.getElementById("newPassword").value = "";
    document.getElementById("newRole").value = role;

    const dbs = dbsStr ? dbsStr.split(',') : [];
    const select = document.getElementById("newDbSelect");
    Array.from(select.options).forEach(opt => opt.selected = dbs.includes(opt.value));
    document.getElementById("userFormTitle").innerHTML = `Munkatárs Módosítása: <span class="font-mono text-[var(--text-primary)]">${esc(uName)}</span>`;
    switchAdminTab('users');
}

function resetUserForm() {
    const uInput = document.getElementById("newUsername");
    uInput.value = "";
    delete uInput.dataset.oldUsername;
    document.getElementById("newDisplayName").value = "";
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("newRole").value = "editor";
    Array.from(document.getElementById("newDbSelect").options).forEach(opt => opt.selected = false);
    document.getElementById("userFormTitle").innerHTML = `Munkatárs Rögzítése / Módosítása`;
}

async function handleSaveUser(e) {
    e.preventDefault();
    const uInput = document.getElementById("newUsername");
    const u = uInput.value.trim();
    const oldU = uInput.dataset.oldUsername || u;
    const disp = document.getElementById("newDisplayName").value.trim();
    const email = document.getElementById("newUserEmail").value.trim();
    const p = document.getElementById("newPassword").value;
    const r = document.getElementById("newRole").value;
    const selectedDbs = Array.from(document.getElementById("newDbSelect").selectedOptions).map(opt => opt.value);

    const res = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_username: oldU, username: u, display_name: disp, email: email, password: p, role: r, databases: selectedDbs })
    });

    if (res.ok) {
        await renderAdminData();
        resetUserForm();
        alert(`Munkatárs (${u}) adatai mentve!`);
    } else {
        const err = await res.json();
        alert(err.error || "Hiba!");
    }
}

async function deleteUser(uName) {
    if (confirm(`Törlöd "${uName}" fiókját?`)) {
        await authFetch(`/api/admin/users/${uName}`, { method: 'DELETE' });
        renderAdminData();
    }
}

function openRequestDbModal() {
    const select = document.getElementById("availableDbSelect");
    select.innerHTML = "";
    userPermissions.all_databases.forEach(db => {
        if (!userPermissions.databases.includes(db)) {
            const opt = document.createElement("option");
            opt.value = db;
            opt.innerText = db.replace('_', ' ').toUpperCase();
            select.appendChild(opt);
        }
    });
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
        alert(`Kérelem elküldve: [${db.toUpperCase()}]!`);
        closeRequestDbModal();
    }
}

initTheme();
restoreSidebarState();
checkPasswordResetTokenInUrl();
checkAuth();
