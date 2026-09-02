import { normalizeDescription } from './normalize';

describe('normalizeDescription', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeDescription('  TIM   HORTONS  ')).toBe('tim hortons');
  });

  it('replaces punctuation with single spaces', () => {
    expect(normalizeDescription('AMZN MKTP CA*2H45R')).toBe('amzn mktp ca 2h45r');
  });

  it('drops trailing digit-only tokens', () => {
    expect(normalizeDescription('STARBUCKS STORE 4512')).toBe('starbucks store');
    expect(normalizeDescription('LOBLAWS 1234 5678')).toBe('loblaws');
  });

  it('keeps digits that are inside an alphanumeric token', () => {
    expect(normalizeDescription('7ELEVEN 221')).toBe('7eleven');
  });

  it('does not drop leading or interior digit-only tokens', () => {
    expect(normalizeDescription('123 GAS BAR')).toBe('123 gas bar');
  });

  it('returns an empty string when everything is stripped', () => {
    expect(normalizeDescription('### 12 34')).toBe('');
  });

  it('strips punctuation-joined merchant noise', () => {
    expect(normalizeDescription('WAL-MART #1234')).toBe('wal mart');
    expect(normalizeDescription('PAYPAL *UBER 8005555')).toBe('paypal uber');
  });
});
