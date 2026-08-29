import { relations } from 'drizzle-orm';
import { accounts } from './accounts';
import { banks } from './banks';
import { budgetCategories } from './budget-categories';
import { budgetCategoryOverrides } from './budget-category-overrides';
import { budgetOverrides } from './budget-overrides';
import { budgets } from './budgets';
import { cards } from './cards';
import { groupMembers } from './group-members';
import { groups } from './groups';
import { transactions } from './transactions';
import { uploads } from './uploads';
import { users } from './users';

export const usersRelations = relations(users, ({ many, one }) => ({
  banks: many(banks),
  cards: many(cards),
  accounts: many(accounts),
  transactions: many(transactions),
  budgetCategories: many(budgetCategories),
  budget: one(budgets),
  budgetOverrides: many(budgetOverrides),
  budgetCategoryOverrides: many(budgetCategoryOverrides),
  createdGroups: many(groups),
  memberships: many(groupMembers),
  uploads: many(uploads),
}));

export const banksRelations = relations(banks, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [banks.createdBy],
    references: [users.id],
  }),
  cards: many(cards),
  accounts: many(accounts),
}));

export const cardsRelations = relations(cards, ({ one, many }) => ({
  bank: one(banks, { fields: [cards.bankId], references: [banks.id] }),
  createdBy: one(users, { fields: [cards.createdBy], references: [users.id] }),
  transactions: many(transactions),
  uploads: many(uploads),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  bank: one(banks, { fields: [accounts.bankId], references: [banks.id] }),
  createdBy: one(users, {
    fields: [accounts.createdBy],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const budgetCategoriesRelations = relations(
  budgetCategories,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [budgetCategories.createdBy],
      references: [users.id],
    }),
    transactions: many(transactions),
    overrides: many(budgetCategoryOverrides),
  })
);

export const budgetsRelations = relations(budgets, ({ one }) => ({
  createdBy: one(users, { fields: [budgets.createdBy], references: [users.id] }),
}));

export const budgetOverridesRelations = relations(budgetOverrides, ({ one }) => ({
  createdBy: one(users, {
    fields: [budgetOverrides.createdBy],
    references: [users.id],
  }),
}));

export const budgetCategoryOverridesRelations = relations(
  budgetCategoryOverrides,
  ({ one }) => ({
    category: one(budgetCategories, {
      fields: [budgetCategoryOverrides.categoryId],
      references: [budgetCategories.id],
    }),
    createdBy: one(users, {
      fields: [budgetCategoryOverrides.createdBy],
      references: [users.id],
    }),
  })
);

export const groupsRelations = relations(groups, ({ one, many }) => ({
  createdBy: one(users, { fields: [groups.createdBy], references: [users.id] }),
  members: many(groupMembers),
  transactions: many(transactions),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  card: one(cards, { fields: [transactions.cardId], references: [cards.id] }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  group: one(groups, {
    fields: [transactions.groupId],
    references: [groups.id],
  }),
  category: one(budgetCategories, {
    fields: [transactions.categoryId],
    references: [budgetCategories.id],
  }),
  createdBy: one(users, {
    fields: [transactions.createdBy],
    references: [users.id],
  }),
}));

export const uploadsRelations = relations(uploads, ({ one }) => ({
  card: one(cards, { fields: [uploads.cardId], references: [cards.id] }),
  createdBy: one(users, { fields: [uploads.createdBy], references: [users.id] }),
}));
