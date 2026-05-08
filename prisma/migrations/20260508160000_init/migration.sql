CREATE TYPE "TokenProvider" AS ENUM ('SPOTIFY', 'APPLE');
CREATE TYPE "TokenStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH');
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

CREATE TABLE "Settings" (
  "id" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "syncTime" TEXT NOT NULL DEFAULT '07:00',
  "applePlaylistPrefix" TEXT NOT NULL DEFAULT 'Spotify Blend',
  "appleStorefront" TEXT NOT NULL DEFAULT 'id',
  "spotifyBlendPlaylistId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthToken" (
  "provider" "TokenProvider" NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "userToken" TEXT,
  "expiresAt" TIMESTAMP(3),
  "status" "TokenStatus" NOT NULL DEFAULT 'CONNECTED',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("provider")
);

CREATE TABLE "TrackMatchCache" (
  "spotifyTrackId" TEXT NOT NULL,
  "isrc" TEXT,
  "appleSongId" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "matchMethod" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrackMatchCache_pkey" PRIMARY KEY ("spotifyTrackId")
);

CREATE TABLE "SyncRun" (
  "id" TEXT NOT NULL,
  "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "sourceSnapshotId" TEXT,
  "sourceTrackCount" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "applePlaylistId" TEXT,
  "applePlaylistName" TEXT,
  "errorSummary" TEXT,
  CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SyncRunItem" (
  "id" TEXT NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "spotifyTrackId" TEXT,
  "spotifyName" TEXT NOT NULL,
  "spotifyArtists" TEXT NOT NULL,
  "spotifyAlbum" TEXT,
  "isrc" TEXT,
  "appleSongId" TEXT,
  "matchMethod" TEXT,
  "confidence" DOUBLE PRECISION,
  "skipReason" TEXT,
  CONSTRAINT "SyncRunItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrackMatchCache_isrc_idx" ON "TrackMatchCache"("isrc");
CREATE INDEX "SyncRunItem_syncRunId_idx" ON "SyncRunItem"("syncRunId");

ALTER TABLE "SyncRunItem"
  ADD CONSTRAINT "SyncRunItem_syncRunId_fkey"
  FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
