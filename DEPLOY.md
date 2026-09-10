# Deploying Compass IFSC to AWS Amplify

This puts the app on a real `https://` address that anyone can open, with no
laptop setup and no localhost.

> **App Runner is no longer an option.** AWS closed it to new customers on
> 30 April 2026. Amplify Hosting is the simplest remaining path for a Next.js
> app, and it is what this guide covers.

**Time:** about 25 minutes, most of it waiting for builds.
**Cost:** a few dollars a month at demo traffic. Well inside your credits.

---

## The one thing that makes this different from running locally

Amplify runs Next.js on **AWS Lambda, where the disk is read-only.** The app
saves rules, notifications and employees as JSON, so on Amplify that JSON goes
into an **S3 bucket** instead of into files.

This is already built. One environment variable decides which:

| `COMPASS_S3_BUCKET` | Where state lives |
|---|---|
| not set | JSON files in `/data` — your laptop, unchanged |
| set | objects in that S3 bucket — Amplify |

Nothing else about the app changes. If the bucket is empty, reads fall back to
the seed data compiled into the build, so a brand-new deployment comes up
already showing the demo rather than an empty dashboard.

---

## Step 0 — Push your code first

**Do this before anything else.** If Amplify builds the older commit, the site
will load but nothing will save — no new rule, no notification, no new
employee — because that version still writes to a read-only disk.

```bash
cd ~/Desktop/harsh
git push
```

---

## Step 1 — Create the S3 bucket

1. AWS console → **S3** → **Create bucket**.
2. **Bucket name:** something globally unique, e.g. `compass-ifsc-state-vishnu`.
   Write it down — you need it twice below.
3. **Region:** `us-east-1` (or whichever region you use for Bedrock — keep them
   the same).
4. Leave **Block all public access** ticked. The app reaches the bucket through
   a role, never over the public internet.
5. Everything else default. **Create bucket.**

Optional, but worth doing before you trust it — from your laptop:

```bash
COMPASS_S3_BUCKET=your-bucket-name npm run check-storage
```

That reports what the app can see and proves it can write. If it fails here it
will fail on Amplify too, so it is a cheap thing to check.

---

## Step 2 — Connect the repository (you are here)

In Amplify: **Create new app** → **GitHub** → authorise → pick the repository
and the **main** branch.

When it asks for build settings, use:

| Field | Value |
|---|---|
| **Frontend build command** | `npm run build` |
| **Build output directory** | `.next` |

If it offers to edit the YAML, replace the contents with this — it is the same
`amplify.yml` that is already in the repository:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci --include=dev
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - .next/cache/**/*
      - node_modules/**/*
```

`--include=dev` matters: Tailwind, TypeScript and the Next compiler are
devDependencies, and the build needs all three.

`.next` — not `out`, not `build`. This app is server-rendered, so Amplify must
deploy it to its compute service rather than as static files.

---

## Step 3 — Environment variables

Still on the same page, expand **Advanced settings** → **Environment variables**:

| Name | Value |
|---|---|
| `COMPASS_S3_BUCKET` | the bucket name from Step 1 |
| `BEDROCK_MODEL_ID` | `anthropic.claude-opus-5` |

**Do not add `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`.** They are not
needed and putting them here is the thing we are avoiding. Step 4 replaces
them with something better.

**Do not add `AWS_REGION` either** — Lambda sets it automatically, and Amplify
may refuse it as a reserved name.

Then **Save and deploy**. The first build takes 5–10 minutes.

---

## Step 4 — Give the app permission (instead of keys)

The build will succeed, but until you do this the app cannot reach S3 or
Bedrock — it will load, show the demo from the bundled seed, and fail when you
try to save anything.

Amplify calls this the **SSR compute role**: an IAM role that AWS hands to the
running app as temporary credentials. No key is stored anywhere.

1. AWS console → **IAM** → **Roles** → **Create role**.
2. **Trusted entity type:** *Custom trust policy*. Paste:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": { "Service": "amplify.amazonaws.com" },
         "Action": "sts:AssumeRole"
       }
     ]
   }
   ```

3. Skip attaching managed policies. Name the role `compass-ifsc-compute` and
   create it.
4. Open the role → **Add permissions** → **Create inline policy** → **JSON**.
   Paste this, replacing `YOUR-BUCKET-NAME` in **both** places:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:GetObject", "s3:PutObject"],
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       },
       {
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
       },
       {
         "Effect": "Allow",
         "Action": [
           "bedrock:InvokeModel",
           "bedrock:InvokeModelWithResponseStream"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

   Name it `compass-ifsc-compute-access` and save.

5. Back in **Amplify** → your app → **App settings** → **IAM roles** →
   **Compute role** → **Edit** → select `compass-ifsc-compute` → **Save**.

6. Redeploy so the app picks it up: **Deployments** → **Redeploy this version**.

---

## Step 5 — Check it actually works

Open the Amplify URL (something like
`https://main.d1a2b3c4d5e6f7.amplifyapp.com`) and confirm all four:

1. **The dashboard loads** with Acme Fund Management and its 48 employees.
   → the build and the bundled seed are fine.
2. **Guidelines → the two intake agents run** and return a draft and an audit.
   → Bedrock permission is working.
3. **Ask** returns an answer with a citation.
4. **Something saves.** Add a rule, or press **Reset demo**, then reload the
   page. If the change survives the reload, S3 is working.

Number 4 is the one that proves the S3 wiring. Do not skip it.

### If something is wrong

| What you see | What it means |
|---|---|
| Dashboard loads but nothing saves | The compute role is missing or lacks `s3:PutObject`. Recheck Step 4, then redeploy. |
| Agents return a "Bedrock not configured" style fallback | The role lacks the Bedrock actions, or model access is not enabled in that region. |
| Build fails on Tailwind or TypeScript | The build command dropped `--include=dev`. Recheck Step 2. |
| Blank page or 404s | Build output directory is not `.next`. |

Amplify → **Hosting** → **Monitoring** → **Logs** shows the app's own output,
including the `[storage]` warnings this app prints when it cannot reach S3.

---

## Living with it

**Resetting between demos.** The **Reset demo** button restores the clean
before-state. On Amplify this writes the seed back into S3, so it works exactly
as it does locally. Press it before you present.

**State now persists.** Unlike a container, S3 keeps whatever the last visitor
did. That is usually what you want, but it means the public URL can be left
mid-demo — hence the reset button.

**Updating the site.** Commit and push to `main`. Amplify rebuilds on its own.

**Costs.** Amplify bills for build minutes and requests; S3 storage here is a
few kilobytes. Bedrock is the only meaningful cost, and only when someone runs
the agents or the Q&A box.

---

## What is deliberately not in the repository

Verified against the actual tracked file list, not just assumed from
`.gitignore`:

| Not pushed | Why |
|---|---|
| `.env.local` | Your real AWS access key and secret live here, and only here. |
| `node_modules/` | Rebuilt from `package-lock.json` on every deploy. |
| `.next/`, `*.tsbuildinfo` | Build output. |
| `.toolchain/` | The Node runtime downloaded onto your laptop. |

`.env.example` **is** pushed and contains only blank placeholders.

Once Step 4 is done, the deployed site holds no credential at all. The key in
`.env.local` is only for running the app on your own laptop.

---

## One thing you still have to do yourself

The AWS access key and secret you pasted into a chat window earlier should be
treated as exposed, even though they never reached the repository.

**Rotate them:** IAM → *Users* → your user → *Security credentials* →
deactivate and delete the old key, create a new one, and paste it into your
local `.env.local`.
