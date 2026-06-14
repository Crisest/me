import mongoose from 'mongoose';
import {
  connectMemoryMongo,
  disconnectMemoryMongo,
  clearAllCollections,
} from './setup';
import { makeUser } from './helpers/factories';

beforeAll(async () => {
  await connectMemoryMongo();
});

afterEach(async () => {
  await clearAllCollections();
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

describe('smoke', () => {
  it('connects to the in-memory mongo', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });

  it('creates a user via the factory', async () => {
    const user = await makeUser();
    expect(user._id).toBeDefined();
    expect(user.email).toMatch(/@test\.local$/);
  });
});
