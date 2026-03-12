// api/cron-collect.js
// Récupère les résultats des batches Anthropic terminés
// et les sauvegarde dans Supabase.

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function getAuthToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

async function sbRequest(path, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await r.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!r.ok) {
    throw new Error(`Supabase error ${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  return data;
}

async function sbUpsertAnalysis(ticker, data) {
  await sbRequest('analyses_cache', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates'
    },
    body: {
      ticker: ticker.toUpperCase(),
      data,
      updated_at: new Date().toISOString()
    }
  });
}

async function sbGetPendingBatches(limit = 10) {
  return await sbRequest(
    `analysis_batches?status=in.(queued,in_progress)&select=*&order=requested_at.asc&limit=${limit}`
  );
}

async function sbUpdateBatch(batchId, patch) {
  await sbRequest(`analysis_batches?batch_id=eq.${encodeURIComponent(batchId)}`, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=minimal'
    },
    body: patch
  });
}

function extractJsonFromAnthropicMessage(message) {
  const raw = (message?.content || []).map(c => c?.text || '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('JSON introuvable dans la réponse IA');
  }

  return JSON.parse(jsonMatch[0]);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!SB_URL || !SB_KEY || !ANTHROPIC_API_KEY || !CRON_SECRET) {
      return res.status(500).json({
        error: 'Variables manquantes',
        missing: {
          SUPABASE_URL: !SB_URL,
          SUPABASE_SERVICE_KEY_OR_ANON: !SB_KEY,
          ANTHROPIC_API_KEY: !ANTHROPIC_API_KEY,
          CRON_SECRET: !CRON_SECRET
        }
      });
    }

    const token = getAuthToken(req) || String(req.query?.secret || "").trim();
    if (token !== CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const pending = await sbGetPendingBatches(10);

    if (!pending.length) {
      return res.status(200).json({
        message: 'Aucun batch en attente',
        processed: 0
      });
    }

    let processed = 0;
    let totalSaved = 0;
    let totalFailed = 0;
    const details = [];

    for (const batch of pending) {
      const batchId = batch.batch_id;

      const statusRes = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'message-batches-2024-09-24'
        }
      });

      const statusText = await statusRes.text();
      let statusData = null;

      try {
        statusData = statusText ? JSON.parse(statusText) : null;
      } catch {
        statusData = statusText;
      }

      if (!statusRes.ok) {
        await sbUpdateBatch(batchId, {
          status: 'error',
          last_checked_at: new Date().toISOString(),
          meta: {
            ...(batch.meta || {}),
            collect_error: statusData
          }
        });

        details.push({
          batchId,
          status: 'error',
          error: statusData
        });
        processed++;
        continue;
      }

      const processingStatus = statusData?.processing_status || 'unknown';

      if (processingStatus !== 'ended') {
        await sbUpdateBatch(batchId, {
          status: processingStatus === 'in_progress' ? 'in_progress' : 'queued',
          last_checked_at: new Date().toISOString(),
          meta: {
            ...(batch.meta || {}),
            last_status_payload: {
              processing_status: processingStatus
            }
          }
        });

        details.push({
          batchId,
          status: processingStatus,
          saved: 0,
          failed: 0
        });
        processed++;
        continue;
      }

      const resultsUrl = statusData?.results_url;

      if (!resultsUrl) {
        await sbUpdateBatch(batchId, {
          status: 'ended_no_results_url',
          last_checked_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          meta: {
            ...(batch.meta || {}),
            last_status_payload: statusData
          }
        });

        details.push({
          batchId,
          status: 'ended_no_results_url',
          saved: 0,
          failed: 0
        });
        processed++;
        continue;
      }

      const resultsRes = await fetch(resultsUrl, {
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'message-batches-2024-09-24'
        }
      });

      const resultsText = await resultsRes.text();

      if (!resultsRes.ok) {
        await sbUpdateBatch(batchId, {
          status: 'results_fetch_error',
          last_checked_at: new Date().toISOString(),
          meta: {
            ...(batch.meta || {}),
            results_error: resultsText
          }
        });

        details.push({
          batchId,
          status: 'results_fetch_error',
          error: resultsText
        });
        processed++;
        continue;
      }

      const lines = resultsText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      let saved = 0;
      let failed = 0;

      for (const line of lines) {
        try {
          const item = JSON.parse(line);

          if (item?.result?.type !== 'succeeded') {
            failed++;
            continue;
          }

          const parsed = extractJsonFromAnthropicMessage(item.result.message);
const originalTicker =
  batch?.meta?.customIdMap?.[item.custom_id] || item.custom_id;

await sbUpsertAnalysis(originalTicker, parsed);
saved++;
        } catch (e) {
          failed++;
        }
      }

      await sbUpdateBatch(batchId, {
        status: 'completed',
        last_checked_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        saved_count: saved,
        failed_count: failed,
        meta: {
          ...(batch.meta || {}),
          line_count: lines.length
        }
      });

      totalSaved += saved;
      totalFailed += failed;
      details.push({
        batchId,
        status: 'completed',
        saved,
        failed
      });
      processed++;
    }

    return res.status(200).json({
      message: 'Collect terminé',
      processed,
      totalSaved,
      totalFailed,
      details
    });
  } catch (err) {
    console.error('cron-collect error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
  }
}
