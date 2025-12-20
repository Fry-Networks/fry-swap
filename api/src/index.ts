import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { poolsRouter } from './routes/pools.js';
import { swapRouter } from './routes/swap.js';
import { priceRouter } from './routes/prices.js';
import { healthRouter } from './routes/health.js';
import { errorHandler } from './middleware/error.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  methods: ['GET', 'POST'],
}));

// Rate limiting - free API with reasonable limits
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please try again later' },
});
app.use(limiter);

// Body parsing
app.use(express.json());

// API Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/pools', poolsRouter);
app.use('/api/v1/swap', swapRouter);
app.use('/api/v1/prices', priceRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FrySwap API',
    version: '0.1.0',
    docs: '/api/v1/docs',
    endpoints: {
      health: '/api/v1/health',
      pools: '/api/v1/pools',
      swap: '/api/v1/swap',
      prices: '/api/v1/prices',
    },
  });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`🍟 FrySwap API running on port ${config.port}`);
  console.log(`   Environment: ${config.env}`);
  console.log(`   Network: ${config.algorandNetwork}`);
});

export default app;
