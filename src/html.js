export function renderDashboard({ connected, athlete, settings, activityLog, webhookActive, baseUrl, flash }) {
  const name = athlete ? `${athlete.firstname} ${athlete.lastname}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Strava Fix</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:      #07090e;
      --bg1:     #0c0f17;
      --bg2:     #111522;
      --border:  #1c2135;
      --border2: #252c45;
      --text:    #c8cedf;
      --muted:   #4a5270;
      --dim:     #2a304d;
      --accent:  #3d8eff;
      --accent2: #00c2ff;
      --green:   #00e5a0;
      --red:     #ff4d6a;
      --yellow:  #f0c060;
      --mono:    'IBM Plex Mono', monospace;
      --sans:    'IBM Plex Sans', sans-serif;
    }

    html { scroll-behavior: smooth; }

    body {
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      background-image:
        linear-gradient(rgba(61,142,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(61,142,255,0.025) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    body::after {
      content: '';
      position: fixed;
      inset: 0;
      background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px);
      pointer-events: none;
      z-index: 999;
    }

    header {
      position: sticky; top: 0; z-index: 100;
      background: rgba(7,9,14,0.85);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      padding: 0 32px; height: 56px;
      display: flex; align-items: center; justify-content: space-between;
    }

    .logo {
      font-family: var(--mono); font-size: 13px; font-weight: 500;
      letter-spacing: 0.15em; text-transform: uppercase; color: var(--text);
      display: flex; align-items: center; gap: 10px;
    }

    .logo-mark {
      width: 24px; height: 24px;
      border: 1.5px solid var(--accent);
      display: flex; align-items: center; justify-content: center; position: relative;
    }
    .logo-mark::before { content: ''; width: 8px; height: 8px; background: var(--accent); display: block; }

    .header-right { display: flex; align-items: center; gap: 20px; }

    .athlete-tag { font-family: var(--mono); font-size: 11px; color: var(--muted); letter-spacing: 0.08em; }
    .athlete-tag span { color: var(--text); }

    .container { max-width: 960px; margin: 0 auto; padding: 40px 24px 80px; }

    .grid { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; }

    @media (max-width: 640px) {
      .grid { grid-template-columns: 1fr; }
      header { padding: 0 16px; }
      .container { padding: 24px 16px 60px; }
    }

    .card {
      background: var(--bg1); border: 1px solid var(--border);
      padding: 24px; position: relative; transition: border-color 0.2s;
    }
    .card:hover { border-color: var(--border2); }
    .card::before {
      content: ''; position: absolute; top: -1px; left: -1px;
      width: 24px; height: 24px;
      border-top: 2px solid var(--accent); border-left: 2px solid var(--accent);
      pointer-events: none;
    }

    .card-label {
      font-family: var(--mono); font-size: 10px; font-weight: 500;
      letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted);
      margin-bottom: 20px; display: flex; align-items: center; gap: 8px;
    }
    .card-label::after { content: ''; flex: 1; height: 1px; background: var(--border); }

    .status-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 0; border-bottom: 1px solid var(--border);
    }
    .status-row:last-of-type { border-bottom: none; }

    .status-key { font-family: var(--mono); font-size: 11px; color: var(--muted); letter-spacing: 0.05em; }
    .status-val { font-family: var(--mono); font-size: 11px; color: var(--text); }

    .indicator { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; }
    .dot { width: 5px; height: 5px; border-radius: 50%; }
    .ind-green { color: var(--green); }
    .ind-green .dot { background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 2s infinite; }
    .ind-red   { color: var(--red); }
    .ind-red .dot { background: var(--red); }
    .ind-yellow { color: var(--yellow); }
    .ind-yellow .dot { background: var(--yellow); }

    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 9px 16px; font-family: var(--mono); font-size: 11px;
      font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;
      cursor: pointer; border: 1px solid transparent;
      text-decoration: none; transition: all 0.15s; background: none; color: var(--text);
    }
    .btn:active { transform: scale(.97); }
    .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    .btn-primary:hover { background: var(--accent2); border-color: var(--accent2); }
    .btn-ghost { border-color: var(--border2); color: var(--muted); }
    .btn-ghost:hover { border-color: var(--text); color: var(--text); }
    .btn-danger { border-color: rgba(255,77,106,0.3); color: var(--red); }
    .btn-danger:hover { border-color: var(--red); background: rgba(255,77,106,0.08); }
    .btn-strava { background: #FC4C02; color: #fff; border-color: #FC4C02; padding: 12px 28px; font-size: 12px; }
    .btn-strava:hover { background: #e04300; border-color: #e04300; }
    .btn-full { width: 100%; justify-content: center; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 20px; }

    .field { margin-bottom: 18px; }
    label { display: block; font-family: var(--mono); font-size: 10px; font-weight: 500; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
    input[type="number"], select {
      width: 100%; background: var(--bg2); border: 1px solid var(--border);
      color: var(--text); padding: 9px 12px; font-family: var(--mono);
      font-size: 12px; outline: none; transition: border-color .15s; appearance: none; border-radius: 0;
    }
    input[type="number"]:focus, select:focus { border-color: var(--accent); }
    .hint { font-family: var(--mono); font-size: 10px; color: var(--dim); margin-top: 6px; line-height: 1.5; }

    .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border); }
    .toggle-row:last-of-type { border-bottom: none; }
    .toggle-label { font-size: 13px; font-weight: 500; color: var(--text); }
    .toggle-desc { font-family: var(--mono); font-size: 10px; color: var(--muted); margin-top: 3px; letter-spacing: 0.05em; }
    .toggle { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; inset: 0; background: var(--bg2); border: 1px solid var(--border2); cursor: pointer; transition: .2s; }
    .slider:before { content: ''; position: absolute; width: 12px; height: 12px; left: 3px; top: 3px; background: var(--muted); transition: .2s; }
    input:checked + .slider { background: rgba(0,229,160,0.12); border-color: var(--green); }
    input:checked + .slider:before { transform: translateX(16px); background: var(--green); }

    .log-table { width: 100%; border-collapse: collapse; }
    .log-table th { font-family: var(--mono); font-size: 9px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); padding: 0 12px 10px 0; text-align: left; border-bottom: 1px solid var(--border); }
    .log-table td { padding: 11px 12px 11px 0; border-bottom: 1px solid var(--border); vertical-align: middle; font-family: var(--mono); font-size: 11px; }
    .log-table tr:last-child td { border-bottom: none; }
    .activity-name { color: var(--text); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
    .type-tag { display: inline-block; padding: 2px 7px; font-family: var(--mono); font-size: 9px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; }
    .type-run  { background: rgba(255,77,106,.1);  color: var(--red);    border: 1px solid rgba(255,77,106,.2); }
    .type-walk { background: rgba(0,229,160,.08);  color: var(--green);  border: 1px solid rgba(0,229,160,.2); }
    .type-hike { background: rgba(240,192,96,.08); color: var(--yellow); border: 1px solid rgba(240,192,96,.2); }
    .arrow { color: var(--dim); margin: 0 4px; font-size: 9px; }
    .time-val { color: var(--muted); }
    .ext-link { color: var(--accent); text-decoration: none; font-size: 10px; letter-spacing: 0.05em; }
    .ext-link:hover { color: var(--accent2); }

    .flash { font-family: var(--mono); font-size: 11px; letter-spacing: 0.05em; padding: 10px 14px; margin-bottom: 20px; border-left: 2px solid; }
    .flash-ok  { background: rgba(0,229,160,.06);  border-color: var(--green); color: var(--green); }
    .flash-err { background: rgba(255,77,106,.06); border-color: var(--red);   color: var(--red); }

    .connect-page { min-height: calc(100vh - 56px); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px 24px; }
    .connect-glyph { width: 64px; height: 64px; border: 1px solid var(--border2); display: flex; align-items: center; justify-content: center; margin: 0 auto 32px; position: relative; }
    .connect-glyph::before, .connect-glyph::after { content: ''; position: absolute; width: 8px; height: 8px; border: 1px solid var(--accent); }
    .connect-glyph::before { top: -4px; left: -4px; }
    .connect-glyph::after  { bottom: -4px; right: -4px; }
    .connect-eyebrow { font-family: var(--mono); font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
    .connect-heading { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; color: var(--text); margin-bottom: 12px; }
    .connect-sub { font-size: 14px; color: var(--muted); line-height: 1.7; max-width: 380px; margin: 0 auto 36px; }
    .connect-note { margin-top: 20px; font-family: var(--mono); font-size: 10px; color: var(--dim); letter-spacing: 0.05em; }

    code { background: var(--bg2); border: 1px solid var(--border); padding: 1px 6px; font-family: var(--mono); font-size: 10px; color: var(--muted); }
    .full-width { grid-column: 1 / -1; }
    .empty-state { font-family: var(--mono); font-size: 11px; color: var(--muted); text-align: center; padding: 40px 20px; letter-spacing: 0.05em; }
    .footer-note { font-family: var(--mono); font-size: 10px; color: var(--dim); text-align: center; margin-top: 40px; letter-spacing: 0.05em; }
    .section-gap { margin-top: 16px; }
  </style>
</head>
<body>

<header>
  <div class="logo">
    <div class="logo-mark"></div>
    Strava Fix
  </div>
  <div class="header-right">
    ${connected && athlete
      ? `<span class="athlete-tag">connected as <span>${name}</span></span>
         <span class="indicator ind-green"><span class="dot"></span>live</span>`
      : `<span class="indicator ind-red"><span class="dot"></span>not connected</span>`}
  </div>
</header>

<div class="container">
  ${flash ? `<div class="flash ${flash.type === 'ok' ? 'flash-ok' : 'flash-err'}">${flash.message}</div>` : ''}
  ${!connected ? renderConnectPage() : renderMainDashboard({ athlete, settings, activityLog, webhookActive, baseUrl })}
</div>
</body>
</html>`;
}

