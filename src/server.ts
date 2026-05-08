import Fastify from "fastify";
import formBody from "@fastify/formbody";
import { AppleMusicClient } from "./apple.js";
import { loadConfig } from "./config.js";
import { getSettings, prisma } from "./db.js";
import { assertAdmin, createSignedState, verifySignedState } from "./security.js";
import { startScheduler } from "./scheduler.js";
import { SpotifyClient } from "./spotify.js";
import { SyncService } from "./sync.js";
import { renderDashboard } from "./views.js";

const config = loadConfig();
const app = Fastify({
  logger: {
    transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" }
  }
});

await app.register(formBody);

app.get("/health", async () => ({ ok: true }));

app.get("/", async (request, reply) => {
  assertAdmin(request, config);

  const [settings, tokens, lastRun] = await Promise.all([
    getSettings(),
    prisma.authToken.findMany(),
    prisma.syncRun.findFirst({
      orderBy: { startedAt: "desc" },
      include: { items: { orderBy: { position: "asc" } } }
    })
  ]);

  const apple = new AppleMusicClient(config);
  return reply.type("text/html").send(
    renderDashboard({
      settings,
      tokens,
      lastRun,
      adminToken: (request.query as { token?: string }).token,
      appleDeveloperToken: apple.getDeveloperToken()
    })
  );
});

app.get("/auth/spotify", async (request, reply) => {
  assertAdmin(request, config);
  const spotify = new SpotifyClient(config);
  const state = createSignedState(config, "spotify");
  return reply.redirect(spotify.getAuthorizationUrl(state));
});

app.get("/auth/spotify/callback", async (request, reply) => {
  const query = request.query as { code?: string; state?: string; error?: string };
  if (query.error) {
    throw new Error(`Spotify authorization failed: ${query.error}`);
  }
  if (!query.code || !query.state || !verifySignedState(config, query.state, "spotify")) {
    const error = new Error("Invalid Spotify OAuth callback.");
    (error as Error & { statusCode: number }).statusCode = 400;
    throw error;
  }

  const spotify = new SpotifyClient(config);
  await spotify.exchangeCode(query.code);
  return reply.redirect("/");
});

app.post("/auth/apple", async (request, reply) => {
  assertAdmin(request, config);
  const body = request.body as { userToken?: string };
  if (!body.userToken) {
    const error = new Error("Missing Apple Music user token.");
    (error as Error & { statusCode: number }).statusCode = 400;
    throw error;
  }

  const apple = new AppleMusicClient(config);
  await apple.saveUserToken(body.userToken);
  return reply.send({ ok: true });
});

app.post("/settings", async (request, reply) => {
  assertAdmin(request, config);
  const body = request.body as {
    spotifyBlendPlaylistId?: string;
    applePlaylistPrefix?: string;
    appleStorefront?: string;
    syncTime?: string;
    timezone?: string;
  };

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {
      spotifyBlendPlaylistId: body.spotifyBlendPlaylistId?.trim(),
      applePlaylistPrefix: body.applePlaylistPrefix?.trim() || "Spotify Blend",
      appleStorefront: body.appleStorefront?.trim().toLowerCase() || "id",
      syncTime: body.syncTime?.trim() || "07:00",
      timezone: body.timezone?.trim() || "Asia/Jakarta"
    },
    create: {
      id: "singleton",
      spotifyBlendPlaylistId: body.spotifyBlendPlaylistId?.trim(),
      applePlaylistPrefix: body.applePlaylistPrefix?.trim() || "Spotify Blend",
      appleStorefront: body.appleStorefront?.trim().toLowerCase() || "id",
      syncTime: body.syncTime?.trim() || "07:00",
      timezone: body.timezone?.trim() || "Asia/Jakarta"
    }
  });

  return reply.redirect(withToken("/", request.query as { token?: string }));
});

app.post("/sync/run", async (request, reply) => {
  assertAdmin(request, config);
  const sync = new SyncService(config);
  const syncRunId = await sync.runNow();

  if (request.headers.accept?.includes("application/json")) {
    return reply.send({ ok: true, syncRunId });
  }

  return reply.redirect(withToken("/", request.query as { token?: string }));
});

app.setErrorHandler(async (error, _request, reply) => {
  const statusCode = error.statusCode ?? 500;
  app.log.error(error);
  return reply.status(statusCode).send({
    error: error.message,
    statusCode
  });
});

await startScheduler(config);
await app.listen({ host: "0.0.0.0", port: config.PORT });

function withToken(path: string, query: { token?: string }) {
  return query.token ? `${path}?token=${encodeURIComponent(query.token)}` : path;
}
