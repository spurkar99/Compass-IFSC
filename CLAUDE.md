# CLAUDE.md — Compass IFSC (Employee Compliance Layer)

> This file is the single source of truth for building this project. Read it fully
> before writing any code. Follow the phases in order. Do not skip ahead.

---

## 0. Who I am and how to work with me

- I have a **limited technical background**. Explain what you're doing in plain language
  before and after each step. Avoid jargon; when you must use a term, define it once.
- Build in **small, runnable steps**. After each phase, the app must run and I must be
  able to see something working. Never leave the project in a broken state between steps.
- When you make an assumption, **state it in one line** and continue — don't stop to ask
  unless it genuinely blocks you.
- If something can be done a simple way or a clever way, **choose simple.**

---

## 1. What we are building (in one sentence)

A web app where each company holds its employee data, IFSCA guidelines enter the system as
**structured requirements**, and whenever a guideline is added or changed, the system
**flags the specific employees who no longer meet it** and **notifies the company's
compliance officer** — with a human confirming before anything is treated as final.

### The core chain (this IS the product — everything serves this)
```
Guideline added/changed
   → engine finds which obligations are affected
   → engine finds employees who NEWLY fail the requirement
   → officer is notified: POLICY + PEOPLE + the specific GAP
   → officer reviews and confirms
```

---

## 2. What we are deliberately NOT building

Do not build these. They are the genuinely hard, weeks-long parts and are out of scope:
- ❌ Live scraping of the IFSCA website.
- ❌ Automated extraction of rules from PDFs.
- ❌ Any machine judgement that *declares* a person non-compliant on its own.

Instead: we build the **real skeleton** and **hand-seed** the rules through a form. That form
doubles as the future IFSCA-facing portal, so nothing here is throwaway.

---

## 3. Non-negotiable rules (hold these throughout)

1. **Flag for review, never declare "non-compliant."** The machine *surfaces* a possible
   gap; the officer *decides*. All UI wording must say "flagged for review" / "needs
   review," never "this person is non-compliant."
2. **The matching engine is deterministic code — NO AI, NO RAG.** Compliance checks are
   field comparisons (does the employee's certification meet the rule's requirement?).
   An LLM must never decide whether someone is compliant.
3. **Missing data ≠ non-compliant.** If an employee is missing a field a rule needs, the
   status is **`UNKNOWN — needs review`**, never a `FAIL`. This distinction is critical.
4. **AI is used in exactly two places, both optional garnish:**
   - Generating the plain-English **impact memo** when a rule changes.
   - The **citation-first Q&A box** (this, and only this, may use RAG).
   Everything else is deterministic.
5. **Every rule carries its real IFSCA citation text** so the system is grounded and
   auditable.
6. **Build the seams for scale.** Hand-loaded data must enter through the same structured
   "door" (the guideline form / a data-loading function) that a real pipeline would later
   use. Swapping hand-loaded data for pipeline data should be a swap, not a rewrite.

---

## 4. Tech stack (keep it simple)

- **Framework:** Next.js (React) — one app that serves both the UI and the API. Chosen
  because it runs locally with one command and deploys to AWS easily later.
- **Language:** TypeScript.
- **Data storage:** plain **JSON files** in a `/data` folder for the prototype. No database.
  (A database is a later upgrade; JSON keeps today simple and inspectable.)
- **Styling:** Tailwind CSS. Clean and readable — follow the **Design & aesthetics** section
  (4b) for the exact colour theme and layout. Don't over-design.
- **AI calls (only for the 2 optional features):** AWS Bedrock (Claude) so it uses my AWS
  credits. If Bedrock isn't configured, fall back to a clearly-labelled canned response so
  the app never breaks. Put any keys/config in a `.env.local` file and never hardcode them.

---

## 4b. Design & aesthetics (make it look trustworthy, not flashy)

This is a financial-compliance product, so the look should feel **calm, professional, and
credible** — like something a compliance officer would trust. Simple and clean beats busy.
Follow these deliberately; do not fall back to a generic default look.

**Colour theme — "Slate & Signal" (professional RegTech):**
- Background: soft near-white `#F8FAFC` (main), white `#FFFFFF` (cards).
- Primary / brand: deep slate-navy `#1E293B` (headers, sidebar, primary buttons).
- Accent: a single confident teal-blue `#0F766E` (links, active states, key actions).
- Text: `#0F172A` (headings), `#475569` (body/secondary).
- Borders / dividers: light grey `#E2E8F0`.

**Status colours (critical — the product is about status; make these instantly readable):**
- PASS / compliant → green `#16A34A` on a soft `#F0FDF4` background.
- FAIL / flagged for review → amber-red `#DC2626` on a soft `#FEF2F2` background.
- UNKNOWN / needs review → amber `#D97706` on a soft `#FFFBEB` background.
- Use a small coloured **pill/badge** for each status, with a dot + label. Never rely on
  colour alone — always include the text label (accessibility + clarity on a projector).

**Layout & feel:**
- Generous whitespace; don't cram. Let the dashboard breathe.
- Clean **card-based** layout: entity card, employee table, rules list, notifications panel
  each in their own white card with a subtle border and soft shadow.
- One clear font — use the default system/`Inter` sans-serif. Headings semibold, body regular.
- Rounded corners (about `8px`), subtle shadows, no gradients, no heavy borders.
- A slim top bar or left sidebar with the product name **"Compass IFSC"** and a simple
  compass/shield-style icon.
- The **notifications panel** is the star of the demo — give it a clear header, and when a
  new alert fires, make it visually obvious (a highlighted card, a count badge).
