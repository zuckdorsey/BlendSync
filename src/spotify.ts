import { prisma } from "./db.js";
import type { AppConfig } from "./config.js";
import type { SpotifyTrack } from "./types.js";

type SpotifyTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type SpotifyPlaylistItemsResponse = {
  next: string | null;
  items: Array<{
    track: null | {
      id: string | null;
      uri: string;
      type: string;
      is_local?: boolean;
      name: string;
      duration_ms: number;
      artists: Array<{ name: string }>;
      album?: { name: string };
      external_ids?: { isrc?: string };
    };
  }>;
};

type SpotifyPlaylistResponse = {
  snapshot_id: string;
};

export class SpotifyClient {
  constructor(private readonly config: AppConfig) {}

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.SPOTIFY_CLIENT_ID,
      scope: "playlist-read-private playlist-read-collaborative",
      redirect_uri: `${this.config.BASE_URL}/auth/spotify/callback`,
      state
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<void> {
    const token = await this.requestToken({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${this.config.BASE_URL}/auth/spotify/callback`
    });

    await prisma.authToken.upsert({
      where: { provider: "SPOTIFY" },
      update: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        status: "CONNECTED"
      },
      create: {
        provider: "SPOTIFY",
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        status: "CONNECTED"
      }
    });
  }

  async getPlaylistTracks(playlistId: string): Promise<{ snapshotId: string; tracks: SpotifyTrack[] }> {
    const accessToken = await this.getAccessToken();
    const playlist = await this.spotifyFetch<SpotifyPlaylistResponse>(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}?fields=snapshot_id`,
      accessToken
    );

    const fields = [
      "next",
      "items(track(id,uri,type,is_local,name,duration_ms,artists(name),album(name),external_ids(isrc)))"
    ].join(",");
    let url: string | null =
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items?limit=100&additional_types=track&fields=${encodeURIComponent(fields)}`;
    const tracks: SpotifyTrack[] = [];

    while (url) {
      const page = await this.spotifyFetch<SpotifyPlaylistItemsResponse>(url, accessToken);
      tracks.push(...normalizeSpotifyItems(page.items));
      url = page.next;
    }

    return { snapshotId: playlist.snapshot_id, tracks };
  }

  private async getAccessToken(): Promise<string> {
    const token = await prisma.authToken.findUnique({ where: { provider: "SPOTIFY" } });
    if (!token?.refreshToken) {
      throw new Error("Spotify is not connected.");
    }

    if (token.accessToken && token.expiresAt && token.expiresAt.getTime() > Date.now() + 60_000) {
      return token.accessToken;
    }

    const refreshed = await this.requestToken({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken
    });

    await prisma.authToken.update({
      where: { provider: "SPOTIFY" },
      data: {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? token.refreshToken,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        status: "CONNECTED"
      }
    });

    return refreshed.access_token;
  }

  private async requestToken(body: Record<string, string>): Promise<SpotifyTokenResponse> {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization:
          "Basic " +
          Buffer.from(`${this.config.SPOTIFY_CLIENT_ID}:${this.config.SPOTIFY_CLIENT_SECRET}`).toString("base64")
      },
      body: new URLSearchParams(body)
    });

    if (!response.ok) {
      throw new Error(`Spotify token request failed: ${response.status} ${await response.text()}`);
    }

    return response.json() as Promise<SpotifyTokenResponse>;
  }

  private async spotifyFetch<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error(`Spotify request failed: ${response.status} ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }
}

export function normalizeSpotifyItems(items: SpotifyPlaylistItemsResponse["items"]): SpotifyTrack[] {
  return items.flatMap(({ track }) => {
    if (!track || track.type !== "track" || track.is_local || !track.id) return [];

    return [
      {
        id: track.id,
        uri: track.uri,
        name: track.name,
        artists: track.artists.map((artist) => artist.name),
        album: track.album?.name,
        durationMs: track.duration_ms,
        isrc: track.external_ids?.isrc
      }
    ];
  });
}
