# BlendSync

BlendSync is a personal hosted service that creates a daily Apple Music playlist snapshot from a Spotify Blend playlist.

## What It Does

- Connects one Spotify account with OAuth.
- Connects one Apple Music account with MusicKit JS.
- Reads a configured Spotify Blend playlist every day at 07:00 Asia/Jakarta.
- Matches tracks in Apple Music by ISRC first, then strict title/artist/duration matching.
- Creates a new Apple Music playlist named `Spotify Blend - YYYY-MM-DD`.
- Records skipped tracks and sync reports in Postgres.

Apple Music's public API documents playlist creation and appending tracks, but not a full replace/remove flow for library playlist tracks. BlendSync therefore creates dated snapshot playlists instead of mutating one target playlist.

## Setup

1. Create a Spotify app at <https://developer.spotify.com/dashboard>.
2. Add this redirect URI:

   ```text
   https://your-app.example.com/auth/spotify/callback
   ```

3. Create Apple Music API credentials in Apple Developer:
   - MusicKit identifier
   - Private key
   - Team ID
   - Key ID

4. Copy `.env.example` to `.env` and fill the values.
5. Install dependencies and prepare the database:

   ```bash
   npm install
   npm run prisma:generate
   npm run prisma:migrate
   ```

6. Start locally:

   ```bash
   npm run dev
   ```

7. Open `/`, enter the admin token, connect Spotify, connect Apple Music, set the Spotify Blend playlist ID, then run a manual sync.

## PaaS Deployment

Use Node 22, Postgres, and these commands:

```bash
npm install
npm run prisma:deploy
npm run start
```

Keep the service always on so the in-process scheduler can run at 07:00 Asia/Jakarta. If your PaaS sleeps apps, configure an external cron to call:

```text
POST /sync/run?token=ADMIN_TOKEN
```