function renderConnectPage() {
  return `
<div class="connect-page">
  <div class="connect-glyph">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3d8eff" stroke-width="1.5">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
    </svg>
  </div>
  <p class="connect-eyebrow">Activity Intelligence</p>
  <h1 class="connect-heading">Strava Fix</h1>
  <p class="connect-sub">
    Automatically corrects walks that Garmin syncs to Strava as runs —
    keeping your feed accurate and your training data clean.
  </p>
  <a href="/auth" class="btn btn-strava">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
    </svg>
    Connect with Strava
  </a>
  <p class="connect-note">requires <code>activity:read_all</code> and <code>activity:write</code></p>
</div>`;
}

function renderMainDashboard({ athlete, settings, activityLog, webhookActive, baseUrl }) {
  const threshold  = settings.speed_threshold_kmh ?? 7.0;
  const targetType = settings.target_type ?? 'Walk';
  const enabled    = settings.enabled !== false;
  const checkName  = settings.check_name !== false;

  return `
<div class="grid">

  <div class="card">
    <div class="card-label">System Status</div>
    <div class="status-row">
      <span class="status-key">account</span>
      <span class="status-val">${esc(athlete?.firstname ?? '')} ${esc(athlete?.lastname ?? '')}</span>
    </div>
    <div class="status-row">
      <span class="status-key">auto-fix</span>
      <span>${enabled
        ? '<span class="indicator ind-green"><span class="dot"></span>active</span>'
        : '<span class="indicator ind-yellow"><span class="dot"></span>paused</span>'}</span>
    </div>
    <div class="status-row">
      <span class="status-key">webhook</span>
      <span>${webhookActive
        ? '<span class="indicator ind-green"><span class="dot"></span>registered</span>'
        : '<span class="indicator ind-red"><span class="dot"></span>not set up</span>'}</span>
    </div>
    <div class="status-row">
      <span class="status-key">fixes applied</span>
      <span class="status-val">${activityLog.length}</span>
    </div>
    <div class="status-row">
      <span class="status-key">threshold</span>
      <span class="status-val">${threshold} km/h → ${targetType}</span>
    </div>
    <div class="actions">
      ${webhookActive
        ? `<form method="POST" action="/api/remove-webhook"><button class="btn btn-ghost" type="submit">Remove Webhook</button></form>`
        : `<form method="POST" action="/api/setup-webhook"><button class="btn btn-primary" type="submit">Setup Webhook</button></form>`}
      <form method="POST" action="/api/disconnect"><button class="btn btn-danger" type="submit">Disconnect</button></form>
    </div>
  </div>

  <div class="card">
    <div class="card-label">Detection Rules</div>
    <form method="POST" action="/api/settings">
      <div class="field">
        <label>Walk speed threshold (km/h)</label>
        <input type="number" name="speed_threshold_kmh" value="${threshold}" min="4" max="14" step="0.5" />
        <p class="hint">// activities below this avg speed are re-typed<br>// typical walk 4-7 km/h — slow jog starts ~8 km/h</p>
      </div>
      <div class="field">
        <label>Reclassify as</label>
        <select name="target_type">
          <option value="Walk" ${targetType === 'Walk' ? 'selected' : ''}>Walk</option>
          <option value="Hike" ${targetType === 'Hike' ? 'selected' : ''}>Hike</option>
        </select>
      </div>
      <div class="toggle-row">
        <div>
          <div class="toggle-label">Auto-fix enabled</div>
          <div class="toggle-desc">// pause without removing webhook</div>
        </div>
        <label class="toggle"><input type="checkbox" name="enabled" ${enabled ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
      <div class="toggle-row">
        <div>
          <div class="toggle-label">Name matching</div>
          <div class="toggle-desc">// fix if activity name contains "walk"</div>
        </div>
        <label class="toggle"><input type="checkbox" name="check_name" ${checkName ? 'checked' : ''} /><span class="slider"></span></label>
      </div>
      <div class="section-gap">
        <button type="submit" class="btn btn-primary btn-full">Save Settings</button>
      </div>
    </form>
  </div>

  <div class="card full-width">
    <div class="card-label">Fix Log</div>
    ${activityLog.length === 0
      ? `<div class="empty-state">no fixes recorded yet<br>
           <span style="color:var(--dim);margin-top:6px;display:block;">
             ${webhookActive ? 'waiting for next garmin sync...' : 'setup webhook to begin monitoring'}
           </span>
         </div>`
      : `<table class="log-table">
           <thead><tr><th>Activity</th><th>Change</th><th>Avg Speed</th><th>When</th><th>Link</th></tr></thead>
           <tbody>
             ${activityLog.map(row => `
             <tr>
               <td><span class="activity-name" title="${esc(row.name)}">${esc(row.name)}</span></td>
               <td>
                 <span class="type-tag type-run">${esc(row.original_type)}</span>
                 <span class="arrow">--&gt;</span>
                 <span class="type-tag ${row.fixed_type === 'Walk' ? 'type-walk' : 'type-hike'}">${esc(row.fixed_type)}</span>
               </td>
               <td class="time-val">${row.speed_kmh} km/h</td>
               <td class="time-val">${formatAge(row.fixed_at)}</td>
               <td><a class="ext-link" href="https://www.strava.com/activities/${row.id}" target="_blank">view →</a></td>
             </tr>`).join('')}
           </tbody>
         </table>`}
  </div>

</div>
<p class="footer-note">webhook — <code>${baseUrl}/webhook</code></p>`;
}

function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatAge(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return 'just now';
}