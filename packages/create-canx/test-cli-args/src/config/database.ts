import type { DatabaseConfig } from 'canxjs';

const config: DatabaseConfig = {
  driver: 'sqlite',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'canxjs_app',
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  logging: process.env.NODE_ENV !== 'production',
  pool: { min: 2, max: 10 },
};

export default config;
