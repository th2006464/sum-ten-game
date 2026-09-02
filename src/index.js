const MAX_RECORDS_PER_REQUEST = 20;
const MAX_SCORE = 1_000_000;
const MAX_DURATION_SECONDS = 86_400;
const modes = new Set(['default', 'countdown', 'stopwatch']);

function validRecord(value) {
  return value
    && typeof value.id === 'string' && value.id.length >= 16 && value.id.length <= 100
    && typeof value.clientId === 'string' && value.clientId.length >= 16 && value.clientId.length <= 100
    && modes.has(value.mode)
    && Number.isInteger(value.score) && value.score >= 0 && value.score <= MAX_SCORE
    && Number.isInteger(value.totalScore) && value.totalScore >= 0 && value.totalScore <= MAX_SCORE
    && Number.isInteger(value.durationSeconds) && value.durationSeconds >= 0 && value.durationSeconds <= MAX_DURATION_SECONDS
    && typeof value.endedAt === 'string' && !Number.isNaN(Date.parse(value.endedAt));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, service: 'sum-ten-game-api', database: Boolean(env.DB) });
    }

    if (url.pathname === '/api/games' && request.method === 'GET') {
      const clientId = url.searchParams.get('clientId') || '';
      const requestedLimit = Number(url.searchParams.get('limit') || 20);
      const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
      if (clientId.length < 16 || clientId.length > 100) {
        return Response.json({ ok: false, error: 'A valid clientId is required.' }, { status: 400 });
      }
      try {
        const { results } = await env.DB.prepare(
          `SELECT id, mode, score, total_score AS totalScore,
                  duration_seconds AS durationSeconds, ended_at AS endedAt
             FROM game_records
            WHERE client_id = ?
            ORDER BY created_at DESC
            LIMIT ?`
        ).bind(clientId, limit).all();
        return Response.json({ ok: true, records: results });
      } catch (error) {
        console.error(JSON.stringify({ event: 'game_history_failed', message: String(error) }));
        return Response.json({ ok: false, error: 'Could not load game history.' }, { status: 500 });
      }
    }

    if (url.pathname === '/api/games' && request.method === 'POST') {
      try {
        const body = await request.json();
        const records = Array.isArray(body?.records) ? body.records : [body];
        if (!records.length || records.length > MAX_RECORDS_PER_REQUEST || !records.every(validRecord)) {
          return Response.json({ ok: false, error: 'Invalid game record.' }, { status: 400 });
        }
        await env.DB.batch(records.map(record => env.DB.prepare(
          `INSERT OR IGNORE INTO game_records
            (id, client_id, mode, score, total_score, duration_seconds, ended_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          record.id, record.clientId, record.mode, record.score,
          record.totalScore, record.durationSeconds, record.endedAt
        )));
        return Response.json({ ok: true, accepted: records.length });
      } catch (error) {
        console.error(JSON.stringify({ event: 'game_record_failed', message: String(error) }));
        return Response.json({ ok: false, error: 'Could not save game record.' }, { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
