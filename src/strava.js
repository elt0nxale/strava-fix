const STRAVA_API = 'https://www.strava.com/api/v3';
const STRAVA_AUTH = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN = 'https://www.strava.com/oauth/token';

// ─── Token Management ────────────────────────────────────────────────────────

export async function getTokens(kv) {
  return kv.get('tokens', 'json');
}

export async function saveTokens(kv, tokens) {
  await kv.put('tokens', JSON.stringify(tokens));
}

/** Returns a valid access token, refreshing automatically if needed. */
export async function getValidAccessToken(kv, env) {
  const tokens = await getTokens(kv);
  if (!tokens) return null;

  const now = Math.floor(Date.now() / 1000);
  if (tokens.expires_at > now + 300) return tokens.access_token; // still fresh

  // Refresh
  const res = await fetch(STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    console.error('Token refresh failed:', await res.text());
    return null;
  }

  const fresh = await res.json();
  // Preserve athlete info since refresh response doesn't include it
  await saveTokens(kv, { ...fresh, athlete: tokens.athlete });
  return fresh.access_token;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function buildAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all,activity:write',
  });
  return `${STRAVA_AUTH}?${params}`;
}

export async function exchangeCode(clientId, clientSecret, code) {
  const res = await fetch(STRAVA_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Auth exchange failed: ${await res.text()}`);
  return res.json();
}

// ─── Activities ──────────────────────────────────────────────────────────────

export async function getActivity(token, id) {
  const res = await fetch(`${STRAVA_API}/activities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateActivity(token, id, fields) {
  const res = await fetch(`${STRAVA_API}/activities/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fields),
  });
  if (!res.ok) throw new Error(`Update failed: ${await res.text()}`);
  return res.json();
}

// ─── Webhook Subscriptions ───────────────────────────────────────────────────

export async function listWebhookSubscriptions(clientId, clientSecret) {
  const res = await fetch(
    `${STRAVA_API}/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function createWebhookSubscription(clientId, clientSecret, callbackUrl, verifyToken) {
  const res = await fetch(`${STRAVA_API}/push_subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      callback_url: callbackUrl,
      verify_token: verifyToken,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteWebhookSubscription(clientId, clientSecret, subscriptionId) {
  const res = await fetch(`${STRAVA_API}/push_subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  });
  return res.ok;
}
