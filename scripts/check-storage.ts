// ---------------------------------------------------------------------------
// Tells you where the app is keeping its data, and proves it can read it —
// and, on S3, that it can write too.
//
//   npm run check-storage
//
// Run it locally to confirm the file backend, or with COMPASS_S3_BUCKET set to
// confirm a bucket works before pointing the deployed app at it:
//
//   COMPASS_S3_BUCKET=my-bucket npm run check-storage
// ---------------------------------------------------------------------------

import { readRaw, writeRaw, storageMode, storageDescription } from '../src/lib/storage';
import {
  getConfig,
  getEntities,
  getEmployees,
  getActiveRules,
  getNotifications,
  getDemoGuideline,
} from '../src/lib/store';
import { SAMPLE_CIRCULARS } from '../src/lib/bundled-text';

async function main() {
  console.log(`\nStorage backend : ${storageMode()}`);
  console.log(`Location        : ${storageDescription()}\n`);

  const [config, entities, employees, rules, notifications, demo] = await Promise.all([
    getConfig(),
    getEntities(),
    getEmployees(),
    getActiveRules(),
    getNotifications(),
    getDemoGuideline(),
  ]);

  console.log('What the app can see:');
  console.log(`  companies        ${entities.length}  (${entities.map((e) => e.name).join(', ')})`);
  console.log(`  employees        ${employees.length}`);
  console.log(`  rules in force   ${rules.length}`);
  console.log(`  notifications    ${notifications.length}`);
  console.log(`  as-of date       ${config.asOfDate ?? '(today)'}`);
  console.log(`  demo circular    ${demo ? 'present' : 'MISSING'}`);
  console.log(`  sample circulars ${SAMPLE_CIRCULARS.length} bundled into the build`);

  const healthy = entities.length > 0 && employees.length > 0 && rules.length > 0;
  if (!healthy) {
    console.log('\n  Something is missing above. The app would come up looking empty.');
    process.exitCode = 1;
    return;
  }

  // Is this real stored state, or the bundled seed standing in for it?
  const stored = await readRaw('entities.json');
  console.log(
    stored === null
      ? '\n  Nothing stored yet — showing the seed compiled into the build.\n' +
          '  That is the correct state for a brand-new deployment.'
      : '\n  Reading stored state successfully.',
  );

  if (storageMode() === 's3') {
    console.log('\nTesting write access...');
    const probe = '.compass-write-probe.json';
    const payload = `${JSON.stringify({ probe: true }, null, 2)}\n`;
    try {
      await writeRaw(probe, payload);
      const back = await readRaw(probe);
      if (back !== payload) throw new Error('wrote, but read back something different');
      console.log('  Write and read-back succeeded. The bucket is usable.');
      console.log(`  (Left a small file at ${probe} — harmless, delete it if you like.)`);
    } catch (error) {
      console.log(`  WRITE FAILED: ${String(error).split('\n')[0]}`);
      console.log(
        '\n  The app would load but nothing could be saved — no new rule, no\n' +
          '  notification, no new employee. Check the bucket name, the region,\n' +
          '  and that the role has s3:PutObject on it.',
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log('\nAll good.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
