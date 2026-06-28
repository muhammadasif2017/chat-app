import { cn, formatDaySeparator, getInitials } from '../utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('resolves tailwind conflicts, last wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('ignores falsy values', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});

describe('getInitials', () => {
  it('returns first letter uppercased for single word', () => {
    expect(getInitials('alice')).toBe('A');
  });

  it('returns first letters of first two words', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('caps at two characters for names with many words', () => {
    expect(getInitials('a b c d')).toBe('AB');
  });

  it('uppercases all initials', () => {
    expect(getInitials('jane smith')).toBe('JS');
  });
});

describe('formatDaySeparator', () => {
  it('returns "Today" for a date in the current day', () => {
    expect(formatDaySeparator(new Date())).toBe('Today');
  });

  it('returns "Yesterday" for a date exactly one day ago', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDaySeparator(yesterday)).toBe('Yesterday');
  });

  it('returns a weekday name for dates 2-6 days ago', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const result = formatDaySeparator(threeDaysAgo);
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(weekdays).toContain(result);
  });

  it('returns a formatted date string for dates older than a week', () => {
    const oldDate = new Date('2020-01-15');
    const result = formatDaySeparator(oldDate);
    expect(result).toContain('2020');
    expect(result).toContain('15');
  });

  it('accepts an ISO string as input', () => {
    expect(formatDaySeparator(new Date().toISOString())).toBe('Today');
  });
});
