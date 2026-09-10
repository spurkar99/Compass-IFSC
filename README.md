# Compass IFSC — employee compliance layer

A web app for GIFT IFSC entities. Each company holds its employee records; IFSCA
guidelines enter the system as **structured requirements**; and whenever a guideline
is added or changed, the system **flags the specific employees who no longer meet
it** and **notifies that company's compliance officer** — with a human confirming
before anything is treated as final.

```
Guideline added/changed
   → engine finds which entities the obligation reaches
   → engine finds employees who NEWLY fail the requirement
   → officer is notified: POLICY + PEOPLE + the exact GAP
   → officer reviews and confirms
```

---

## Three rules this system holds to

1. **It flags for review; it never declares anyone non-compliant.** The machine
   surfaces a possible gap. A person decides what it means. Every label in the UI
   says *"flagged for review"* or *"needs review"*.
2. **The matching engine is deterministic code — no AI anywhere near it.** Compliance
   checks are field comparisons ([`src/lib/engine.ts`](src/lib/engine.ts)). The same
   data always gives the same answer, and you can check every answer by hand.
3. **Missing data is `UNKNOWN`, never `FAIL`.** If a record lacks a field a rule needs,
   the result is *"needs review — data missing"*. A blank cell is never a failure.

AI is used in exactly two optional places, both of which fall back to plain
non-AI text if AWS Bedrock isn't configured: the plain-English **impact memo**, and
the citation-first **Q&A box**. Neither decides anything.

---

## Architecture: three layers, then a person

A guideline reaches the system through a pipeline where each stage is harder to argue with
than the last.

```
published circular (a person supplies the text)
   │
   ├─ Agent 1 · Drafting ──── proposes a structured rule, quoting the source for every field
   │
   ├─ Agent 2 · Audit ─────── re-reads the SAME document, blind to Agent 1's reasoning,
   │                          and attacks the draft: invented values, dropped carve-outs,
   │                          scope creep, wrong dates, wrong requirement type
   │
   ├─ validateDraft() ─────── ordinary code. Units, exact-match fields, enum membership,
   │                          and whether a named certification exists on any roster.
   │                          Neither agent can talk it out of anything.
   │
   └─ the compliance officer ─ reads all three and files it, or doesn't
```

Then, and only then, the deterministic engine runs and the notification chain fires.

**Where the agents sit is the whole design.** They work on the *intake* side — turning prose
into structure, which is the job deterministic code genuinely cannot do, and the one place
where being wrong is recoverable because a person approves next. They never touch the engine,
they never decide whether anyone complies, and neither of them can save anything.

### Self-correction, and why it isn't staged

Try the **With carve-outs** sample on the Guidelines page. It contains the things a drafting
model fumbles: a threshold written in words ("not less than seven years"), an exemption in a
separate paragraph, and a compliance date that differs from the reporting deadline.

What happened when it was built: Agent 1 read it correctly, including spotting the carve-out
in its notes. Agent 2 found that the carve-out was not represented in any field, so the rule
as drafted would over-apply — a genuine BLOCKER. But Agent 2's *fix* then broke two fields:
it wrote `minAum` as `200000000` when the schema is denominated in millions, and appended the
exemption to `entityType`, which is matched by exact string equality. Either would have
produced a rule that silently matched nobody.

That is why layer 3 exists. `validateDraft()` catches both, repairs them, and reports what it
did — and those two exact cases are now pinned in the self-check suite. The lesson generalises:
an agent reviewing another agent catches reasoning errors, but neither reliably remembers the
target system's units and matching rules. That part belongs in code.

### Human-in-the-loop, twice

Two gates, both real — no agent can complete either:

1. **Filing a rule.** The intake pipeline ends at a hand-off. The proposal is loaded into the
   guideline form and a person submits it.
2. **Acting on a finding.** The engine flags people; the officer confirms, with a note.

---

## Running it

You need **Node.js 20 or newer**.

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

