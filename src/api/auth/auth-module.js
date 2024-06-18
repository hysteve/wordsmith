import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv'; 
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_KEY = process.env.WORDSMITH_MASTER_KEY;
const API_KEYS = process.env.WORDSMITH_API_KEYS ? process.env.WORDSMITH_API_KEYS.split(',') : [];
const KEYSTORE_PATH = path.resolve(__dirname, '../../db', 'keystore.json');

console.log(MASTER_KEY)

// Load or initialize the keystore
let keystore = {};
if (fs.existsSync(KEYSTORE_PATH)) {
  keystore = JSON.parse(fs.readFileSync(KEYSTORE_PATH, 'utf-8'));
} else {
  fs.writeFileSync(KEYSTORE_PATH, JSON.stringify(keystore));
}

// Add API keys from .env to keystore if not already present
API_KEYS.forEach(apiKey => {
  if (!keystore[apiKey]) {
    keystore[apiKey] = { created: new Date().toISOString() };
  }
});
saveKeystore();

function saveKeystore() {
  fs.writeFileSync(KEYSTORE_PATH, JSON.stringify(keystore, null, 2));
}

export function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && keystore[apiKey]) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
}

export function createKey(req, res) {
  const masterKey = req.headers['x-master-key'];
  console.log('master-key');
  if (masterKey !== MASTER_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const apiKey = crypto.randomBytes(32).toString('hex');
  keystore[apiKey] = { created: new Date().toISOString() };
  saveKeystore();
  res.json({ apiKey });
}

export function revokeKey(req, res) {
  const masterKey = req.headers['x-master-key'];
  if (masterKey !== MASTER_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { apiKey } = req.body;
  if (keystore[apiKey]) {
    delete keystore[apiKey];
    saveKeystore();
    res.json({ message: 'API key revoked' });
  } else {
    res.status(404).json({ error: 'API key not found' });
  }
}