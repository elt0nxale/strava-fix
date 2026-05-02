import { renderDashboard } from './html.js';
import {
  buildAuthUrl,
  exchangeCode,
  getValidAccessToken,
  saveTokens,
  getTokens,
  getActivity,
  updateActivity,
  listWebhookSubscriptions,
  createWebhookSubscription,
  deleteWebhookSubscription,
} from './strava.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function redirect(request, url) {
  const urlStr = url.toString();
  const absolute = urlStr.startsWith('http') ? urlStr : `${baseUrl(request)}${urlStr}`;
  return Response.redirect(absolute, 302);
}

function baseUrl(request) {
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

// Settings helpers
async function getSettings(kv) {
  return (await kv.get('settings', 'json')) ?? {
    speed_threshold_kmh: 7.0,
    target_type: 'Walk',
    enabled: true,
    check_name: true,
  };
}

async function saveSettings(kv, settings) {
  await kv.put('settings', JSON.stringify(settings));
}

// Activity log helpers (keep last 50)
async function getLog(kv) {
  return (await kv.get('activity_log', 'json')) ?? [];
}

async function appendLog(kv, entry) {
  const log = await getLog(kv);
  log.unshift(entry);
  await kv.put('activity_log', JSON.stringify(log.slice(0, 50)));
}

// ─── Core Fix Logic ───────────────────────────────────────────────────────────

/**
 * Decide if this activity should be re-typed and return the fix object,
 * or null if no change is needed.
 */
function shouldFix(activity, settings) {
  const { sport_type, average_speed, name } = activity;

  // Only act on activities that Strava calls "Run"
  if (sport_type !== 'Run') return null;

  // Convert m/s → km/h
  const kmh = (average_speed * 3.6).toFixed(2) * 1;
  const threshold = settings.speed_threshold_kmh ?? 7.0;
  const targetType = settings.target_type ?? 'Walk';

  const slowEnough = kmh < threshold;
  const nameHint =
    settings.check_name !== false &&
    (name ?? '').toLowerCase().includes('walk');

  if (slowEnough || nameHint) {
    return { targetType, kmh };
  }
  return null;
}

// ─── Webhook Handler ─────────────────────────────────────────────────────────

async function handleWebhookGet(request) {
  const url = new URL(request.url);
  const mode      = url.searchParams.get('hub.mode');
  const challenge = url.searchParams.get('hub.challenge');
  const verify    = url.searchParams.get('hub.verify_token');

  if (mode === 'subscribe' && verify === 'activityfix_verify') {
    return json({ 'hub.challenge': challenge });
  }
  return json({ error: 'forbidden' }, 403);
}

async function handleWebhookPost(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false }); }

  // Only care about activity creation events
  if (body.object_type !== 'activity' || body.aspect_type !== 'create') {
    return json({ ok: true, skipped: 'not a new activity' });
  }

  const kv = env.AF_KV;
  const settings = await getSettings(kv);

  if (!settings.enabled) {
    return json({ ok: true, skipped: 'auto-fix paused' });
  }

  const token = await getValidAccessToken(kv, env);
  if (!token) return json({ ok: false, error: 'not authenticated' }, 401);

  const activityId = body.object_id;
  const activity = await getActivity(token, activityId);
  if (!activity) return json({ ok: false, error: 'activity not found' });

  const fix = shouldFix(activity, settings);
  if (!fix) return json({ ok: true, skipped: 'no fix needed' });

  await updateActivity(token, activityId, { sport_type: fix.targetType });

  await appendLog(kv, {
    id: activityId,
    name: activity.name,
    original_type: activity.sport_type,
    fixed_type: fix.targetType,
    speed_kmh: fix.kmh,
    fixed_at: new Date().toISOString(),
  });

  console.log(`Fixed activity ${activityId}: Run → ${fix.targetType} (${fix.kmh} km/h)`);
  return json({ ok: true, fixed: fix.targetType });
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function handleDashboard(request, env, flash) {
  const kv = env.AF_KV;
  const tokens = await getTokens(kv);
  const settings = await getSettings(kv);
  const activityLog = await getLog(kv);

  // Check webhook status
  let webhookActive = false;
  try {
    const subs = await listWebhookSubscriptions(env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET);
    const base = baseUrl(request);
    webhookActive = Array.isArray(subs) && subs.some(s => s.callback_url?.includes(base));
  } catch { /* ignore */ }

  const page = renderDashboard({
    connected: !!tokens,
    athlete: tokens?.athlete ?? null,
    settings,
    activityLog,
    webhookActive,
    baseUrl: baseUrl(request),
    flash,
  });

  return html(page);
}

