import { createAppleDeveloperToken } from "./appleToken.js";
import type { AppConfig } from "./config.js";
import { getSettings, prisma } from "./db.js";
import { chooseBestMetadataMatch } from "./matching.js";
import type { AppleSongCandidate, SpotifyTrack, TrackMatch } from "./types.js";

type AppleSearchResponse = {
  results?: {
    songs?: {
      data: AppleSongResource[];
    };
  };
};

type AppleSongResource = {
  id: string;
  attributes: {
    name: string;
    artistName: string;
    albumName?: string;
    durationInMillis?: number;
    isrc?: string;
  };
};

type AppleCreatePlaylistResponse = {
  data: Array<{ id: string }>;
};

export class AppleMusicClient {
  constructor(private readonly config: AppConfig) {}

  getDeveloperToken(): string {
    return createAppleDeveloperToken(this.config);
  }

  async saveUserToken(userToken: string): Promise<void> {
    await prisma.authToken.upsert({
      where: { provider: "APPLE" },
      update: { userToken, status: "CONNECTED" },
      create: { provider: "APPLE", userToken, status: "CONNECTED" }
    });
  }

  async matchTrack(track: SpotifyTrack): Promise<TrackMatch> {
    const cached = await prisma.trackMatchCache.findUnique({ where: { spotifyTrackId: track.id } });
    if (cached) {
      return {
        status: "matched",
        appleSongId: cached.appleSongId,
        method: "cache",
        confidence: cached.confidence
      };
    }

    if (track.isrc) {
      const isrcMatch = await this.findByIsrc(track.isrc);
      if (isrcMatch) {
        await this.cacheMatch(track, isrcMatch.id, "isrc", 1);
        return { status: "matched", appleSongId: isrcMatch.id, method: "isrc", confidence: 1 };
      }
    }

    const metadataCandidates = await this.searchByMetadata(track);
    const match = chooseBestMetadataMatch(track, metadataCandidates);
    if (match.status === "matched") {
      await this.cacheMatch(track, match.appleSongId, match.method, match.confidence);
    }
    return match;
  }

  async createPlaylist(name: string, appleSongIds: string[]): Promise<string> {
    const response = await this.appleFetch<AppleCreatePlaylistResponse>("https://api.music.apple.com/v1/me/library/playlists", {
      method: "POST",
      body: JSON.stringify(buildApplePlaylistCreationPayload(name, appleSongIds))
    });

    const playlistId = response.data[0]?.id;
    if (!playlistId) {
      throw new Error("Apple Music did not return a playlist id.");
    }
    return playlistId;
  }

  private async findByIsrc(isrc: string): Promise<AppleSongCandidate | undefined> {
    const settings = await getSettings();
    const url = `https://api.music.apple.com/v1/catalog/${encodeURIComponent(settings.appleStorefront)}/songs?filter[isrc]=${encodeURIComponent(isrc)}`;
    const response = await this.appleFetch<{ data?: AppleSongResource[] }>(url);
    const song = response.data?.[0];
    return song ? toCandidate(song) : undefined;
  }

  private async searchByMetadata(track: SpotifyTrack): Promise<AppleSongCandidate[]> {
    const settings = await getSettings();
    const term = `${track.name} ${track.artists[0] ?? ""}`;
    const params = new URLSearchParams({
      term,
      types: "songs",
      limit: "10"
    });
    const response = await this.appleFetch<AppleSearchResponse>(
      `https://api.music.apple.com/v1/catalog/${encodeURIComponent(settings.appleStorefront)}/search?${params.toString()}`
    );
    return response.results?.songs?.data.map(toCandidate) ?? [];
  }

  private async cacheMatch(track: SpotifyTrack, appleSongId: string, matchMethod: string, confidence: number) {
    await prisma.trackMatchCache.upsert({
      where: { spotifyTrackId: track.id },
      update: { appleSongId, matchMethod, confidence, isrc: track.isrc },
      create: {
        spotifyTrackId: track.id,
        isrc: track.isrc,
        appleSongId,
        matchMethod,
        confidence
      }
    });
  }

  private async appleFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await prisma.authToken.findUnique({ where: { provider: "APPLE" } });
    if (!token?.userToken) {
      throw new Error("Apple Music is not connected.");
    }

    const response = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${this.getDeveloperToken()}`,
        "music-user-token": token.userToken,
        "content-type": "application/json",
        ...init.headers
      }
    });

    if (response.status === 401 || response.status === 403) {
      await prisma.authToken.update({
        where: { provider: "APPLE" },
        data: { status: "NEEDS_REAUTH" }
      });
      throw new Error("Apple Music authorization failed. Reconnect Apple Music.");
    }

    if (!response.ok) {
      throw new Error(`Apple Music request failed: ${response.status} ${await response.text()}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}

export function buildApplePlaylistCreationPayload(name: string, appleSongIds: string[]) {
  return {
    attributes: {
      name,
      description: `Created by BlendSync on ${new Date().toISOString()}`,
      isPublic: false
    },
    relationships: {
      tracks: {
        data: appleSongIds.map((id) => ({ id, type: "songs" }))
      }
    }
  };
}

function toCandidate(song: AppleSongResource): AppleSongCandidate {
  return {
    id: song.id,
    name: song.attributes.name,
    artistName: song.attributes.artistName,
    albumName: song.attributes.albumName,
    durationMs: song.attributes.durationInMillis,
    isrc: song.attributes.isrc
  };
}
