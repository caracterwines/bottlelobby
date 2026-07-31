/* Runs every harness and reports one summary line per file.
   Exit code is non-zero if any of them fails, so this is the single
   command to run before a handover. */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/* Static checks first: if the file is structurally broken, that is the
   more useful message than a cascade of harness failures. */
/* `load-dashboard.js` is a shared module, not a harness: running it does
   nothing and would exit 0, which would read as a passing check. */
const NOT_HARNESSES = ['run-all.js', 'load-dashboard.js'];
const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.js') && !NOT_HARNESSES.includes(f))
  .sort((a, b) => (a === 'check-static.js' ? -1 : b === 'check-static.js' ? 1 : a.localeCompare(b)));

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
