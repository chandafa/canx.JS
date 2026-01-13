import { createApp, logger, cors } from 'canxjs';
import { initDatabase } from 'canxjs';
import { webRoutes } from './routes/web';
import { apiRoutes } from './routes/api';
import dbConfig from './config/database';

const app = createApp({
  port: 3000,
  development: true,
  cors: true,
  // Add other config here
});

// Middlewares
app.use(logger());
app.use(cors());

// Routes

app.routes(apiRoutes);

// Initialize database and start server
async function bootstrap() {
  await initDatabase(dbConfig);
  await app.listen(() => console.log('🚀 Server ready!'));
}

bootstrap().catch(console.error);
