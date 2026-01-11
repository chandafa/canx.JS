/**
 * CanxJS Demo Application - Test file
 */

import { createApp, logger, cors } from './src/index';

const app = createApp({
  port: 3000,
  development: true,
});

// Middlewares
app.use(logger());

// Routes
app.get('/', (req, res) => {
  return res.json({
    name: 'CanxJS Framework',
    version: '1.0.0',
    message: 'Ultra-fast async-first MVC backend framework for Bun',
    features: [
      'Radix Tree Router with JIT caching',
      'HotWire real-time streaming',
      'Auto-Cache with pattern analysis',
      'Zero-Config ORM (MySQL/PostgreSQL)',
      'Native JSX views',
      'Controller decorators',
    ],
  });
});

app.get('/users/:id', (req, res) => {
  return res.json({
    user: {
      id: req.params.id,
      name: 'John Doe',
      email: 'john@example.com',
    },
  });
});

app.post('/users', async (req, res) => {
  const body = await req.json();
  return res.status(201).json({
    message: 'User created',
    data: body,
  });
});

app.get('/health', (req, res) => {
  return res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
console.log('Starting CanxJS demo server...');
app.listen(3000, () => {
  console.log('Demo server ready!');
});

export default app;