// ─── API Actions ──────────────────────────────────────────────────────────────

async function handleSetupWebhook(request, env) {
  try {
    const subs = await listWebhookSubscriptions(env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET);
    const base = baseUrl(request);

    // Remove existing subs pointing to this worker
    for (const sub of (subs ?? [])) {
      if (sub.callback_url?.includes(base)) {
        await deleteWebhookSubscription(env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, sub.id);
      }
    }

    await createWebhookSubscription(
      env.STRAVA_CLIENT_ID,
      env.STRAVA_CLIENT_SECRET,
      `${base}/webhook`,
      'activityfix_verify'
    );

    return redirect(request, '/?flash=ok&msg=Webhook+registered+successfully');
  } catch (e) {
    return redirect(request, `/?flash=err&msg=${encodeURIComponent(e.message)}`);
  }
}

async function handleRemoveWebhook(request, env) {
  try {
    const subs = await listWebhookSubscriptions(env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET);
    const base = baseUrl(request);
    for (const sub of (subs ?? [])) {
      if (sub.callback_url?.includes(base)) {
        await deleteWebhookSubscription(env.STRAVA_CLIENT_ID, env.STRAVA_CLIENT_SECRET, sub.id);
      }
    }
    return redirect(request, '/?flash=ok&msg=Webhook+removed');
  } catch (e) {
    return redirect(request, `/?flash=err&msg=${encodeURIComponent(e.message)}`);
  }
}

async function handleSaveSettings(request, env) {
  const form = await request.formData();
  const settings = {
    speed_threshold_kmh: parseFloat(form.get('speed_threshold_kmh') ?? '7'),
    target_type: form.get('target_type') ?? 'Walk',
    enabled: form.has('enabled'),
    check_name: form.has('check_name'),
  };
  await saveSettings(env.AF_KV, settings);
  return redirect(request, '/?flash=ok&msg=Settings+saved');
}

async function handleDisconnect(request, env) {
  const kv = env.AF_KV;
  await kv.delete('tokens');
  await kv.delete('activity_log');
  return redirect(request, '/');
}

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

async function handleAuthStart(request, env) {
  const url = buildAuthUrl(
    env.STRAVA_CLIENT_ID,
    `${baseUrl(request)}/auth/callback`
  );
  return redirect(request, url);
}

async function handleAuthCallback(request, env) {
  const url = new URL(request.url);
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return redirect(request, '/?flash=err&msg=Strava+auth+denied');
  }

  try {
    const tokens = await exchangeCode(
      env.STRAVA_CLIENT_ID,
      env.STRAVA_CLIENT_SECRET,
      code
    );
    await saveTokens(env.AF_KV, tokens);
    return redirect(request, '/?flash=ok&msg=Connected+to+Strava!');
  } catch (e) {
    return redirect(request, `/?flash=err&msg=${encodeURIComponent(e.message)}`);
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // ── Webhook (must be unauthenticated) ─────────────────────────
    if (path === '/webhook') {
      if (method === 'GET')  return handleWebhookGet(request);
      if (method === 'POST') return handleWebhookPost(request, env);
    }

    // ── OAuth ──────────────────────────────────────────────────────
    if (path === '/auth' && method === 'GET')
      return handleAuthStart(request, env);

    if (path === '/auth/callback' && method === 'GET')
      return handleAuthCallback(request, env);

    // ── API actions ────────────────────────────────────────────────
    if (path === '/api/setup-webhook' && method === 'POST')
      return handleSetupWebhook(request, env);

    if (path === '/api/remove-webhook' && method === 'POST')
      return handleRemoveWebhook(request, env);

    if (path === '/api/settings' && method === 'POST')
      return handleSaveSettings(request, env);

    if (path === '/api/disconnect' && method === 'POST')
      return handleDisconnect(request, env);

    // ── Dashboard ──────────────────────────────────────────────────
    if (path === '/' && method === 'GET') {
      let flash = null;
      const type = url.searchParams.get('flash');
      const msg  = url.searchParams.get('msg');
      if (type && msg) flash = { type, message: decodeURIComponent(msg) };
      return handleDashboard(request, env, flash);
    }

    return new Response('Not Found', { status: 404 });
  },
};