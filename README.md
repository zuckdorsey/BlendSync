# BlendSync

BlendSync is a self-hosted service that automatically creates daily Apple Music playlist snapshots from your Spotify Blend playlist.

Every day at the configured time, BlendSync will:
1. Fetch tracks from your Spotify Blend playlist
2. Find matching tracks in Apple Music using ISRC or track metadata
3. Create a new Apple Music playlist with the format: `Spotify Blend - YYYY-MM-DD`

## Key Features

- **Spotify OAuth Connection**: Securely connect your Spotify account using OAuth
- **Apple Music Integration**: Connect to Apple Music via MusicKit API
- **Automatic Scheduling**: Daily synchronization at a configurable time (default: 07:00 Asia/Jakarta)
- **Smart Track Matching**: 
  - Primary: Match by ISRC code
  - Fallback: Match by title, artist, and duration
- **Snapshot Playlists**: Create a new playlist daily instead of overwriting
- **Tracking & Reports**: 
  - Complete synchronization history
  - Record unmatched tracks and reasons
  - Dashboard for monitoring status

## Prerequisites

- **Node.js**: >= 22.x
- **Database**: PostgreSQL 12+
- **Spotify Developer Account**: https://developer.spotify.com/dashboard
- **Apple Developer Account**: https://developer.apple.com

## Initial Setup

### 1. Create Spotify Application

1. Visit https://developer.spotify.com/dashboard
2. Login or sign up for a Spotify Developer account
3. Create a new application
4. Get your **Client ID** and **Client Secret**
5. Add the Redirect URI:
   ```
   https://your-app.example.com/auth/spotify/callback
   ```

### 2. Create Apple Music API Credentials

1. Visit https://developer.apple.com
2. Log in to your developer account
3. Create a new MusicKit identifier
4. Generate a private key and note:
   - **Team ID**
   - **Key ID**
   - **Private Key** (PEM format)

### 3. Setup Local Repository

```bash
# Clone repository
git clone <repo-url>
cd BlendSync

# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/blendsync"

# Server
BASE_URL="http://localhost:3000"
PORT=3000

# Security
APP_SECRET="your-secret-key-min-24-characters"
ADMIN_TOKEN="your-admin-token-min-12-characters"

# Spotify
SPOTIFY_CLIENT_ID="your-spotify-client-id"
SPOTIFY_CLIENT_SECRET="your-spotify-client-secret"

# Apple Music
APPLE_TEAM_ID="your-apple-team-id"
APPLE_KEY_ID="your-apple-key-id"

# Apple Private Key (choose one):
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# OR
APPLE_PRIVATE_KEY_BASE64="base64-encoded-private-key"
```

### 5. Setup Database

```bash
npm run prisma:migrate
```

## Running the Application

### Development Mode
```bash
npm run dev
```
Server will run at `http://localhost:3000`

### Production Mode
```bash
npm run build
npm start
```

### Testing
```bash
npm test
```

## Usage

### Web Dashboard

1. Open http://localhost:3000
2. Enter your **Admin Token**
3. Connect Spotify:
   - Click "Connect Spotify"
   - Login with your Spotify account
   - Allow access to playlists
4. Connect Apple Music:
   - Click "Connect Apple Music"
   - Authorize with Apple Developer credentials
5. Configure Spotify Blend Playlist ID:
   - Find your playlist ID (from Spotify URI or link)
   - Enter it in the form
6. Run Sync:
   - Manual: Click "Sync Now" button on dashboard
   - Automatic: Wait for scheduler to run (default 07:00)

### Finding Your Spotify Blend Playlist ID

1. Open your Spotify Blend playlist
2. Click "..." → "Share" → "Copy link to playlist"
3. Link format: `https://open.spotify.com/playlist/PLAYLIST_ID`
4. The ID is the part after `/playlist/`

## Database Schema

### Settings
Stores global application configuration:
- Timezone (default: Asia/Jakarta)
- Sync time (default: 07:00)
- Apple Music playlist name prefix
- Apple Music storefront
- Spotify Blend Playlist ID

### AuthToken
Stores access tokens for Spotify and Apple Music:
- Access token & refresh token
- Connection status
- Additional metadata

### TrackMatchCache
Cache of track matching results to improve performance:
- ISRC code
- Matched Apple Song ID
- Confidence score
- Matching method used

### SyncRun
Records history of each sync operation:
- Status (RUNNING, SUCCESS, PARTIAL, FAILED)
- Number of matched tracks
- Created Apple Playlist ID
- Error summary if any

