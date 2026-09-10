// Restore /data from /data/seed so the demo can be run again from the top.
// Usage:  npm run reset
import { promises as fs } from 'node:fs';
import path from 'node:path';

const dataDir = path.join(process.cwd(), 'data');
const seedDir = path.join(dataDir, 'seed');
const files = ['entities.json', 'employees.json', 'rules.json', 'notifications.json'];

let restored = 0;
for (const file of files) {
  try {
    const raw = await fs.readFile(path.join(seedDir, file), 'utf8');
    await fs.writeFile(path.join(dataDir, file), raw, 'utf8');
    console.log(`  restored data/${file}`);
    restored += 1;
  } catch (error) {
    console.warn(`  skipped data/${file} (${error.code ?? error.message})`);
  }
}
console.log(
  restored === files.length
    ? '\nDemo data reset. Acme Fund Management is back to everyone passing, and there are no notifications.'
    : `\nReset ${restored} of ${files.length} files.`,
);
