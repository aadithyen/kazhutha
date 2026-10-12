export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kazhutha ops</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0f1419;
      --panel: #1a2332;
      --border: #2d3a4f;
      --text: #e8eef7;
      --muted: #8b9cb3;
      --accent: #5eead4;
      --warn: #fbbf24;
      --err: #f87171;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.45;
    }
    header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: baseline;
      justify-content: space-between;
    }
    h1 { margin: 0; font-size: 1.25rem; font-weight: 600; }
    .sub { color: var(--muted); font-size: 0.85rem; }
    main { padding: 1.25rem 1.5rem 2rem; max-width: 1200px; margin: 0 auto; }
    .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.1rem;
    }
    .card h2 { margin: 0 0 0.35rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; }
    .big { font-size: 1.75rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    .alert {
      border-color: var(--warn);
      background: #2a2210;
      color: #fde68a;
      padding: 0.85rem 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }
    section { margin-top: 1.5rem; }
    section h3 { margin: 0 0 0.75rem; font-size: 1rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-weight: 500; }
    .sev-error { color: var(--err); }
    .sev-warn { color: var(--warn); }
    .bar-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; font-size: 0.8rem; }
    .bar { height: 8px; background: var(--accent); border-radius: 4px; min-width: 2px; }
    .mono { font-family: ui-monospace, monospace; font-size: 0.8rem; }
    #updated { color: var(--muted); font-size: 0.8rem; }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Kazhutha ops</h1>
      <div class="sub">Live rooms, player counts, client and signaling issues</div>
    </div>
    <div id="updated">Loading…</div>
  </header>
  <main>
    <div id="alert" hidden class="alert"></div>
    <div class="grid" id="stats"></div>
    <section>
      <h3>Active rooms</h3>
      <div class="card" style="overflow-x:auto">
        <table id="rooms"><thead><tr><th>Code</th><th>Players</th><th>Names</th></tr></thead><tbody></tbody></table>
        <p id="no-rooms" class="sub" hidden>No active rooms</p>
      </div>
    </section>
    <section>
      <h3>Players (24h snapshots)</h3>
      <div class="card" id="history"></div>
    </section>
    <section>
      <h3>Issues (last hour)</h3>
      <div class="card" style="overflow-x:auto">
        <table id="issues"><thead><tr><th>Kind</th><th>Severity</th><th>Count</th></tr></thead><tbody></tbody></table>
      </div>
    </section>
    <section>
      <h3>Recent events</h3>
      <div class="card" style="overflow-x:auto">
        <table id="events"><thead><tr><th>Time</th><th>Source</th><th>Kind</th><th>Room</th><th>Message</th></tr></thead><tbody></tbody></table>
      </div>
    </section>
  </main>
  <script>
    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
    function render(data) {
      document.getElementById('updated').textContent = 'Updated ' + new Date().toLocaleTimeString();
      const alertEl = document.getElementById('alert');
      if (data.issues.alert && data.issues.summary) {
        alertEl.hidden = false;
        alertEl.textContent = data.issues.summary;
      } else alertEl.hidden = true;

      document.getElementById('stats').innerHTML = [
        ['Rooms now', data.live.roomCount],
        ['Players now', data.live.playerCount],
        ['Events (24h)', data.totals.eventsLast24h],
        ['Snapshots (24h)', data.totals.snapshotsLast24h],
      ].map(([l,v]) => '<div class="card"><h2>'+esc(l)+'</h2><div class="big">'+esc(v)+'</div></div>').join('');

      const tbody = document.querySelector('#rooms tbody');
      const rooms = data.live.rooms || [];
      document.getElementById('no-rooms').hidden = rooms.length > 0;
      tbody.innerHTML = rooms.map(r => '<tr><td class="mono">'+esc(r.code)+'</td><td>'+r.playerCount+'</td><td>'+esc((r.peers||[]).map(p=>p.name).join(', '))+'</td></tr>').join('');

      const hist = data.history || [];
      const maxP = Math.max(1, ...hist.map(h => h.maxPlayers));
      document.getElementById('history').innerHTML = hist.length ? hist.map(h =>
        '<div class="bar-row"><span class="mono" style="width:11rem">'+esc(h.hour)+':00</span><div class="bar" style="width:'+Math.round((h.maxPlayers/maxP)*100)+'%"></div><span>'+h.maxPlayers+' max · ~'+h.avgPlayers+' avg</span></div>'
      ).join('') : '<p class="sub">No history yet — snapshots accumulate every minute.</p>';

      document.querySelector('#issues tbody').innerHTML = (data.issues.lastHour||[]).map(r =>
        '<tr><td class="mono">'+esc(r.kind)+'</td><td class="sev-'+esc(r.severity)+'">'+esc(r.severity)+'</td><td>'+r.count+'</td></tr>'
      ).join('') || '<tr><td colspan="3" class="sub">No issues recorded in the last hour</td></tr>';

      document.querySelector('#events tbody').innerHTML = (data.recentEvents||[]).map(e =>
        '<tr><td class="mono">'+esc(e.ts.replace('T',' ').slice(0,19))+'</td><td>'+esc(e.source)+'</td><td class="mono">'+esc(e.kind)+'</td><td class="mono">'+esc(e.roomCode||'—')+'</td><td>'+esc(e.message||'')+'</td></tr>'
      ).join('');
    }
    async function refresh() {
      try {
        const res = await fetch('/api/overview');
        if (res.ok) render(await res.json());
      } catch (_) {}
    }
    refresh();
    setInterval(refresh, 5000);
  </script>
</body>
</html>`;
