import { Router } from 'express';
import { algodClient } from '../services/algorand.js';
import { config } from '../config.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  try {
    // Check Algorand node connection
    const status = await algodClient.status().do();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      network: config.algorandNetwork,
      node: {
        connected: true,
        lastRound: status['last-round'],
        catchupTime: status['catchup-time'],
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Failed to connect to Algorand node',
    });
  }
});

healthRouter.get('/live', (req, res) => {
  res.json({ status: 'live' });
});

healthRouter.get('/ready', async (req, res) => {
  try {
    await algodClient.status().do();
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
});
