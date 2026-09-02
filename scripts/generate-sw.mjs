// Generates public/firebase-messaging-sw.js from the template, with the
// Firebase config (read from .env) inlined directly into the script. A
// service worker can't read import.meta.env, and fetching the config
// asynchronously at startup created a race: an incoming push could arrive
// before the fetch resolved and the background-message listener was
// registered, silently dropping the notification. Inlining removes that gap
// entirely. Runs automatically before `dev` and `build`.
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

const template = readFileSync(path.join(root, 'scripts', 'firebase-messaging-sw.template.js'), 'utf8')
const sw = template.replace('__FIREBASE_CONFIG__', JSON.stringify(config))

writeFileSync(path.join(root, 'public', 'firebase-messaging-sw.js'), sw)
console.log('public/firebase-messaging-sw.js généré depuis .env')
