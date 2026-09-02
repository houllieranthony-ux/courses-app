// Cloudflare Worker: relays "I'm going shopping" / "checking out" signals as a
// push notification to the other household member. Exists only because
// browsers can't call Google's FCM / OAuth endpoints directly (no CORS) and
// mustn't hold the Firebase service account's private key. This Worker does:
//   1. Verify the caller is really signed in (checks the Firebase ID token
//      they send, against Google's public keys — no shared secret needed).
//   2. Exchange the service account for a short-lived Google OAuth token.
//   3. Send one FCM push per device token the caller asked to notify.
// Free forever on Cloudflare's Workers free tier (100k requests/day).

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

const MESSAGES = {
  going_shopping: {
    title: '🛒 Départ courses',
    body: "Je vais en courses, si il manque quelque chose ajoute-le vite !",
  },
  checkout: {
    title: '✅ Courses terminées',
    body: 'Courses terminées, je passe en caisse.',
  },
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const corsHeaders = buildCorsHeaders(origin, env)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }
    if (request.method !== 'POST') {
      return json({ error: 'method not allowed' }, 405, corsHeaders)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json({ error: 'invalid json' }, 400, corsHeaders)
    }

    const { idToken, tokens, type } = body
    if (!idToken || !Array.isArray(tokens) || tokens.length === 0 || !MESSAGES[type]) {
      return json({ error: 'missing idToken, tokens[] or valid type' }, 400, corsHeaders)
    }

    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON)

    try {
      await verifyFirebaseIdToken(idToken, serviceAccount.project_id)
    } catch (e) {
      return json({ error: 'invalid id token: ' + e.message }, 401, corsHeaders)
    }

    const accessToken = await getGoogleAccessToken(serviceAccount)
    const { title, body: messageBody } = MESSAGES[type]

    const results = await Promise.all(
      tokens.map((token) => sendFcmMessage(accessToken, serviceAccount.project_id, token, title, messageBody)),
    )
    const sent = results.filter(Boolean).length

    return json({ sent, total: tokens.length }, 200, corsHeaders)
  },
}

function buildCorsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim())
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || '*'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

// ---- base64url helpers ----

function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '=')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64Url(bytes) {
  let binary = ''
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlJsonDecode(segment) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)))
}

// ---- verify an incoming Firebase Auth ID token (RS256, Google-signed) ----

async function verifyFirebaseIdToken(idToken, projectId) {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('malformed token')
  const [headerB64, payloadB64, sigB64] = parts

  const header = base64UrlJsonDecode(headerB64)
  const payload = base64UrlJsonDecode(payloadB64)

  const now = Math.floor(Date.now() / 1000)
  if (payload.aud !== projectId) throw new Error('wrong audience')
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('wrong issuer')
  if (!payload.exp || payload.exp < now) throw new Error('expired')
  if (!payload.sub) throw new Error('missing subject')

  const jwks = await fetchJwks()
  const jwk = jwks.keys.find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('unknown signing key')

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = base64UrlToBytes(sigB64)
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signedData)
  if (!valid) throw new Error('bad signature')

  return payload
}

let cachedJwks = null
let cachedJwksAt = 0

async function fetchJwks() {
  // Google rotates these keys infrequently; a short in-isolate cache avoids
  // re-fetching on every request without risking a stale key for long.
  if (cachedJwks && Date.now() - cachedJwksAt < 10 * 60 * 1000) return cachedJwks
  const res = await fetch(FIREBASE_CERTS_URL)
  if (!res.ok) throw new Error('could not fetch signing keys')
  cachedJwks = await res.json()
  cachedJwksAt = Date.now()
  return cachedJwks
}

// ---- service account -> short-lived Google OAuth access token ----

async function getGoogleAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: serviceAccount.client_email,
    scope: FCM_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const encodedHeader = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)))
  const encodedClaims = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(claims)))
  const unsigned = `${encodedHeader}.${encodedClaims}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${bytesToBase64Url(signature)}`

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error('token exchange failed: ' + (await res.text()))
  const data = await res.json()
  return data.access_token
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// ---- FCM v1 send ----

async function sendFcmMessage(accessToken, projectId, token, title, body) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        webpush: { notification: { icon: '/icons/icon-192.png' }, fcm_options: { link: '/' } },
      },
    }),
  })
  return res.ok
}
