import knex from 'knex';
import knexConfig from './knexfile.js';

const db = knex(knexConfig.development);

// Example: Fetch an API key record
export async function getApiKeyRecord(apiKey) {
  return await db('keystore').where({ hashed_key: apiKey }).first();
}

// Example: Update last accessed time
export async function updateLastAccessed(email) {
  return await db('keystore')
    .where({ email })
    .update({ last_accessed: db.fn.now() });
}

// Example: Insert a new API key
export async function insertApiKeyRecord(email, hashedKey, role = 'free') {
  return await db('keystore').insert({
    email,
    hashed_key: hashedKey,
    status: 0, // inactive by default
    request_limit: 1000, // default limit
    role: role,
  });
}