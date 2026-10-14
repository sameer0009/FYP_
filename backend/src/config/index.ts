import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'rsci-fyp-super-secret-jwt-key-2026-production',
  jwtExpiresIn: 900, // 15 minutes (SRS / API spec)
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || 'rsci-refresh-secret-secure-token-vault-2026',
  refreshTokenExpiresIn: 2592000, // 30 days
  dbType: process.env.DB_TYPE || 'sqlite', // 'sqlite' or 'postgres'
  pgConfig: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rsci_fyp_portal',
  },
  sqlitePath: path.resolve(__dirname, '../../data/rsci_fyp.db'),
  uploadDir: path.resolve(__dirname, '../../uploads'),
  apiPrefix: '/api/v1',
  supervisionCapDefault: 6,
  groupSizeMinDefault: 2,
  groupSizeMaxDefault: 4,
  projectEffortTargetHours: 300,
  weeklyEffortTargetHours: 9
};
