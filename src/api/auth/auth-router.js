import express from 'express';
import { createKey, revokeKey, confirmKey, checkKeyStatus } from './auth-module.js';

const router = express.Router();

router.post('/create-key', createKey);
router.post('/revoke-key', revokeKey);

router.get('/confirm-key', confirmKey);
router.get('/check-key-status', checkKeyStatus);

router.get('/email', (req, res) => {
  const { token } = req.query;
  res.send(`
    <html>
      <body>
        <h1>Confirm Your API Key</h1>
        <p>Click the link below to confirm your API key:</p>
        <a href="${process.env.WORDSMITH_BASE_URL}/confirm-key?token=${encodeURIComponent(token)}">Confirm API Key</a>
      </body>
    </html>
  `);
});

router.get('/confirmation-success', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>API Key Confirmed</h1>
        <p>Your API key has been successfully confirmed and activated.</p>
      </body>
    </html>
  `);
});

export default router;