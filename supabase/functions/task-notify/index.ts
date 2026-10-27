// Spektrum – feladat-értesítő (Supabase Edge Function)
// A koncert app hívja mentés után: a megadott feladatok felelőseinek e-mailt küld,
// a főadminok minden levélről titkos másolatot (BCC) kapnak.
// A feladatok adatait az adatbázisból olvassa (a hívó jogosultságával), nem a kérésből.
//
// Szükséges titkok (Dashboard → Edge Functions → Secrets):
//   SMTP_HOST      pl. smtp.gmail.com
//   SMTP_PORT      465 (SSL – a Supabase a 25-ös és 587-es portot tiltja)
//   SMTP_USER      pl. info@spektrumevents.hu
//   SMTP_PASS      Google-nél alkalmazásjelszó
//   MAIL_FROM      pl. Spektrum Managers <info@spektrumevents.hu>
//   PORTAL_URL     a portál címe, /-re végződve, pl. https://portal.spektrumevents.hu/
// Nem kötelező (a levél aljára):
//   COMPANY_EMAIL  céges e-mail cím (alapból info@spektrumevents.hu)
//   COMPANY_PHONE  céges telefonszám (alapból +36 20 618 4435)
//   LOGO_URL       a Spektrum Events logó nyilvános címe (alapból PORTAL_URL + assets/spektrum-logo.png)
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// ===================================================================== LEVÉLSABLON (sima JS, típusok nélkül)
// A portál színei (sötét téma) – a levelezők miatt táblázatos elrendezés és inline stílusok.
const C = {
  bg: "#090c10", panel: "#0d1117", subtle: "#161b22", border: "#30363d", borderLight: "#484f58",
  text: "#e6edf3", muted: "#8b949e", faint: "#6e7681", blue: "#1f6feb", concert: "#f43f5e",
  amber: "#d29922", green: "#3fb950",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const HU_MONTHS = ["jan", "febr", "márc", "ápr", "máj", "jún", "júl", "aug", "szept", "okt", "nov", "dec"];
const HU_DAYS = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
function huDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00Z");
  return `${d.getUTCFullYear()}. ${HU_MONTHS[d.getUTCMonth()]}. ${d.getUTCDate()}., ${HU_DAYS[d.getUTCDay()]}`;
}
function daysLeft(iso, todayIso) {
  return Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(todayIso + "T00:00:00Z")) / 86400000);
}

// Határidő-címke: lejárt / ma / holnap / N nap múlva
function dueBadge(iso, todayIso) {
  if (!iso) return `<span style="color:${C.faint};font-family:${MONO};font-size:11px">nincs határidő</span>`;
  const n = daysLeft(iso, todayIso);
  const [label, color] = n < 0 ? [`${-n} napja lejárt`, C.concert] : n === 0 ? ["ma esedékes", C.concert]
    : n === 1 ? ["holnap", C.amber] : n <= 3 ? [`${n} nap múlva`, C.amber] : [`${n} nap múlva`, C.muted];
  return `<span style="font-family:${MONO};font-size:11px;color:${C.text}">${esc(huDate(iso))}</span><br>` +
    `<span style="display:inline-block;margin-top:4px;padding:1px 7px;border-radius:4px;border:1px solid ${color};color:${color};font-family:${MONO};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em">${esc(label)}</span>`;
}

