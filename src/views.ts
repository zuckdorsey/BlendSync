import type { AuthToken, Settings, SyncRun, SyncRunItem } from "@prisma/client";

type DashboardData = {
  settings: Settings;
  tokens: AuthToken[];
  lastRun: (SyncRun & { items: SyncRunItem[] }) | null;
  adminToken?: string;
  appleDeveloperToken: string;
};

export function renderDashboard(data: DashboardData): string {
  const spotifyConnected = data.tokens.some((token) => token.provider === "SPOTIFY" && token.status === "CONNECTED");
  const appleConnected = data.tokens.some((token) => token.provider === "APPLE" && token.status === "CONNECTED");
  const tokenQuery = data.adminToken ? `?token=${encodeURIComponent(data.adminToken)}` : "";

  return htmlPage(`
    <header>
      <h1>BlendSync</h1>
      <p>Daily Spotify Blend snapshots for Apple Music.</p>
    </header>
    <main>
      <section>
        <h2>Connections</h2>
        <div class="grid">
          <div class="panel">
            <strong>Spotify</strong>
            <span class="${spotifyConnected ? "ok" : "warn"}">${spotifyConnected ? "Connected" : "Not connected"}</span>
            <a class="button" href="/auth/spotify${tokenQuery}">Connect Spotify</a>
          </div>
          <div class="panel">
            <strong>Apple Music</strong>
            <span class="${appleConnected ? "ok" : "warn"}">${appleConnected ? "Connected" : "Not connected"}</span>
            <button id="apple-connect">Connect Apple Music</button>
          </div>
        </div>
      </section>

      <section>
        <h2>Settings</h2>
        <form method="post" action="/settings${tokenQuery}">
          <label>Spotify Blend playlist ID
            <input name="spotifyBlendPlaylistId" value="${escapeHtml(data.settings.spotifyBlendPlaylistId ?? "")}" required>
          </label>
          <label>Apple playlist prefix
            <input name="applePlaylistPrefix" value="${escapeHtml(data.settings.applePlaylistPrefix)}" required>
          </label>
          <label>Apple storefront
            <input name="appleStorefront" value="${escapeHtml(data.settings.appleStorefront)}" required>
          </label>
          <label>Sync time
            <input name="syncTime" value="${escapeHtml(data.settings.syncTime)}" pattern="[0-2][0-9]:[0-5][0-9]" required>
          </label>
          <label>Timezone
            <input name="timezone" value="${escapeHtml(data.settings.timezone)}" required>
          </label>
          <button type="submit">Save Settings</button>
        </form>
      </section>

      <section>
        <h2>Manual Sync</h2>
        <form method="post" action="/sync/run${tokenQuery}">
          <button type="submit">Run Sync Now</button>
        </form>
      </section>

      <section>
        <h2>Last Run</h2>
        ${renderRun(data.lastRun)}
      </section>
    </main>
    <script src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"></script>
    <script>
      document.getElementById("apple-connect").addEventListener("click", async () => {
        await MusicKit.configure({
          developerToken: ${JSON.stringify(data.appleDeveloperToken)},
          app: { name: "BlendSync", build: "0.1.0" }
        });
        const music = MusicKit.getInstance();
        const userToken = await music.authorize();
        await fetch("/auth/apple${tokenQuery}", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userToken })
        });
        location.reload();
      });
    </script>
  `);
}

function renderRun(run: DashboardData["lastRun"]): string {
  if (!run) return "<p>No sync has run yet.</p>";

  const skipped = run.items.filter((item) => item.skipReason);
  return `
    <div class="panel">
      <p><strong>Status:</strong> ${run.status}</p>
      <p><strong>Playlist:</strong> ${escapeHtml(run.applePlaylistName ?? "-")} (${escapeHtml(run.applePlaylistId ?? "-")})</p>
      <p><strong>Tracks:</strong> ${run.matchedCount} matched, ${run.skippedCount} skipped, ${run.sourceTrackCount} source</p>
      ${run.errorSummary ? `<p class="warn">${escapeHtml(run.errorSummary)}</p>` : ""}
    </div>
    ${
      skipped.length
        ? `<table>
            <thead><tr><th>#</th><th>Track</th><th>Artists</th><th>Reason</th></tr></thead>
            <tbody>
              ${skipped
                .map(
                  (item) =>
                    `<tr><td>${item.position}</td><td>${escapeHtml(item.spotifyName)}</td><td>${escapeHtml(item.spotifyArtists)}</td><td>${escapeHtml(item.skipReason ?? "")}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>`
        : "<p>No skipped tracks.</p>"
    }
  `;
}

function htmlPage(body: string): string {
  return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>BlendSync</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #f7f5ef; color: #17201b; }
      header, main { max-width: 980px; margin: 0 auto; padding: 24px; }
      header { padding-top: 48px; }
      h1 { margin: 0 0 6px; font-size: 36px; letter-spacing: 0; }
      h2 { margin-top: 32px; font-size: 20px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
      .panel { border: 1px solid #cfc8ba; border-radius: 8px; padding: 16px; background: #fffdf8; }
      form { display: grid; gap: 14px; max-width: 560px; }
      label { display: grid; gap: 6px; font-weight: 650; }
      input { min-height: 40px; padding: 0 10px; border: 1px solid #aaa18e; border-radius: 6px; font: inherit; }
      button, .button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 14px; border: 0; border-radius: 6px; background: #176b54; color: #fff; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; width: fit-content; }
      .ok { color: #176b54; display: block; margin: 8px 0 14px; }
      .warn { color: #a33d26; display: block; margin: 8px 0 14px; }
      table { width: 100%; border-collapse: collapse; background: #fffdf8; border: 1px solid #cfc8ba; }
      th, td { padding: 10px; border-bottom: 1px solid #d8d0c0; text-align: left; vertical-align: top; }
      @media (prefers-color-scheme: dark) {
        body { background: #101411; color: #eef1eb; }
        .panel, table { background: #171d19; border-color: #334038; }
        th, td { border-color: #334038; }
        input { background: #101411; color: #eef1eb; border-color: #526058; }
      }
    </style>
  </head>
  <body>${body}</body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#039;";
    }
  });
}
