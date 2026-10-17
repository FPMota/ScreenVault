#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.resolve(__dirname, '../tests');

const testFiles = readdirSync(testsDir)
  .filter((file) => file.endsWith('.test.mjs'))
  .map((file) => path.join('tests', file));

console.log('='.repeat(60));
console.log('🧪 ScreenVault Automated Test Suite');
console.log(`📂 Found ${testFiles.length} test suites:`);
for (const file of testFiles) {
  console.log(`   - ${file}`);
}
console.log('='.repeat(60));

const startTime = Date.now();

const child = spawn(process.execPath, ['--test', ...testFiles], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('='.repeat(60));
  if (code === 0) {
    console.log(`✅ ALL TESTS PASSED SUCCESSFULLY! (${duration}s)`);
  } else {
    console.error(`❌ SOME TESTS FAILED (Exit code ${code}) (${duration}s)`);
  }
  console.log('='.repeat(60));
  process.exit(code ?? 1);
});

