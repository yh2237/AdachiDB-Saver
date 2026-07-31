const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeTargetPostUrl } = require('../js/url');

test('normalizes x.com and twitter.com post URLs', () => {
  assert.equal(
    normalizeTargetPostUrl('https://x.com/adachirei0/status/123456?s=20'),
    'https://x.com/adachirei0/status/123456'
  );
  assert.equal(
    normalizeTargetPostUrl('https://twitter.com/AdachiRei0/status/987654/'),
    'https://x.com/adachirei0/status/987654'
  );
});

test('rejects posts from other users and malformed URLs', () => {
  const invalidValues = [
    'https://x.com/other/status/123456',
    'https://x.com/adachirei0/status/not-a-number',
    'https://x.com/adachirei0/status/123456/analytics',
    'https://x.com.evil.example/adachirei0/status/123456',
    'http://x.com/adachirei0/status/123456',
    'not a URL',
    ''
  ];

  for (const value of invalidValues) {
    assert.equal(normalizeTargetPostUrl(value), null, value);
  }
});
