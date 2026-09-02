// Writes public/firebase-config.json from .env, so the service worker (which
// cannot read import.meta.env) can fetch the same public Firebase config the
// app itself uses. Runs automatically before `dev` and `build`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const envPath = path.join(root, '.env')

const env = {}
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    let [, key, value] = match
    value = value.replace(/^["']|["']$/g, '')
    env[key] = value
  }
}

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
}

writeFileSync(path.join(root, 'public', 'firebase-config.json'), JSON.stringify(config, null, 2))
console.log('public/firebase-config.json généré depuis .env')