> **Note for this machine:** Node wasn't installed, so a local copy lives in
> `.toolchain/node` (git-ignored, nothing outside this folder was touched). To use it:
> ```bash
> export PATH="$PWD/.toolchain/node/bin:$PATH"
> ```
> Add that line to your shell profile, or install Node normally and delete `.toolchain/`.

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on port 3000. |
| `npm run verify` | Run the self-check in the terminal (63 hand-worked expectations). |
| `npm run reset` | Restore the demo data to the "before" state. Also available as a button in the app. |
| `npm run check-ai` | Test your AWS Bedrock credentials with one real call. |
| `npm run seed` | Rebuild the seed data from `scripts/generate-seed.mjs`. |
| `npm run synth -- --entity acme-fm --count 12` | Generate extra synthetic employee records with Claude on Bedrock. Add `--dry-run` to preview. |
| `npm run build` | Production build. |

### Putting it online

Everything above runs on your own laptop. To give it a public `https://` address that
anyone can open — a judge, a teammate, someone on their phone — see **[DEPLOY.md](DEPLOY.md)**.

It walks through AWS App Runner, which builds straight from the GitHub repository and
redeploys on every push. Two things worth knowing before you read it:

- **No key is stored anywhere.** The deployed app gets its Bedrock permission from an IAM
  instance role that AWS hands it at runtime. `src/lib/ai.ts` already falls back to the
  standard AWS credential chain when no explicit keys are set, which is exactly what the
  role provides.
- **The live site resets itself.** State lives in JSON files inside the running container,
  so a redeploy or restart returns to the rehearsed before-state. For a demo that is a
  feature: the public URL cannot be left in a broken state, and cannot be vandalised.

---

## The demo

Start from a clean state: `npm run reset` (or click **Reset demo data** on the *Companies*
page). There are two acts. Act 2 alone is the 90-second version; Act 1 adds about a minute
and is where the agent architecture shows itself.

### Act 1 — a circular arrives, and two agents disagree about it (~60s)

Go to **Guidelines** and click the **With carve-outs** sample, then **Run the intake agents**.

The progress rail moves through *Agent 1 · draft → Agent 2 · audit → Code · validate → You ·
sign off*. It takes about 40 seconds — talk over it, because what appears is the point:

- **Agent 1** proposes the rule and, under *Why it said that*, the exact sentence behind every
  field. Its notes flag the carve-out and the two different dates.
- **Agent 2** returns a verdict and its findings, colour-coded. Read the BLOCKER aloud.
- **Deterministic validation** reports whether the agents stayed inside the schema.
- **Your sign-off** shows the final values and a button. Nothing has been filed.

Click **Send to the guideline form for sign-off** and the form below fills in. You could file
it — but for the main demo, don't: reset and run Act 2 on the clean rule set.

> Say: *"Two agents, and the second one caught the first over-applying an obligation. Then
> plain code caught the second one getting the units wrong. Then it asks me."*

### Act 2 — the chain fires (90s)

**1. "Here is the company." (20s)** — Open the **Dashboard**.

Acme Fund Management: **48 employees**, checked against **23 of the 24 requirements** in
force, giving **131 individual checks**. The tiles read **125 of 131 checks met, 2 people
flagged, 2 people needing review**.

The roster opens on **Needs attention**, so only those 4 people are listed — click
**Everyone** to show all 48. Expand any row to see each requirement that person was checked
against, and why.

> Say: *"Two of these are a standing backlog — lapsed training. Two are new joiners whose
> records HR hasn't sent, which is 'needs review', not a failure. Watch what happens to
> this list when a new rule lands."*

**2. "Now IFSCA publishes a circular." (25s)** — Go to **Guidelines** and click
**Load demo circular** (the pre-filled version, so Act 2 stays quick).

The form fills in: a circular requiring the **Principal Officer and every Fund Manager**
at a Fund Management Entity to hold the **NISM-Series-XIX-C** certification, effective
1 October 2026. Click **File guideline and run the checks**.

> Say: *"This form is the IFSCA-facing door. Nothing about it is throwaway — a real
> feed would deliver a rule in exactly this shape."*

**3. "The system finds who is newly affected." (25s)** — Go back to the **Dashboard**.

