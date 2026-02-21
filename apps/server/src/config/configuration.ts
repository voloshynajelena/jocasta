export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiUrl: process.env.API_URL || 'http://localhost:3001',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      'dev-refresh-secret-change-in-production',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32-bytes!!',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      'http://localhost:3001/api/v1/auth/google/callback',
    mapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  expo: {
    accessToken: process.env.EXPO_ACCESS_TOKEN,
  },

  defaults: {
    timezone: process.env.DEFAULT_TIMEZONE || 'America/Edmonton',
    latitude: parseFloat(process.env.DEFAULT_LATITUDE || '51.0447'),
    longitude: parseFloat(process.env.DEFAULT_LONGITUDE || '-114.0719'),
  },

  cache: {
    geoTtlSeconds: 604800, // 7 days
    directionsTtlSeconds: 3600, // 1 hour
    weatherTtlSeconds: 3600, // 1 hour
  },

  jobs: {
    notificationPollIntervalMs: 60000, // 1 minute
    syncPollIntervalMs: 300000, // 5 minutes
    maxRetries: 3,
  },
});