### SyncRunItem
Details for each track in a sync operation:
- Track information from Spotify
- Apple Song ID (if successfully matched)
- Reason if track could not be matched

## Advanced Configuration

### Changing Sync Schedule

Edit via dashboard or modify database:
```sql
UPDATE "Settings" SET 
  timezone = 'Asia/Bangkok', 
  syncTime = '09:00'
WHERE id = 'default';
```

Timezone format: IANA timezone identifiers (example: `Asia/Jakarta`, `UTC`, `America/New_York`)

### Changing Playlist Name Prefix

```sql
UPDATE "Settings" SET 
  applePlaylistPrefix = 'My Daily Blend'
WHERE id = 'default';
```

### Changing Apple Music Storefront

Update `appleStorefront` according to region:
- `id` - Indonesia
- `us` - United States
- `gb` - United Kingdom
- `au` - Australia
- etc. (see Apple Music API docs)

## Deployment

### Hosting Requirements

- Node.js 22.x runtime
- PostgreSQL 12+ database
- Minimum 512MB RAM

### Environment Variables for Production

Ensure all `.env` variables are filled and secure:
```env
NODE_ENV=production
DATABASE_URL=... # Secure connection string
BASE_URL=https://your-app.example.com
APP_SECRET=... # Strong secret key (random 24+ characters)
ADMIN_TOKEN=... # Strong token (random 12+ characters)
# ... (all other credentials)
```

### Running with Docker

```bash
docker build -t blendsync .
docker run -d \
  --name blendsync \
  -e DATABASE_URL="..." \
  -e BASE_URL="..." \
  # ... (add all env vars)
  -p 3000:3000 \
  blendsync
```

### Deploy to PaaS (Vercel, Railway, Render, etc)

1. Push to your Git repository
2. Connect your repository to your PaaS platform
3. Set environment variables on the platform
4. Set build command: `npm run build`
5. Set start command: `npm start`
6. Add PostgreSQL add-on if your platform supports it

## Project Structure

```
BlendSync/
├── src/
│   ├── apple.ts              # Apple Music client & API integration
│   ├── appleToken.ts         # Apple Music token management
│   ├── config.ts             # Environment variable validation
│   ├── db.ts                 # Prisma client & database helpers
│   ├── matching.ts           # Track matching logic
│   ├── scheduler.ts          # Scheduler for automatic sync
│   ├── security.ts           # Authentication & security utilities
│   ├── server.ts             # Fastify server setup
│   ├── spotify.ts            # Spotify client & API integration
│   ├── sync.ts               # Main sync service logic
│   ├── types.ts              # TypeScript type definitions
│   └── views.ts              # HTML dashboard templates
├── test/                     # Unit tests
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Available Scripts

```bash
npm run dev              # Start development server with watch mode
npm run build            # Typecheck without emit (validate TypeScript)
npm start                # Start production server
npm test                 # Run unit tests
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Create & run database migration
npm run prisma:deploy    # Deploy migration to production
```

### Tech Stack

- **Framework**: Fastify (lightweight & fast web framework)
- **Database ORM**: Prisma
- **Language**: TypeScript
- **Validation**: Zod (schema validation)
- **Authentication**: JWT & OAuth2
- **Scheduler**: node-cron
- **Testing**: Vitest
- **Logging**: Pino

## Troubleshooting

### "Cannot find module" error
```bash
npm run prisma:generate
npm install
```

### Database connection failed
- Ensure PostgreSQL is running
- Check `DATABASE_URL` in `.env`
- Verify credentials and permissions

### Spotify connection error
- Verify Client ID & Secret in `.env`
- Ensure redirect URI is registered in Spotify Dashboard
- Check token expiration in database

### Apple Music connection error
- Verify Apple Team ID, Key ID, Private Key in `.env`
- Ensure private key format is correct (PEM format)
- If using `APPLE_PRIVATE_KEY_BASE64`, verify base64 is valid

### Tracks not matching
- Check ISRC code in Spotify vs Apple Music
- Verify Apple Music storefront is correct for your region
- Some tracks may not be available on Apple Music

## License

[Add license information as needed]

## Author

[Add author information]

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support & Issues

If you find a bug or have questions:
- Open an issue on the repository
- Include error messages and steps to reproduce
- Add environment info (Node version, OS, etc)

## PaaS Deployment

Install dependencies, run migrations, and start the server:

```bash
npm install
npm run prisma:deploy
npm start
```

Keep the service always running so the in-process scheduler can execute at 07:00 Asia/Jakarta. If your PaaS platform sleeps idle apps, configure an external cron to call:

```text
POST /sync/run?token=ADMIN_TOKEN
```
