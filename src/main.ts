import { createApp, CanxRequest, CanxResponse } from './index';

/**
 * PRODUCTION ENTRY POINT
 * This file is the entry point for the application in production environments.
 * It initializes the server and starts listening on the configured port.
 */

const app = createApp({
    port: Number(process.env.PORT) || 3000,
    development: process.env.NODE_ENV !== 'production',
    static: './public', // Serve static files from public directory
    cors: true,         // Enable CORS by default
});

// Default Health Check Route
app.get('/', (req: CanxRequest) => {
    return {
        message: 'CanxJS Framework is running!',
        status: 'production',
        timestamp: new Date().toISOString(),
        version: '1.5.0'
    };
});

app.get('/health', () => ({ status: 'ok', uptime: process.uptime() }));

console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🚀 Starting CanxJS Application                 ║
║   → Port: ${app.config.port}                               ║
║   → Env:  ${process.env.NODE_ENV || 'development'}                    ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);

app.listen();
