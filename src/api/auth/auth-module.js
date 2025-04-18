import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import { differenceInMonths, format } from 'date-fns';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from "url";
import { createClient } from 'redis';


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SALT_ROUNDS = 10;
const MASTER_KEY = process.env.WORDSMITH_MASTER_KEY;

const db = new Database('keystore.db');
const redisClient = createClient();
redisClient.on('error', (err) => console.log('Redis Client Error', err));
// Connect to Redis
await redisClient.connect();

// Initialize the keystore table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS keystore (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    hashed_key TEXT,
    created TEXT,
    last_accessed TEXT,
    status INTEGER
  )
`);

async function hashApiKey(apiKey) {
  return await bcrypt.hash(apiKey, SALT_ROUNDS);
}

async function compareApiKey(apiKey, hashedKey) {
  return await bcrypt.compare(apiKey, hashedKey);
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

export async function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const redisKey = `apiKey:${apiKey}`;

  try {
    // Check if the API key is in Redis
    let keyRecord = await redisClient.get(redisKey);

    if (!keyRecord) {
      // If not in Redis, fetch it from the database
      const stmt = db.prepare('SELECT * FROM keystore WHERE hashed_key = ?');
      keyRecord = stmt.get(apiKey);

      if (!keyRecord) {
        return res.status(403).json({ error: 'Invalid API key' });
      }

      // Store the API key data in Redis (optional: set an expiration time)
      await redisClient.set(redisKey, JSON.stringify(keyRecord), {
        EX: 3600, // Cache for 1 hour
      });
    } else {
      // Parse the key record from Redis
      keyRecord = JSON.parse(keyRecord);
    }

    // Check if the API key is active
    if (keyRecord.status > 0) {
      // Update last accessed time in the DB
      const now = new Date().toISOString();
      db.prepare('UPDATE keystore SET last_accessed = ? WHERE email = ?').run(now, keyRecord.email);

      next();
    } else {
      res.status(403).json({ error: 'API key inactive' });
    }
  } catch (error) {
    console.error('Redis error in authentication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Generate new, inactive API keys for other users.
// This is an ADMIN function that requires a master key.
export async function createKey(req, res) {
  const masterKey = req.headers['x-master-key'];
  const { email } = req.body;

  if (masterKey !== MASTER_KEY || !email) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const apiKey = crypto.randomBytes(32).toString('hex');
  const hashedKey = await hashApiKey(apiKey);

  const stmt = db.prepare('INSERT INTO keystore (email, hashed_key, created, last_accessed, status) VALUES (?, ?, ?, ?, ?)');
  stmt.run(email, hashedKey, new Date().toISOString(), new Date().toISOString(), 0);

  res.json({ apiKey, confirmationLink: `${process.env.WORDSMITH_BASE_URL}/confirm-key?token=${encodeURIComponent(apiKey)}` });
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

// In-memory rate limiting (substitute with Redis for production)
const rateLimits = new Map();

export function rateLimit(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const rateLimitWindow = 60 * 1000; // 1 minute in milliseconds
  const maxRequestsPerMinute = 60; // Example: 60 requests per minute

  const now = Date.now();

  if (!rateLimits.has(apiKey)) {
    rateLimits.set(apiKey, { count: 1, startTime: now });
    return next();
  }

  const { count, startTime } = rateLimits.get(apiKey);

  if (now - startTime < rateLimitWindow) {
    // Inside the 1-minute window
    if (count >= maxRequestsPerMinute) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    // Increment the request count
    rateLimits.set(apiKey, { count: count + 1, startTime });
  } else {
    // Reset the window after 1 minute
    rateLimits.set(apiKey, { count: 1, startTime: now });
  }

  next();
}

// Middleware for monthly request credit checking
export function checkQuota(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  const stmt = db.prepare('SELECT * FROM keystore WHERE hashed_key = ?');
  const keyRecord = stmt.get(apiKey);

  if (!keyRecord) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  const now = new Date();
  const lastReset = new Date(keyRecord.period_start);
  const monthsSinceLastReset = differenceInMonths(now, lastReset);
  const isPremium = keyRecord.role === 'premium';
  const maxMonths = 3; // Premium users can accumulate up to 3 months of credits
  const creditsPerMonth = 1000; // Adjust as needed

  // Reset monthly quota for free users
  if (!isPremium && monthsSinceLastReset >= 1) {
    keyRecord.request_count = 0;
    keyRecord.period_start = format(now, 'yyyy-MM-dd');
  }

  // Accumulate credits for premium users up to maxMonths * creditsPerMonth
  if (isPremium) {
    const accumulatedCredits = Math.min((monthsSinceLastReset + 1) * creditsPerMonth, maxMonths * creditsPerMonth);
    const remainingCredits = accumulatedCredits - keyRecord.request_count;

    if (remainingCredits <= 0) {
      return res.status(429).json({ error: 'Request credit quota exceeded' });
    }

    // Update accumulated credits in database (if new period started)
    if (monthsSinceLastReset > 0) {
      keyRecord.request_count = Math.max(0, keyRecord.request_count - accumulatedCredits);
      keyRecord.period_start = format(now, 'yyyy-MM-dd');
    }

    // Decrease the request count for each request
    keyRecord.request_count += 1;
    db.prepare('UPDATE keystore SET request_count = ?, period_start = ? WHERE email = ?')
      .run(keyRecord.request_count, keyRecord.period_start, keyRecord.email);
  }

  // For free users, simple request allowance logic
  if (!isPremium) {
    const remainingCredits = creditsPerMonth - keyRecord.request_count;

    if (remainingCredits <= 0) {
      return res.status(429).json({ error: 'Request credit quota exceeded' });
    }

    // Decrease the request count for each request
    keyRecord.request_count += 1;
    db.prepare('UPDATE keystore SET request_count = ?, period_start = ? WHERE email = ?')
      .run(keyRecord.request_count, keyRecord.period_start, keyRecord.email);
  }

  next();
}

// Designate premium & role-based features
export function featureAccess(roleRequired) {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    const stmt = db.prepare('SELECT * FROM keystore WHERE hashed_key = ?');
    const keyRecord = stmt.get(apiKey);

    if (!keyRecord || keyRecord.status <= 0) {
      return res.status(403).json({ error: 'API key inactive or invalid' });
    }

    if (keyRecord.role !== roleRequired) {
      return res.status(403).json({ error: `Insufficient access: ${roleRequired} required` });
    }

    next();
  };
}

export { keystore };
