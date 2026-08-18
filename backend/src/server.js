import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import driverRoutes from './routes/drivers.js';
import companyRoutes from './routes/companies.js';
import expenseRoutes from './routes/expenses.js';
import transactionRoutes from './routes/transactions.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req,res)=>res.json({ ok:true, service:'vali-api', time:new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/transactions', transactionRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error:'SERVER_ERROR' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, ()=>console.log(`VALI API running on :${port}`));
