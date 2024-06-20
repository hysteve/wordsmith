import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_KEY = process.env.WORDSMITH_MASTER_KEY;
const KEYSTORE_PATH = path.resolve(__dirname, '../../db/keystore.json');

// Load or initialize the keystore
let keystore = {};
if (fs.existsSync(KEYSTORE_PATH)) {
  keystore = JSON.parse(fs.readFileSync(KEYSTORE_PATH, 'utf-8'));
} else {
  fs.writeFileSync(KEYSTORE_PATH, JSON.stringify(keystore));
}

export function saveKeystore() {
  fs.writeFileSync(KEYSTORE_PATH, JSON.stringify(keystore, null, 2));
}

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, MASTER_KEY).toString();
}

function decrypt(text) {
  const bytes = CryptoJS.AES.decrypt(text, MASTER_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && keystore[apiKey] && keystore[apiKey].status > 0) {
    keystore[apiKey].lastAccessed = new Date().toISOString();
    saveKeystore();
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
}

export function createKey(req, res) {
  const masterKey = req.headers['x-master-key'];
  const { email } = req.body;
  if (masterKey !== MASTER_KEY || !email) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const apiKey = crypto.randomBytes(32).toString('hex');
  keystore[apiKey] = {
    email,
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
    status: 0
  };
  saveKeystore();
  const encryptedKey = encrypt(apiKey);
  res.json({ apiKey, confirmationLink: `${process.env.WORDSMITH_BASE_URL}/confirm-key?token=${encodeURIComponent(encryptedKey)}` });
}

export function confirmKey(req, res) {
  const { token } = req.query;
  const decryptedKey = decrypt(decodeURIComponent(token));

  if (keystore[decryptedKey] && keystore[decryptedKey].status === 0) {
    keystore[decryptedKey].status = 1;
    saveKeystore();
    res.redirect('/confirmation-success');
  } else {
    res.status(404).send('Invalid or already confirmed key.');
  }
}

export function checkKeyStatus(req, res) {
  const { apiKey } = req.query;
  if (keystore[apiKey]) {
    console.log('check status: API Key found', keystore[apiKey].status);
    res.json({ status: keystore[apiKey].status });
  } else {
    console.log('check status: WARNING! API Key NOT found!!');
    res.status(404).json({ error: 'API key not found' });
  }
}

export function revokeKey(req, res) {
  const masterKey = req.headers['x-master-key'];
  const { apiKey } = req.body;
  if (masterKey !== MASTER_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (keystore[apiKey]) {
    keystore[apiKey].status = -1;
    saveKeystore();
    res.json({ message: 'API key revoked' });
  } else {
    res.status(404).json({ error: 'API key not found' });
  }
}

export { keystore };