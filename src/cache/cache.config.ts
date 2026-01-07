import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  ttl: {
    quote: 30, // 30 seconds for real-time quotes
    quotes: 30, // 30 seconds for batch quotes
    chart: 300, // 5 minutes for intraday charts
    recommendations: 3600, // 1 hour for recommendations
    quoteSummary: 1800, // 30 minutes for quote summary
    trending: 300, // 5 minutes for trending
    insights: 1800, // 30 minutes for insights
    screener: 600, // 10 minutes for screener results
  },
}));
