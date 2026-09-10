// ---------------------------------------------------------------------------
// Turns the plain-text assets in /data into a TypeScript module so they are
// compiled into the build.
//
// Why: on AWS Amplify the app runs on Lambda and cannot rely on loose files
// being deployed alongside the code. The .txt and .csv files stay the readable
// source of truth — this just copies them into the bundle.
//
// Runs automatically before `npm run dev` and `npm run build`. If you edit a
// circular, the change is picked up next time you start or build.
// ---------------------------------------------------------------------------

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const circularsDir = path.join(root, 'data', 'sample-circulars');
const templateFile = path.join(root, 'data', 'employees-template.csv');
const target = path.join(root, 'src', 'lib', 'bundled-text.ts');

function label(name) {
  return name
    .replace(/^\d+-/, '')
    .replace(/\.txt$/, '')
    .replace(/-/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

async function main() {
  const names = (await fs.readdir(circularsDir)).filter((n) => n.endsWith('.txt')).sort();
  const documents = [];
  for (const name of names) {
    documents.push({
      name,
      label: label(name),
      text: await fs.readFile(path.join(circularsDir, name), 'utf8'),
    });
  }
  const template = await fs.readFile(templateFile, 'utf8');

  const banner = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/bundle-text.mjs from data/sample-circulars/*.txt and
// data/employees-template.csv. Regenerate with: npm run bundle-text
// (this also runs automatically before \`npm run dev\` and \`npm run build\`).

export interface SampleCircular {
  name: string;
  label: string;
  text: string;
}

`;

  const body =
    `export const SAMPLE_CIRCULARS: SampleCircular[] = ${JSON.stringify(documents, null, 2)};\n\n` +
    `export const EMPLOYEE_CSV_TEMPLATE = ${JSON.stringify(template)};\n`;

  await fs.writeFile(target, banner + body, 'utf8');
  console.log(
    `Bundled ${documents.length} sample circular(s) and the CSV template into src/lib/bundled-text.ts`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