A red **Action needed** card is waiting, with a **1 new** badge in the sidebar. It shows:

- **The policy** — the citation reference and the circular's actual text.
- **The people** — **2 newly flagged**: Sana Kapoor and Rohit Desai, both Fund Managers.
- **The gap** — for each: what the rule requires, what is on record, and the difference.

Three things to point at:

- **2 named people out of 48**, found across 131 existing checks.
- The alert does **not** mention Marcus Lee or Vikas Chandra — the two people who were
  already flagged before the circular. Only genuine movements are reported, so the officer
  is never re-shown yesterday's backlog as though it were news.
- **Arjun Mehta, the Principal Officer, is not flagged.** The rule covers him; he already
  holds the certification. And Northgate FinTech got no notification at all, because the
  circular only reaches Fund Management Entities.

> Say: *"Two people, named, with the exact gap — not "your firm may have an issue"."*

**4. "A person decides." (20s)** — Optionally click **Generate memo** for a plain-English
note. Then type a note in **Officer review** and click **Confirm review**.

The card turns green: *Reviewed and confirmed by Priya Raghavan*.

> Say: *"Nothing was ever declared. The system surfaced a gap; the officer decided."*

### Two things worth showing if you have another minute

- **Switch to Northgate FinTech Solutions** on the dashboard. It shows all three states
  side by side: one person passing, one **flagged** (AML training 29 months out of date),
  and one **needing review** — Aisha Bello, a new joiner whose records HR hasn't supplied.
  She is *not* a failure. That distinction is the point.
- **Self-check** in the sidebar: 47 expectations, each worked out by hand from the
  seed data and compared against what the engine actually returns.

### An alternative demo: tightening an existing rule

