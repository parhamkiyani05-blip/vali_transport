import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import driverRoutes from './routes/drivers.js';
import companyRoutes from './routes/companies.js';
import expenseRoutes from './routes/expenses.js';
import transactionRoutes from './routes/transactions.js';
import dashboardRoutes from './routes/dashboard.js';
import reportRoutes from './routes/reports.js';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN?.split(',') || true
  })
);

app.use(
  express.json({
    limit: '1mb'
  })
);


// ==========================
// Health Check
// ==========================
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vali-api',
    time: new Date().toISOString()
  });
});


// ==========================
// API Routes
// ==========================
app.use('/api/auth', authRoutes);

app.use('/api/users', userRoutes);

app.use('/api/drivers', driverRoutes);

app.use('/api/companies', companyRoutes);

app.use('/api/expenses', expenseRoutes);

app.use('/api/transactions', transactionRoutes);

app.use('/api/dashboard', dashboardRoutes);

app.use('/api/reports', reportRoutes);


// ==========================
// Error Handler
// ==========================
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    error: 'SERVER_ERROR'
  });
});


// ==========================
// Start Server
// ==========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`VALI API running on :${PORT}`);
});
