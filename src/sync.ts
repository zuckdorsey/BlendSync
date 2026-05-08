import { AppleMusicClient } from "./apple.js";
import type { AppConfig } from "./config.js";
import { getSettings, prisma } from "./db.js";
import { SpotifyClient } from "./spotify.js";
import type { SpotifyTrack, TrackMatch } from "./types.js";

export class SyncService {
  constructor(
    private readonly config: AppConfig,
    private readonly spotify = new SpotifyClient(config),
    private readonly apple = new AppleMusicClient(config)
  ) {}

  async runNow(): Promise<string> {
    const settings = await getSettings();
    if (!settings.spotifyBlendPlaylistId) {
      throw new Error("Spotify Blend playlist ID is not configured.");
    }

    const syncRun = await prisma.syncRun.create({ data: { status: "RUNNING" } });

    try {
      const source = await this.spotify.getPlaylistTracks(settings.spotifyBlendPlaylistId);
      const matchedSongIds: string[] = [];
      const itemResults: Array<{
        track: SpotifyTrack;
        position: number;
        match: TrackMatch;
      }> = [];

      for (const [index, track] of source.tracks.entries()) {
        const match = await this.apple.matchTrack(track);
        itemResults.push({ track, position: index + 1, match });
        if (match.status === "matched") {
          matchedSongIds.push(match.appleSongId);
        }
      }

      const playlistName = `${settings.applePlaylistPrefix} - ${formatDateInTimezone(new Date(), settings.timezone)}`;
      const applePlaylistId = matchedSongIds.length > 0 ? await this.apple.createPlaylist(playlistName, matchedSongIds) : undefined;
      const matchedCount = itemResults.filter((item) => item.match.status === "matched").length;
      const skippedCount = itemResults.length - matchedCount;

      await prisma.$transaction([
        prisma.syncRun.update({
          where: { id: syncRun.id },
          data: {
            status: skippedCount > 0 ? "PARTIAL" : "SUCCESS",
            finishedAt: new Date(),
            sourceSnapshotId: source.snapshotId,
            sourceTrackCount: source.tracks.length,
            matchedCount,
            skippedCount,
            applePlaylistId,
            applePlaylistName: playlistName
          }
        }),
        ...itemResults.map((item) =>
          prisma.syncRunItem.create({
            data: {
              syncRunId: syncRun.id,
              position: item.position,
              spotifyTrackId: item.track.id,
              spotifyName: item.track.name,
              spotifyArtists: item.track.artists.join(", "),
              spotifyAlbum: item.track.album,
              isrc: item.track.isrc,
              appleSongId: item.match.status === "matched" ? item.match.appleSongId : undefined,
              matchMethod: item.match.status === "matched" ? item.match.method : undefined,
              confidence: item.match.status === "matched" ? item.match.confidence : undefined,
              skipReason: item.match.status === "skipped" ? item.match.reason : undefined
            }
          })
        )
      ]);

      return syncRun.id;
    } catch (error) {
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          errorSummary: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }
}

export function formatDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