- Buttons: primary = solid slate-navy; secondary = white with a border. Keep them consistent.

**Rule of thumb:** if a screen looks cluttered or "loud," simplify it. Trustworthy = quiet.

---

## 5. Data models

Design these first. Keep them in TypeScript types and mirror them in the JSON seed files.

### Entity (a company in GIFT IFSC)
```
id, name, entityType (e.g. "Fund Management Entity", "FinTech Entity"),
activities[], licenses[],
characteristics { category?, aum?, ... }   // some rules apply based on these, not just role
complianceOfficer { name, email }           // who gets notified
```

### Employee (uploaded per entity via CSV)
```
id, entityId, name, role,
qualifications[],
certifications[ { name, issuedDate?, expiryDate? } ],
// fields may be missing — handle as UNKNOWN, never FAIL
```

### Rule (a structured IFSCA requirement — the "door")
```
id, citationRef (e.g. "IFSCA Circular XYZ, Clause 4.2"), citationText (real text),
appliesToEntityFilter { entityType?, category?, minAum?, ... },  // rule may be entity-conditional
targetRole,                                                       // e.g. "Principal Officer"
requirement {
   type: "HAS_CERTIFICATION" | "MIN_EXPERIENCE_YEARS" | "CERTIFICATION_NOT_EXPIRED" | ...,
   value                                                          // threshold / cert name / date
},
version, effectiveDate
```

Requirements must support **numeric thresholds and dates**, not just yes/no.

---

## 6. Build phases (do these IN ORDER; app must run after each)

### Phase 1 — Seed data (the demo script)
- Create `/data/entities.json`, `/data/employees.json`, `/data/rules.json`.
- Include **1–2 fictional entities**, a **small employee roster** for each, and
  **3–5 real IFSCA rules** as structured requirements (with real citation text).
- Design the data so the demo has a clear "before" (everyone passing) and a rule change
  that makes **2 specific people newly fail**.
- ✅ Checkpoint: I can open the JSON files and understand them.

### Phase 2 — Data models + app skeleton
- Set up the Next.js app, TypeScript types for the three models, and functions to load the
  JSON data.
- A single dashboard page that lists the entity, its employees, and current rules.
- Apply the **Slate & Signal** theme and card layout from section 4b from the start — set up
  the colours and base styles now so later phases inherit them.
- ✅ Checkpoint: `npm run dev` shows a clean, themed dashboard with seed data.

### Phase 3 — Matching engine (the part that MUST work)
- A pure function: given an entity + its employees + applicable rules, return each
  employee's status per rule: **PASS / FAIL / UNKNOWN**.
- Correctly handles: entity-conditional rules, numeric thresholds, dates, and missing data
  (→ UNKNOWN).
- Show status on the dashboard.
- ✅ Checkpoint: statuses are correct and I can verify them by hand against the data.

### Phase 4 — CSV upload
- Let a company upload employee data as CSV (with a downloadable template).
- Handle messy input gracefully: inconsistent role names, blank fields → UNKNOWN, not crash.
- ✅ Checkpoint: uploading a CSV updates the roster and re-runs the engine.

### Phase 5 — Guideline form + the notification chain (the core moment)
- A form to **add or update a guideline** (structured requirement). This is the IFSCA-portal
  skeleton.
- On submit: re-run the engine, find who **NEWLY** fails, and push a **notification** to the
  officer showing **policy + affected people + the exact gap**.
- A notifications panel that lights up, with a **"Confirm / Review"** action for the officer.
- ✅ Checkpoint: I can add a rule and watch the chain fire end to end. **This is the demo.**

### Phase 5b — (Optional) AI garnish
- **Impact memo:** when a rule changes, generate a plain-English summary via Bedrock.
- **Q&A box:** citation-first Q&A over the handful of rule texts (this may use lightweight
  RAG). Answers must cite the rule and never invent obligations.
- ✅ Only attempt if Phases 1–5 are solid.

### Phase 6 — Polish + demo rehearsal
- Tighten the dashboard so the story reads clearly.
- Write a short README with: how to run it, and the **90-second demo script**.

---

## 7. The 90-second demo story (build toward this)

1. Show **Acme Fund Management**: its profile, its 5 employees, all currently passing.
2. IFSCA publishes a circular raising the certification requirement for the
   **Principal Officer** → I add it through the guideline form.
3. The system detects it, flags that **2 of Acme's people newly fail**, and notifies the
   compliance officer with **the policy, the people, and the gap**.
4. Officer reviews and confirms.
5. (Optional) Show the plain-English impact memo and ask the Q&A box a question.

---

## 8. Running locally

- `npm install` then `npm run dev`, open the shown localhost URL.
- Keep this working at all times. Local is the primary target for the build.

---

## 9. (Optional, LAST) Deploying to AWS

Do this **only after everything works locally.** It is a bonus, not a requirement.
- Simplest path for a Next.js app: **AWS Amplify Hosting** (connect the code repo, it builds
  and hosts it). Costs a few dollars a month — well within the $300 credits.
- Keep secrets in Amplify's environment variables, not in code.
- If Amplify setup gets fiddly, stop and stay on local — a working local demo beats a broken
  deploy.

---

## 10. Definition of done

- [ ] I can add/change a guideline and watch the officer get notified about the exact
      employees who newly fail, with the citation shown.
- [ ] Missing data shows as UNKNOWN, never as a false FAIL.
- [ ] Nothing anywhere *declares* a person non-compliant — only *flags for review*.
- [ ] The app runs locally with one command and the demo story works start to finish.
