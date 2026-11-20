import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { splitBrandName } from './brand';

test('splitBrandName splits before the 2nd capital', () => {
  assert.deepEqual(splitBrandName('FastDemo'), ['Fast', 'Demo']);
  assert.deepEqual(splitBrandName('Fastdemo'), ['Fastdemo', '']);
  assert.deepEqual(splitBrandName('ABC'), ['A', 'BC']);
});

/** BRAND.tagline carries its own punctuation: "{BRAND.tagline}." would render "…chốt.." (ui-rebrand-spec §3). */
test('no component appends punctuation or text to BRAND.tagline', () => {
  const files = ['app', 'components'].flatMap((dir) =>
    readdirSync(join(__dirname, '..', dir), { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => join(__dirname, '..', dir, f)),
  );
  const bad = files.filter((f) => /(?<!\$)\{BRAND\.tagline\}[^\s<]/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});