function emailFooter(company) {
  // A logóban benne van a „Spektrum Events” felirat, ezért szövegesen csak logó nélkül írjuk ki
  const logo = company.logoUrl
    ? `<img src="${esc(company.logoUrl)}" width="160" height="140" alt="Spektrum Events – hang, fény, technika" style="display:block;margin:0 auto 14px;width:160px;height:140px;border-radius:10px;border:1px solid ${C.border}">`
    : `<div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.text}">Spektrum Events</div>`;
  const contacts = [
    company.email && `<a href="mailto:${esc(company.email)}" style="color:${C.text};text-decoration:none">&#9993;&nbsp; ${esc(company.email)}</a>`,
    company.phone && `<a href="tel:${esc(company.phone.replace(/[^+\d]/g, ""))}" style="color:${C.text};text-decoration:none">&#9742;&nbsp; ${esc(company.phone)}</a>`,
  ].filter(Boolean).join(`<span style="color:${C.borderLight}">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`);
  return `
    <tr><td style="padding:28px 24px 8px;text-align:center">
      ${logo}
      ${contacts ? `<div style="margin-top:8px;font-size:12px;font-family:${MONO}">${contacts}</div>` : ""}
      ${company.web ? `<div style="margin-top:6px;font-size:12px"><a href="${esc(company.web)}" style="color:${C.muted};text-decoration:none">${esc(company.web.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></div>` : ""}
    </td></tr>
    <tr><td style="padding:12px 24px 28px;text-align:center;font-size:11px;color:${C.faint};line-height:1.6">
      Ezt a levelet a Spektrum Managers rendszer küldte automatikusan.<br>Kérdés esetén keresd a Főadminisztrátort.
    </td></tr>`;
}

// o: { name, assigner, concert, wsName, wsTitle, tasks, portalUrl, company, todayIso }
function renderTaskEmail(o) {
  const c = o.concert;
  const place = [c.city, c.venue].filter(Boolean).join(" • ");
  const d = c.concert_date ? new Date(c.concert_date + "T00:00:00Z") : null;
  const many = o.tasks.length > 1;
  const subject = `${many ? `${o.tasks.length} új feladat` : "Új feladat"}: ${c.title || "koncert"}`;
  const preheader = `${o.assigner} feladatot osztott rád – ${o.tasks.map((t) => t.text).join(", ")}`;

  const statusMap = { confirmed: ["Visszaigazolt", C.green], planned: ["Tervezett", C.amber], cancelled: ["Lemondva", C.concert], done: ["Megvalósult", "#388bfd"] };
  const st = statusMap[c.status];

  const taskRows = o.tasks.map((t, i) => `
    <tr>
      <td style="padding:13px 10px 13px 16px;${i ? `border-top:1px solid ${C.border};` : ""}vertical-align:top;width:22px">
        <div style="width:22px;height:22px;line-height:22px;border-radius:11px;background:${C.subtle};border:1px solid ${C.borderLight};text-align:center;font-family:${MONO};font-size:11px;font-weight:700;color:${C.amber}">${i + 1}</div>
      </td>
      <td style="padding:14px 8px 14px 0;${i ? `border-top:1px solid ${C.border};` : ""}vertical-align:top;font-size:14px;font-weight:600;color:${C.text};line-height:1.45">
        ${esc(t.text)}
      </td>
      <td style="padding:14px 16px 14px 8px;${i ? `border-top:1px solid ${C.border};` : ""}vertical-align:top;text-align:right;white-space:nowrap">
        ${dueBadge(t.due_date, o.todayIso)}
      </td>
    </tr>`).join("");

  const button = o.portalUrl ? `
    <tr><td style="padding:8px 24px 4px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td bgcolor="${C.blue}" style="border-radius:6px">
          <a href="${esc(o.portalUrl)}concert/index.html?db=${encodeURIComponent(o.wsName)}&amp;concert=${encodeURIComponent(c.id)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px">Megnyitás a Concert Managerben &rarr;</a>
        </td>
      </tr></table>
    </td></tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg}">
<tr><td align="center" style="padding:32px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${FONT};color:${C.text}">

    <!-- fejléc -->
    <tr><td style="padding:0 4px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="34" height="34" bgcolor="${C.subtle}" style="width:34px;height:34px;border:1px solid ${C.borderLight};border-radius:6px;text-align:center;vertical-align:middle;font-size:16px;color:${C.concert}">&#9835;</td>
            <td style="padding-left:12px;vertical-align:middle">
              <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.text}">Spektrum Managers</div>
              <div style="font-size:11px;font-family:${MONO};color:${C.muted}">Concert Manager</div>
            </td>
          </tr></table>
        </td>
        <td style="vertical-align:middle;text-align:right">
          <span style="display:inline-block;padding:3px 9px;border-radius:4px;border:1px solid ${C.concert};color:${C.concert};font-family:${MONO};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Új feladat</span>
        </td>
      </tr></table>
    </td></tr>

    <!-- fő kártya -->
    <tr><td bgcolor="${C.panel}" style="background:${C.panel};border:1px solid ${C.border};border-top:3px solid ${C.concert};border-radius:8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="padding:28px 24px 6px">
          <div style="font-size:22px;font-weight:800;line-height:1.25;letter-spacing:-.01em;color:${C.text}">Szia ${esc(o.name)}! &#128075;</div>
          <div style="margin-top:8px;font-size:14px;line-height:1.6;color:${C.muted}">
            <b style="color:${C.text}">${esc(o.assigner)}</b> ${many ? `<b style="color:${C.text}">${o.tasks.length} feladatot</b>` : "egy feladatot"} osztott rád.
            Nézd meg a részleteket, és pipáld ki, ha kész vagy.
          </div>
        </td></tr>

        <!-- koncert -->
        <tr><td style="padding:20px 24px 4px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.subtle}" style="background:${C.subtle};border:1px solid ${C.border};border-radius:6px">
            <tr>
              ${d ? `<td width="64" style="width:64px;padding:14px 0 14px 14px;vertical-align:top">
                <table role="presentation" width="52" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.panel}" style="width:52px;background:${C.panel};border:1px solid ${C.border};border-radius:6px;text-align:center">
                  <tr><td bgcolor="${C.concert}" style="background:${C.concert};border-radius:5px 5px 0 0;padding:2px 0;font-size:10px;font-weight:700;text-transform:uppercase;color:#ffffff;letter-spacing:.06em">${HU_MONTHS[d.getUTCMonth()]}</td></tr>
                  <tr><td style="padding:4px 0 6px;font-size:22px;font-weight:800;color:${C.text};line-height:1">${d.getUTCDate()}</td></tr>
                </table>
              </td>` : ""}
              <td style="padding:14px;vertical-align:top">
                <div style="font-size:16px;font-weight:700;color:${C.text}">${esc(c.title || "Névtelen koncert")}
                  ${st ? `&nbsp;<span style="display:inline-block;vertical-align:2px;padding:1px 6px;border-radius:4px;border:1px solid ${st[1]};color:${st[1]};font-size:10px;font-weight:700">${st[0]}</span>` : ""}</div>
                ${place ? `<div style="margin-top:4px;font-size:13px;color:${C.muted}"><span style="color:${C.concert}">&#9679;</span>&nbsp; ${esc(place)}</div>` : ""}
                <div style="margin-top:6px;font-size:11px;font-family:${MONO};color:${C.faint}">
                  ${[c.gate_open && `kapunyitás ${esc(c.gate_open)}`, c.show_time && `kezdés ${esc(c.show_time)}`, esc(o.wsTitle)].filter(Boolean).join(" &nbsp;•&nbsp; ")}
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- feladatok -->
        <tr><td style="padding:22px 24px 6px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.amber}">
          &#10003;&nbsp; ${many ? "A feladataid" : "A feladatod"}
        </td></tr>
        <tr><td style="padding:4px 24px 20px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.border};border-radius:6px">
            ${taskRows}
          </table>
        </td></tr>

        ${button}
        <tr><td style="padding:14px 24px 28px;font-size:12px;color:${C.faint}">
          Kiosztotta: <span style="color:${C.muted}">${esc(o.assigner)}</span>
        </td></tr>
      </table>
    </td></tr>

    ${emailFooter(o.company)}
  </table>
</td></tr>
</table>
</body></html>`;

  const text = `Szia ${o.name}!\n\n${o.assigner} feladatot osztott rád.\n\n` +
    `${c.title || "Koncert"}${c.concert_date ? ` – ${huDate(c.concert_date)}` : ""}${place ? ` – ${place}` : ""}\n\n` +
    o.tasks.map((t) => `- ${t.text}${t.due_date ? ` (határidő: ${huDate(t.due_date)})` : ""}`).join("\n") +
    (o.portalUrl ? `\n\nMegnyitás: ${o.portalUrl}concert/index.html?db=${encodeURIComponent(o.wsName)}&concert=${encodeURIComponent(c.id)}` : "") +
    `\n\n--\nSpektrum Events${o.company.email ? `\n${o.company.email}` : ""}${o.company.phone ? `\n${o.company.phone}` : ""}`;

  // Egy sorba tömörítve: a denomailer a sortöréseket/behúzásokat hibásan kódolja („=20” jelenik meg a levélben)
  return { subject, html: html.replace(/\s*\n\s*/g, " "), text };
}
// ===================================================================== LEVÉLSABLON VÉGE

type Task = { id: number; text: string; is_done?: boolean; due_date?: string; assignee_id?: string };
type Profile = { id: string; email: string | null; display_name: string | null; username: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Csak POST" });

  const env = (k: string) => Deno.env.get(k) ?? "";
  const url = env("SUPABASE_URL");

  // A hívó jogosultságával olvasunk: csak a saját munkaterét látja (RLS)
  const userDb = createClient(url, env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await userDb.auth.getUser();
  if (!user) return json(401, { error: "Nincs bejelentkezve" });

  let body: { app?: string; workspace?: string; concert_id?: string; task_ids?: number[] };
  try { body = await req.json(); } catch { return json(400, { error: "Hibás kérés" }); }
  if (body.app !== "concert" || !body.workspace || !body.concert_id || !Array.isArray(body.task_ids)) {
    return json(400, { error: "Hiányzó adatok" });
  }

  const { data: ws } = await userDb.from("workspaces").select("title, data")
    .eq("app", "concert").eq("name", body.workspace).maybeSingle();
  if (!ws) return json(403, { error: "Nincs hozzáférésed ehhez a munkatérhez" });

  const concert = (ws.data?.concerts ?? []).find((c: { id: string }) => c.id === body.concert_id);
  if (!concert) return json(404, { error: "A koncert nem található" });
  const ids = new Set(body.task_ids.map(Number));
  const tasks: Task[] = (concert.tasks ?? []).filter((t: Task) => ids.has(Number(t.id)) && t.assignee_id && !t.is_done);
  if (!tasks.length) return json(200, { sent: 0 });

  // E-mail címek a szolgáltatói kulccsal (a felhasználók egymás e-mail címét nem látják)
  const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"));
  const assigneeIds = [...new Set(tasks.map((t) => t.assignee_id!))];
  const [{ data: assignees }, { data: supers }, { data: me }] = await Promise.all([
    admin.from("profiles").select("id, email, display_name, username").in("id", assigneeIds).eq("status", "approved"),
    admin.from("profiles").select("email").eq("is_superadmin", true).eq("status", "approved"),
    admin.from("profiles").select("display_name, username").eq("id", user.id).maybeSingle(),
  ]);
  const superEmails = (supers ?? []).map((p) => p.email).filter(Boolean) as string[];
  const portalUrl = env("PORTAL_URL");
  const company = {
    email: env("COMPANY_EMAIL") || "info@spektrumevents.hu",
    phone: env("COMPANY_PHONE") || "+36 20 618 4435",
    web: env("COMPANY_WEB"),
    logoUrl: env("LOGO_URL") || (portalUrl ? portalUrl + "assets/spektrum-logo.png" : ""),
  };
  const todayIso = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" });

  const smtp = new SMTPClient({
    connection: {
      hostname: env("SMTP_HOST"),
      port: Number(env("SMTP_PORT") || 465),
      tls: true,
      auth: { username: env("SMTP_USER"), password: env("SMTP_PASS") },
    },
  });

  let sent = 0;
  try {
    for (const p of (assignees ?? []) as Profile[]) {
      if (!p.email) continue;
      const mail = renderTaskEmail({
        name: p.display_name || p.username,
        assigner: me ? (me.display_name || me.username) : "Valaki",
        concert, wsName: body.workspace, wsTitle: ws.title || body.workspace,
        tasks: tasks.filter((t) => t.assignee_id === p.id),
        portalUrl, company, todayIso,
      });
      const bcc = superEmails.filter((e) => e !== p.email);
      await smtp.send({
        from: env("MAIL_FROM") || env("SMTP_USER"),
        to: p.email,
        ...(bcc.length ? { bcc } : {}),
        subject: mail.subject,
        content: mail.text,
        html: mail.html,
      });
      sent++;
    }
  } catch (e) {
    console.error("[task-notify]", e);
    return json(500, { error: "Az e-mail küldése nem sikerült", sent });
  } finally {
    await smtp.close().catch(() => {});
  }
  return json(200, { sent });
});
