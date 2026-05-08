import type { AppleSongCandidate, SpotifyTrack, TrackMatch } from "./types.js";

export function chooseBestMetadataMatch(track: SpotifyTrack, candidates: AppleSongCandidate[]): TrackMatch {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      confidence: scoreCandidate(track, candidate)
    }))
    .filter((entry) => entry.confidence >= 0.92)
    .sort((a, b) => b.confidence - a.confidence);

  if (scored.length === 0) {
    return { status: "skipped", reason: "No confident Apple Music match found." };
  }

  const [best, second] = scored;
  if (!best) {
    return { status: "skipped", reason: "No confident Apple Music match found." };
  }

  if (second && best.confidence - second.confidence < 0.03) {
    return { status: "skipped", reason: "Ambiguous Apple Music match." };
  }

  return {
    status: "matched",
    appleSongId: best.candidate.id,
    method: "metadata",
    confidence: best.confidence
  };
}

export function scoreCandidate(track: SpotifyTrack, candidate: AppleSongCandidate): number {
  const titleScore = normalizedEquality(track.name, candidate.name) ? 0.4 : 0;
  const spotifyArtists = track.artists.map(normalizeText).join(" ");
  const artistScore = spotifyArtists.includes(normalizeText(candidate.artistName)) || normalizeText(candidate.artistName).includes(spotifyArtists)
    ? 0.35
    : 0;
  const durationDelta = candidate.durationMs ? Math.abs(candidate.durationMs - track.durationMs) : Number.POSITIVE_INFINITY;
  const durationScore = durationDelta <= 2_500 ? 0.2 : durationDelta <= 5_000 ? 0.1 : 0;
  const albumScore = track.album && candidate.albumName && normalizedEquality(track.album, candidate.albumName) ? 0.05 : 0;
  return titleScore + artistScore + durationScore + albumScore;
}

function normalizedEquality(left: string, right: string): boolean {
  return normalizeText(left) === normalizeText(right);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
