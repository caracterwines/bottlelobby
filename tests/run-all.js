/* Runs every harness and reports one summary line per file.
   Exit code is non-zero if any of them fails, so this is the single
   command to run before a handover. */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.js') && f !== 'run-all.js')
  .sort();

let failed = 0;
for (const f of files) {
  process.stdout.write(f.padEnd(24));
  try {
    execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: 'pipe' });
    console.log('PASS');
  } catch (e) {
    failed++;
    console.log('FAIL');
    console.log((e.stdout ? e.stdout.toString() : '').split('\n')
      .filter(l => l.includes('✗')).map(l => '    ' + l.trim()).join('\n'));
  }
}
console.log(failed ? `\n${failed} harness(es) failing` : `\n${files.length} harnesses passing`);
process.exit(failed ? 1 : 0);
