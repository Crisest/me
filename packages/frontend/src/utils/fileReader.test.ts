import { describe, it, expect } from 'vitest';
import { computeFileHash } from './fileReader';

describe('computeFileHash', () => {
  it('returns the lowercase hex SHA-256 of the file bytes', async () => {
    const file = new File(['abc'], 'a.csv');

    expect(await computeFileHash(file)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes an empty file', async () => {
    const file = new File([], 'empty.csv');

    expect(await computeFileHash(file)).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
