import mongoose from 'mongoose';

jest.mock('mongoose', () => ({ connect: jest.fn() }));
jest.mock('../config/env', () => ({
  config: { mongoUri: 'mongodb://user:pw@10.0.0.9:27017/portfolio?authSource=portfolio' },
}));

const mockedConnect = mongoose.connect as jest.MockedFunction<typeof mongoose.connect>;

it('connects using the URI from config, not a hardcoded localhost string', async () => {
  mockedConnect.mockResolvedValue(mongoose as never);
  const { connectToDatabase } = await import('./db');

  await connectToDatabase();

  expect(mockedConnect).toHaveBeenCalledWith(
    'mongodb://user:pw@10.0.0.9:27017/portfolio?authSource=portfolio',
    expect.anything()
  );
});

it('rethrows connection failures so the caller can exit', async () => {
  mockedConnect.mockRejectedValue(new Error('ECONNREFUSED'));
  const { connectToDatabase } = await import('./db');

  await expect(connectToDatabase()).rejects.toThrow('ECONNREFUSED');
});
