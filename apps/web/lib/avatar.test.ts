import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AVATAR_DATA_URL_MAX, UpdateMeSchema } from '@grabcode/contracts/schemas';
import { AVATAR_FILE_MAX, avatarFileError, fitDataUrl, squareCrop } from './avatar';

const jpeg = (len: number) => `data:image/jpeg;base64,${'A'.repeat(len)}`;
const avatarOk = (avatarUrl: string | null) => UpdateMeSchema.safeParse({ avatarUrl }).success;

test('avatarFileError: raster images under the cap only', () => {
  assert.equal(avatarFileError({ type: 'image/jpeg', size: 3_000_000 }), null);
  assert.equal(avatarFileError({ type: 'image/png', size: 1 }), null);
  assert.equal(avatarFileError({ type: 'image/webp', size: AVATAR_FILE_MAX }), null);
  assert.match(avatarFileError({ type: 'image/svg+xml', size: 100 })!, /JPG, PNG/);
  assert.match(avatarFileError({ type: 'application/pdf', size: 100 })!, /JPG, PNG/);
  assert.match(avatarFileError({ type: 'image/jpeg', size: AVATAR_FILE_MAX + 1 })!, /quá lớn/);
});

test('squareCrop: centered square', () => {
  assert.deepEqual(squareCrop(400, 200), { sx: 100, sy: 0, side: 200 });
  assert.deepEqual(squareCrop(300, 500), { sx: 0, sy: 100, side: 300 });
  assert.deepEqual(squareCrop(128, 128), { sx: 0, sy: 0, side: 128 });
});

test('fitDataUrl: lowers quality until the data URL fits, null if it never does', () => {
  const tried: number[] = [];
  const url = fitDataUrl((q) => {
    tried.push(q);
    return jpeg(q > 0.6 ? AVATAR_DATA_URL_MAX : 1000);
  });
  assert.equal(url, jpeg(1000));
  assert.deepEqual(tried, [0.85, 0.7, 0.55]);
  assert.equal(fitDataUrl(() => jpeg(AVATAR_DATA_URL_MAX)), null);
  // canvas.toDataURL returns "data:," when it cannot encode.
  assert.equal(fitDataUrl(() => 'data:,'), null);
});

test('UpdateMeSchema.avatarUrl: http(s) URL or small raster data URL', () => {
  assert.ok(avatarOk(null));
  assert.ok(avatarOk('https://avatars.githubusercontent.com/u/1?v=4'));
  assert.ok(avatarOk(jpeg(8000)));
  assert.ok(avatarOk('data:image/png;base64,iVBORw0KGgo='));
  assert.ok(avatarOk('data:image/webp;base64,UklGRg=='));
  assert.ok(!avatarOk(jpeg(AVATAR_DATA_URL_MAX)), 'over the size cap');
  assert.ok(!avatarOk('data:image/svg+xml;base64,PHN2Zz4='), 'svg can carry script');
  assert.ok(!avatarOk('data:text/html;base64,PGgxPg=='));
  assert.ok(!avatarOk('data:image/jpeg;base64,<script>'));
  assert.ok(!avatarOk('javascript:alert(1)'));
  assert.ok(!avatarOk('ftp://example.com/a.png'));
});
