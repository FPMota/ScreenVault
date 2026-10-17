import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(__dirname, '../App.tsx');

// Parse the i18n object directly from App.tsx source to avoid React Native bundling overhead in Node
function extractI18n() {
  const source = fs.readFileSync(appPath, 'utf8');
  const match = source.match(/export const i18n\s*=\s*({[\s\S]*?\r?\n\s*};)/);
  if (!match) {
    throw new Error('Could not find export const i18n in App.tsx');
  }
  // Evaluate the object literal cleanly
  const evalFn = new Function(`return ${match[1]}`);
  return evalFn();
}

test('i18n translation dictionary integrity', async (t) => {
  const i18n = extractI18n();

  await t.test('has English and Portuguese languages defined', () => {
    assert.ok(i18n.en, 'English translations must exist');
    assert.ok(i18n.pt, 'Portuguese translations must exist');
  });

  await t.test('en and pt have identical translation keys (no missing translations)', () => {
    const enKeys = Object.keys(i18n.en).sort();
    const ptKeys = Object.keys(i18n.pt).sort();

    const missingInPt = enKeys.filter((k) => !ptKeys.includes(k));
    const missingInEn = ptKeys.filter((k) => !enKeys.includes(k));

    assert.deepEqual(
      missingInPt,
      [],
      `Keys present in 'en' but missing in 'pt': ${missingInPt.join(', ')}`
    );
    assert.deepEqual(
      missingInEn,
      [],
      `Keys present in 'pt' but missing in 'en': ${missingInEn.join(', ')}`
    );
  });

  await t.test('all translation values are non-empty strings', () => {
    for (const [lang, translations] of Object.entries(i18n)) {
      for (const [key, value] of Object.entries(translations)) {
        assert.equal(
          typeof value,
          'string',
          `Translation for ${lang}.${key} should be a string, got ${typeof value}`
        );
        assert.ok(
          value.trim().length > 0,
          `Translation for ${lang}.${key} must not be empty`
        );
      }
    }
  });

  await t.test('version text includes correct version number format', () => {
    assert.match(i18n.en.versionText, /Version \d+\.\d+/);
    assert.match(i18n.pt.versionText, /Versão \d+\.\d+/);
  });
});

