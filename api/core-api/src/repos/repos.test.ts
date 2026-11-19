import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { validSignature } from './repos.controller';
import { githubLoginFromUrl, repoNameFor } from './repos.service';

test('webhook signature: exact sha256 HMAC of the raw body only', () => {
  const raw = Buffer.from('{"ref":"refs/heads/main"}');
  const sig = `sha256=${createHmac('sha256', 's3cret').update(raw).digest('hex')}`;
  assert.equal(validSignature('s3cret', raw, sig), true);
  assert.equal(validSignature('other', raw, sig), false);
  assert.equal(validSignature('s3cret', Buffer.from('{"ref":"x"}'), sig), false);
  assert.equal(validSignature('s3cret', raw, sig.toUpperCase()), false);
  assert.equal(validSignature('s3cret', raw, sig.slice(0, -1)), false);
  assert.equal(validSignature('s3cret', raw, undefined), false);
  assert.equal(validSignature('', raw, `sha256=${createHmac('sha256', '').update(raw).digest('hex')}`), false, 'unset secret never passes');
});

test('repo name and GitHub login parsing', () => {
  assert.equal(repoNameFor('GC-1042'), 'gc-1042');
  assert.equal(githubLoginFromUrl('https://github.com/octo-cat'), 'octo-cat');
  assert.equal(githubLoginFromUrl('http://www.github.com/octocat/'), 'octocat');
  for (const bad of [null, undefined, '', 'https://github.com/-bad', 'https://github.com/a/b', 'https://gitlab.com/octocat', 'https://github.com.evil.io/x', `https://github.com/${'a'.repeat(40)}`]) {
    assert.equal(githubLoginFromUrl(bad), null, String(bad));
  }
});
