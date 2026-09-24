import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSession } from './session.js';
const session = { accessToken: 'token', user: { email: 'test@example.com' }, expiresAtUtc: '2030-01-01T00:00:00Z' };
test('restores an unexpired session', () => assert.deepEqual(parseSession(JSON.stringify(session), 0), session));
test('rejects corrupt, incomplete and expired sessions', () => {
  for (const raw of ['invalid', 'null', '{}', JSON.stringify({ ...session, accessToken: '' }), JSON.stringify({ ...session, expiresAtUtc: 'invalid' })]) assert.equal(parseSession(raw), null);
  assert.equal(parseSession(JSON.stringify(session), Date.parse(session.expiresAtUtc)), null);
});
