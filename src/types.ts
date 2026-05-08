export type SpotifyTrack = {
  id: string;
  uri: string;
  name: string;
  artists: string[];
  album?: string;
  durationMs: number;
  isrc?: string;
};

export type AppleSongCandidate = {
  id: string;
  name: string;
  artistName: string;
  albumName?: string;
  durationMs?: number;
  isrc?: string;
};

export type TrackMatch =
  | {
      status: "matched";
      appleSongId: string;
      method: "isrc" | "metadata" | "cache";
      confidence: number;
    }
  | {
      status: "skipped";
      reason: string;
    };
