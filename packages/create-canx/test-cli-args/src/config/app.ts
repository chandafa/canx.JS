export default {
  name: 'CanxJS App',
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  key: process.env.APP_KEY || 'your-secret-key',
};
