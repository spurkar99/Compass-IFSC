// Run the engine self-check from the terminal:  npm run verify
import { runSelfChecks } from '../src/lib/selfcheck';

async function main() {
  const report = await runSelfChecks();

  let currentGroup = '';
  for (const outcome of report.outcomes) {
    if (outcome.group !== currentGroup) {
      currentGroup = outcome.group;
      console.log(`\n${currentGroup}`);
    }
    console.log(`${outcome.ok ? '  PASS ' : '  FAIL '} ${outcome.description}`);
    if (!outcome.ok) {
      console.log(`         expected: ${outcome.expected}`);
      console.log(`         actual:   ${outcome.actual}`);
    }
  }

  console.log(
    `\n${report.passed}/${report.outcomes.length} expectations met (evaluated as of ${report.asOfDate}).`,
  );
  if (report.failed > 0) {
    console.error(`${report.failed} expectation(s) NOT met.`);
    process.exit(1);
  }
}

main();
