import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config';
import { runSeeds } from './database/seed';
import { requestIdMiddleware, authMiddleware } from './middleware/auth';
import { successResponse, errorResponse } from './utils/response';

// Route imports
import authRoutes from './routes/auth.routes';
import academicRoutes from './routes/academic.routes';
import usersRoutes from './routes/users.routes';
import groupsRoutes from './routes/groups.routes';
import proposalsRoutes from './routes/proposals.routes';
import supervisionRoutes from './routes/supervision.routes';
import meetingsRoutes from './routes/meetings.routes';
import deliverablesRoutes from './routes/deliverables.routes';
import evaluationsRoutes from './routes/evaluations.routes';
import reportsRoutes from './routes/reports.routes';
import notificationsRoutes from './routes/notifications.routes';
import auditRoutes from './routes/audit.routes';

const app = express();

// Initialize DB & Seed Baseline Data
runSeeds();

// Base Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);
app.use(authMiddleware);

// Serve uploaded deliverable files securely
app.use('/uploads', express.static(config.uploadDir));

// System Health Endpoints
app.get('/api/v1/health', (req, res) => {
  return successResponse(res, { status: 'healthy', version: '1.0.0', timestamp: new Date().toISOString() });
});
app.get('/api/v1/ready', (req, res) => {
  return successResponse(res, { status: 'ready', database: 'connected' });
});

// Mount Module Routes under /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1', academicRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/groups', groupsRoutes);
app.use('/api/v1/proposals', proposalsRoutes);
app.use('/api/v1', supervisionRoutes);
app.use('/api/v1', meetingsRoutes);
app.use('/api/v1', deliverablesRoutes);
app.use('/api/v1', evaluationsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1', notificationsRoutes);
app.use('/api/v1/audit-logs', auditRoutes);

// 404 handler
app.use((req, res) => {
  return errorResponse(res, 'NF_001', `Route ${req.method} ${req.originalUrl} not found`, null, 404);
});

// Central error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  return errorResponse(res, 'SYS_001', err.message || 'Internal server error occurred', null, 500);
});

app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(` RSCI FYP Portal REST API Server v1.0 running on port ${config.port}`);
  console.log(` Protocol: REST over HTTPS/HTTP JSON (/api/v1)`);
  console.log(` Seeding: 10 Framework Project Types & 9 Roles loaded`);
  console.log(`=======================================================`);
});

export default app;
