import * as util from './util.js';

describe('timeSince', () => {
  const now = new Date('2019-10-31T12:34:56Z');

  test('now', () => {
    expect(util.timeSince(now.valueOf(), now)).toEqual('0s ago');
  });

  test('minutes ago', () => {
    expect(util.timeSince(now.valueOf() - 5 * 60 * 1000, now)).toEqual('5m ago');
  });

  test('hours ago', () => {
    expect(util.timeSince(now.valueOf() - 18 * 60 * 60 * 1000, now)).toEqual('18h ago');
  });

  test('earlier this year', () => {
    expect(util.timeSince(now.valueOf() - 31 * 24 * 60 * 60 * 1000, now)).toEqual('30 Sep');
  });

  test('years ago', () => {
    expect(util.timeSince(now.valueOf() - 429 * 24 * 60 * 60 * 1000, now)).toEqual('28 Aug 2018');
  });

  test('the future', () => {
    expect(util.timeSince(now.valueOf() + 1000, now)).toEqual('-1s ago');
  });
});
