import express from 'express';
import { createKey, revokeKey } from './auth-module.js';

const router = express.Router();

router.post('/create-key', createKey);
router.post('/revoke-key', revokeKey);

export default router;