On **Guidelines**, choose **Update an existing guideline** → `R-003` (Compliance
Officer, 3 years' experience) and change the minimum to **12 years**. Priya Raghavan
(11 years) is newly flagged, and the old version is kept on the page under
*Superseded versions*. Set it back to 3 and she is reported as *no longer flagged*.

---

## Adding companies, employees and guidelines

Everything can be added through the UI — the seed data is a starting point, not a fixture.

**Add a guideline** — *Guidelines* page. Any combination of the five requirement types, any
entity filter (type, category, minimum AUM, activity, licence, or none), and any target role
— one, several, a brand-new role you type, or every employee. A citation reference and text
are required: a rule with no traceable source is rejected. Choosing *Update an existing
guideline* creates a new version and keeps the old one visible.

**Add an employee** — *+ Add an employee* on the dashboard roster. The employee id follows
the entity's existing numbering (E-105 → E-106). Leave any field blank and it becomes
"not provided", which shows as **needs review** — never a failure. The response tells you
immediately how the new person lands against the rules already in force.

**Add a company** — *Companies* page → *+ Add a company*. Name, entity type, optional
category/AUM/jurisdiction, activities, licences, and the compliance officer who will receive
notifications. Rules already in force apply to it the moment it exists — a new Fund
Management Entity immediately shows all five FME rules reaching it, each noting that nobody
holds the target role yet.

Leaving AUM blank is meaningful, not lazy: a rule with an AUM threshold then reports
*"applicability needs review"* against that company rather than silently skipping it.

**Load a roster from CSV** — *Companies* page. Two modes:

- **Add / update people** — rows are matched on employee id; existing people are updated and
  new ones appended. A one-row file adds one person.
- **Replace whole roster** — everyone currently on the roster is removed and replaced.

Adding a person does not raise an officer notification. Notifications are kept for guideline
changes, so the alert list stays a record of *policy* movements; a new joiner's gaps show on
the roster straight away instead.

---

## How it is put together

```
data/                      the whole state of the system, as readable JSON
  entities.json            the two companies
  employees.json           their rosters (48 + 22 people)
  rules.json               24 IFSCA requirements, as structured rules
  notifications.json       alerts raised to compliance officers
  config.json              the evaluation date
  demo-guideline.json      pre-fill for the "Load demo circular" button
  seed/                    pristine copies — `npm run reset` restores from here
  employees-template.csv   the CSV template offered in the app
  sample-circulars/        plain-text circulars for the intake agents to read

scripts/
  generate-seed.mjs        rebuilds the seed data (`npm run seed`) — the record of
                           intent behind the numbers above
  verify-engine.ts         the 50 hand-worked expectations (`npm run verify`)
  check-bedrock.ts         tests your AWS credentials (`npm run check-ai`)
  reset-demo.mjs           restores the demo (`npm run reset`)

src/lib/
  engine.ts                THE MATCHING ENGINE — deterministic, no AI
  agents.ts                the two intake agents + validateDraft(), the code guardrail
  impact.ts                before/after comparison: who is NEWLY affected
  store.ts                 the one door all data enters and leaves through
  csv.ts                   forgiving CSV import
  normalize.ts             role and credential matching, written down in one place
  dates.ts                 date maths, in UTC, from ISO strings
  ai.ts                    the Bedrock client and the two optional AI features
  selfcheck.ts             63 hand-worked expectations

src/app/
  page.tsx                 dashboard: status tiles, notifications, roster
  company/                 company profile, rule coverage, CSV load, add a company
  rules/                   intake agents, the guideline form, and the rules in force
  ask/                     the citation-first Q&A box
  self-check/              the 63 hand-worked expectations
  provenance/              what is synthetic, mocked, deterministic or AI
  api/                     guidelines, employees, entities, notifications, reset

src/components/            UI, all on the "Slate & Signal" theme
```

### The three data models

**Entity** — a company: type, activities, licences, characteristics (category, AUM),
and the compliance officer who gets notified.

**Employee** — id, entity, name, role, qualifications, certifications (with issue and
expiry dates), years of experience. **Any field may be missing**, and missing means
`UNKNOWN`.

**Rule** — a citation reference and its real text, an entity filter (so a rule can apply
based on entity type, category or AUM rather than just job title), a target role (one
role, several, or `*` for everyone), a requirement, a version and an effective date.

Requirements support certifications, numeric thresholds and dates:

| Requirement type | Checks |
|---|---|
| `HAS_CERTIFICATION` | holds a named certification |
| `CERTIFICATION_NOT_EXPIRED` | holds it, and its expiry date has not passed |
| `CERTIFICATION_RENEWED_WITHIN_MONTHS` | completed within the last N months |
| `MIN_EXPERIENCE_YEARS` | at least N years on record |
| `HAS_QUALIFICATION` | holds any one of a list of accepted qualifications |

An unrecognised requirement type returns `UNKNOWN`, never `FAIL`.

### `null` vs `[]` — the distinction that matters

- `null` or field absent → **we were not given this data** → `UNKNOWN`
- `[]` (an empty list) → **we know they hold none** → this can be a `FAIL`

The CSV importer follows the same rule: a blank cell becomes `null`, never an empty list.
Unreadable text in a number column (`"not a number"`) also becomes `null` with a warning —
it is never quietly read as zero, which would manufacture a failure.

### Why the "before" state is not spotless

Acme's 48-person roster starts with 2 people flagged and 2 needing review. That is
deliberate. A 48-person firm with a flawless record would not be believable, and the
backlog earns its place in the demo: it proves the alert reports only what **newly** moved,
not everything currently open. The two flagged cases are lapsed trainings; the two needing
review are recent joiners whose records have not been supplied.

Every *key-personnel* requirement is met before the demo starts, so the new circular is
unmistakably the thing that changes.

### Dates and reproducibility

`data/config.json` sets `asOfDate` (default `2026-08-22`). Every expiry and renewal check
measures against that date, so the demo gives the same answer every time it runs. Set it
to `null` to use today's real date instead.

---

## What's synthetic, what's mocked, what's real

There is a **Real vs. mocked** page in the app that sets this out component by component —
data, logic, and the two human gates. Open it if anyone asks what is load-bearing and what is
scaffolding; it is deliberately blunt.

The short version: every person and company is invented, discovery of new circulars is a
person pasting text, storage is JSON files, there is no auth, and nothing is emailed. What is
real is the mechanism — the engine, the before/after diff, the two-agent intake with its
deterministic check, and the two points where a human has to act.

Synthetic employee records come from two places: `npm run seed` (hand-designed, the
reproducible demo) and `npm run synth` (generated by Claude on Bedrock, tagged in the record
so it is always distinguishable). `npm run synth` never writes to `data/seed/`, so a reset
always restores the demo.

## About the citation text — read this before showing anyone

The 24 rules were hand-entered, drawing on real IFSCA instruments: the **IFSCA (Fund
Management) Regulations, 2022**, the **IFSCA AML/CFT/KYC Guidelines, 2022**, the **IFSCA
(Capital Market Intermediaries) Regulations, 2021**, and IFSCA's cyber security framework.

**The instruments are real; the specific clause references are indicative and the wording is
paraphrased.** They have not been checked line-by-line against the IFSCA handbook. Every
rule carries a `citationSource` note saying exactly this, shown under *Source text* on the
Guidelines page — so anyone inspecting a rule sees the caveat next to the text.

Treat the rule set as a realistic body of requirements for demonstrating the mechanism, not
as a compliance reference. Verify each citation before any operational use.

The demo circular (`data/demo-guideline.json`) is **illustrative — it is not a real IFSCA
circular.** It stands in for the guideline a regulator would file through the form, and it
says so on screen.

Automated extraction of rules from the IFSCA website or from PDFs is deliberately out of
scope. Rules are hand-seeded through the same structured door a real pipeline would use,
so replacing hand-loaded data with pipeline data is a swap, not a rewrite.

---

## Optional: enabling the AI features with AWS Bedrock

Both AI features work with no setup at all — they fall back to text written by ordinary
code and labelled as such in the UI. To have Claude write them instead:

**1. Create your local env file** (it is git-ignored; `.env.example` is the committed template):

```bash
cp .env.example .env.local
```

**2. Fill in four values** in `.env.local`:

```
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-opus-5
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

Paste the keys with no quotes and no trailing spaces. If your access key starts with
`ASIA` rather than `AKIA` it is a temporary credential and you also need
`AWS_SESSION_TOKEN`.

**3. Enable model access in AWS.** This is the step people miss. Having valid keys is not
enough — in the AWS console go to **Bedrock → Model access** in the *same region* as
`AWS_REGION` and enable the Anthropic models. Your IAM user also needs
`bedrock:InvokeModel`.

**4. Test the credentials:**

```bash
npm run check-ai
```

It prints what it is about to use (masking the secret), makes one small real call, and on
failure explains the likely cause — wrong keys, model access not enabled, wrong region, or
a missing session token. On success:

```
SUCCESS — Bedrock replied: "it works"
```

**5. Restart the app** — `Ctrl-C`, then `npm run dev`. Environment variables are read at
startup, so a running server will not pick up a new `.env.local`.

### How to tell which mode you are in

Look at the footnote under any generated memo or Q&A answer:

- *"Written by anthropic.claude-opus-5 from the findings above"* — Bedrock is working.
- *"Template text — Bedrock not configured, so no AI was called"* — still on the fallback.

If a call fails at runtime the app logs a warning to the terminal and shows the labelled
fallback. It never breaks, and it never pretends an AI answered when one did not.

Set `COMPASS_DISABLE_AI=1` to force the fallback even with valid keys.

---

## Notes and limitations

- **JSON files, not a database.** State lives in `data/*.json`, which is inspectable and
  easy to reason about, but it means one writer at a time and no concurrency safety. A
  database is the obvious next upgrade; `src/lib/store.ts` is the only file that would change.
- **No authentication.** Everyone sees every company. Real use needs per-company login.
- **Notifications are in-app only.** Nothing is emailed; the officer's address is shown
  on the alert.
- **Records can be added but not edited or removed** through the UI. Correcting a typo means
  re-uploading the roster in *Add / update people* mode, or editing `data/employees.json`.
- **Companies you add are not written to `data/seed/`**, so `npm run reset` removes them.
  That is deliberate — reset exists to restore the demo — but copy the file if you want to
  keep a company you have set up.
