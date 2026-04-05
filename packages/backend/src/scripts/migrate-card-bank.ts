// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// import path from 'path';

// dotenv.config({ path: path.join(__dirname, '../../.env') });

// import { CardModel } from '../modules/cards/card.model';
// import { TransactionModel } from '../modules/transactions/transaction.model';
// import { BankModel } from '../modules/banks/bank.model';

// async function migrate() {
//   const mongoUri =
//     process.env.MONGODB_URI || 'mongodb://localhost:27017/portfolio';
//   await mongoose.connect(mongoUri);
//   console.log('Connected to MongoDB');

//   const cards = await CardModel.find({ bankId: { $exists: false } });
//   console.log(`Found ${cards.length} cards without bankId`);

//   for (const card of cards) {
//     // Find the most used bank for this card in transactions
//     const result = await TransactionModel.aggregate([
//       { $match: { cardId: card._id } },
//       { $group: { _id: '$bankId', count: { $sum: 1 } } },
//       // { $sort: { count: -1 } },
//       { $limit: 1 },
//     ]);

//     if (result.length > 0 && result[0]._id) {
//       card.bankId = result[0]._id;
//       await card.save();
//       console.log(`Card "${card.name}" -> bankId ${result[0]._id}`);
//     } else {
//       // No transactions found — assign to the user's first bank, or create a default
//       const userBank = await BankModel.findOne({ createdBy: card.createdBy });
//       if (userBank) {
//         card.bankId = userBank._id;
//         await card.save();
//         console.log(`Card "${card.name}" -> default bankId ${userBank._id}`);
//       } else {
//         const defaultBank = await BankModel.create({
//           name: 'Default Bank',
//           createdBy: card.createdBy,
//         });
//         card.bankId = defaultBank._id;
//         await card.save();
//         console.log(
//           `Card "${card.name}" -> created default bank ${defaultBank._id}`
//         );
//       }
//     }
//   }

//   console.log('Migration complete');
//   await mongoose.disconnect();
// }

// migrate().catch(err => {
//   console.error('Migration failed:', err);
//   process.exit(1);
// });
