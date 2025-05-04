import express from 'express';
import { connectToDatabase } from './db/db';
import transactionsRoutes from './modules/transactions';
import loginRoutes from './modules/auth';

const app = express();

app.use(express.json());

app.use('/transactions', transactionsRoutes);
app.use('/', loginRoutes);

connectToDatabase().then(() => {
  console.log('MongDB connected');
});

export default app;
