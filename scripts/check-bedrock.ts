// Check whether AWS Bedrock is reachable with your current settings.
//   npm run check-ai
//
// It reads .env.local, prints what it is about to use (never the secret itself),
// makes one tiny real call, and explains any failure in plain language.
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Load .env.local into process.env, the way `next dev` does. */
async function loadEnvLocal(): Promise<boolean> {
  for (const file of ['.env.local', '.env']) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const key = trimmed.slice(0, index).trim();
        let value = trimmed.slice(index + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (value !== '' && process.env[key] === undefined) process.env[key] = value;
      }
      console.log(`Loaded ${file}`);
      return true;
    } catch {
      // try the next one
    }
  }
  return false;
}

function mask(value: string | undefined): string {
  if (!value) return 'not set';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} chars)`;
}

async function main() {
  const found = await loadEnvLocal();
  if (!found) {
    console.log('No .env.local file found.');
    console.log('Create one with:  cp .env.example .env.local');
  }

  const { bedrockConfigSummary, bedrockOptions } = await import('../src/lib/ai');
  const summary = bedrockConfigSummary();

  console.log('\nSettings');
  console.log(`  AWS_REGION            ${summary.region}`);
  console.log(`  BEDROCK_MODEL_ID      ${summary.model}`);
  console.log(`  AWS_ACCESS_KEY_ID     ${mask(process.env.AWS_ACCESS_KEY_ID)}`);
  console.log(`  AWS_SECRET_ACCESS_KEY ${mask(process.env.AWS_SECRET_ACCESS_KEY)}`);
  console.log(`  AWS_SESSION_TOKEN     ${mask(process.env.AWS_SESSION_TOKEN)}`);
  console.log(`  credentials in use    ${summary.credentials}`);

  if (summary.disabled) {
    console.log('\nCOMPASS_DISABLE_AI=1 is set, so the app will not call Bedrock at all.');
    console.log('Remove it from .env.local to enable the AI features.');
    process.exit(1);
  }

  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('\nNo access key found. The app will use the labelled fallback text.');
    console.log('Put your keys in .env.local — see .env.example.');
    process.exit(1);
  }

  console.log('\nCalling Bedrock once…');
  try {
    const { AnthropicBedrockMantle } = await import('@anthropic-ai/bedrock-sdk');
    const client = new AnthropicBedrockMantle(bedrockOptions());
    const response = await client.messages.create({
      model: summary.model,
      max_tokens: 32,
      messages: [{ role: 'user', content: 'Reply with the two words: it works' }],
    });
    const text = response.content
      .filter((block): block is { type: 'text'; text: string; citations: null } => block.type === 'text')
      .map((block) => block.text)
      .join(' ')
      .trim();
    console.log(`\nSUCCESS — Bedrock replied: "${text}"`);
    console.log('The impact memo and the Q&A box will now use Claude.');
    console.log('Restart the app (Ctrl-C then `npm run dev`) if it is already running.');
  } catch (error) {
    const err = error as { status?: number; name?: string; message?: string };
    console.log(`\nFAILED — ${err.name ?? 'Error'}${err.status ? ` (HTTP ${err.status})` : ''}`);
    console.log(`  ${err.message ?? String(error)}`);
    console.log('\nMost likely causes, in order:');
    if (err.status === 403 || /AccessDenied|not authorized/i.test(err.message ?? '')) {
      console.log('  1. Model access is not enabled for this model in this region.');
      console.log('     AWS console -> Bedrock -> Model access -> enable the Anthropic models.');
      console.log('  2. The IAM user/role lacks the bedrock:InvokeModel permission.');
    } else if (err.status === 400 && /model/i.test(err.message ?? '')) {
      console.log(`  1. "${summary.model}" is not a valid model id in ${summary.region}.`);
      console.log('     Try a different BEDROCK_MODEL_ID, or a region where it is available.');
    } else if (err.status === 401 || /credential|signature|InvalidSignature/i.test(err.message ?? '')) {
      console.log('  1. The access key or secret is wrong, or has a stray space or quote.');
      console.log('  2. If they are temporary keys, AWS_SESSION_TOKEN is also required.');
    } else {
      console.log('  1. Wrong region, or no Bedrock in that region.');
      console.log('  2. Model access not enabled, or missing bedrock:InvokeModel permission.');
      console.log('  3. Network or proxy blocking the request.');
    }
    console.log('\nThe app still works meanwhile — both AI features fall back to');
    console.log('clearly-labelled non-AI text, and the compliance engine never used AI.');
    process.exit(1);
  }
}

main();
