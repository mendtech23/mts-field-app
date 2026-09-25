# mendtech. Security Level 2 — setup guide

This guide covers two runs of the same steps:

- **Part A: the preview.** A second free Supabase project plus a preview website. You test everything here with no risk to real data.
- **Part B: going live.** The same steps on your real project, done only when the preview is perfect.

Everything here is free: Supabase free plan, Netlify free plan, and Resend free plan (3,000 e-mails a month).
Use your **personal** e-mail and accounts, never the Emirates work account or OneDrive.

What you need open:
- this folder (`garagepro-cloud`)
- the app folder (`garagepro`)
- supabase.com, netlify.com and resend.com, all signed in with your personal e-mail

---

## Part A: preview (about 45 minutes, once)

### A1. New Supabase project for the preview (5 min)
1. supabase.com → **New project**.
   - Name: `mendtech-preview`
   - Database password: long and random. Save it in your password manager.
   - Region: the same one as your live project.
2. Wait about 2 minutes while it starts.
3. **Project Settings → API Keys → "Legacy API keys"** tab. Copy the **Project URL** and the **anon public** key.

### A2. Create the garage (Owner) login (2 min)
1. **Authentication → Users → Add user → Create new user**.
   - Use your e-mail and a strong password.
   - Tick **Auto confirm user**.
2. Click the new user and copy its **User UID**. This is your *garage id*.
3. **Authentication → Sign In / Providers**:
   - Turn **off** "Allow new users to sign up". From now on only you can create logins, through the app.
   - Under **Multi-Factor**, check that **TOTP (authenticator app)** is **enabled**.

### A3. Turn on the two helpers (1 min)
**Database → Extensions**: turn on **pg_net** (instant alert e-mails) and **pg_cron** (the daily summary at 20:00).

### A4. Database scripts (5 min)
Easiest: open **`sql/all-in-one.sql`** from this folder, select all, copy, paste into the **SQL Editor** and press **Run** — it contains all three scripts below. Or paste each script separately, in this order:
1. The **cloud table** script. In the app: Settings → Cloud & devices → "Copy SQL script".
2. The **booking inbox** script. In the app: Settings → Mobile & booking → "Copy SQL".
3. **`sql/level2.sql`** from this folder. Open it in Notepad, select all, copy, paste, Run.
   - It should end with "Success. No rows returned".
   - It is safe to run again at any time, and nothing is ever deleted.

### A5. E-mail sending: Resend (5 min)
1. resend.com → **Sign up** with **mendtech23@gmail.com**. Resend's free plan only sends to the address you sign up with, which is exactly what you want.
2. **API Keys → Create API key**. Name it `mendtech`, give it "Sending access", and copy the key (starts with `re_`).

### A6. The three server functions (10 min)
In Supabase, go to **Edge Functions → Deploy a new function → Via Editor**. Deploy these three:

| Function name | File to paste (from this folder) | "Enforce JWT verification" |
|---|---|---|
| `login` | `functions/login/index.ts` | **OFF** |
| `staff-admin` | `functions/staff-admin/index.ts` | on (default) |
| `notify` | `functions/notify/index.ts` | **OFF** |

For each one:
1. Type the name exactly as shown.
2. Delete the sample code, paste the whole file, and press **Deploy**.
3. Open the function's **Details / Settings** and set JWT verification as shown in the table.

Then go to **Edge Functions → Secrets → Add new secret** and add:
- `RESEND_API_KEY` = the `re_…` key from A5
- `APP_URL` = your preview website address (from A7), e.g. `https://mendtech-preview.netlify.app`

### A7. The preview website (5 min)
1. Make a copy of the `garagepro` folder and call it `GaragePro-PREVIEW`.
2. In the copy, open `js/config.js` in Notepad and replace **everything** with the text below. Fill in your own values from A1 and A2:
   ```js
   window.GP_CONFIG = {
     mode: 'preview', previewCloud: true, dbName: 'garagepro-preview',
     supabaseUrl: 'https://YOUR-PREVIEW-PROJECT.supabase.co',
     supabaseKey: 'YOUR-PREVIEW-anon-public-key',
     garageId: 'YOUR-GARAGE-USER-UID'
   };
   ```
3. app.netlify.com → **Add new site → Deploy manually** → drag the `GaragePro-PREVIEW` folder. Rename the site to `mendtech-preview`.
4. If the address differs from what you put in `APP_URL`, update that secret.

### A8. Put a copy of your real data in the preview (optional, 5 min)
1. In the **live** app: Settings → Backup & data → **Download backup**.
2. In the **preview** site:
   - Settings → Backup & data → **Restore from backup**.
   - Then Settings → Cloud & devices → sign in with the garage login from A2.
3. Everything uploads to the *preview* project. Your live project is never touched.

### A9. Test the changeover (15 min)
Do this exactly as you will on the live day.

1. **Preview, Owner PC** → Settings → **Staff & security**. You'll see "Switch on Security Level 2":
   1. **Owner approval PIN.** 6–8 digits. It is *not* your screen PIN.
   2. **Alert e-mail**: `mendtech23@gmail.com`. An e-mail should arrive within a minute (check spam; add `onboarding@resend.dev` to your contacts).
   3. **Authenticator app.** Install Google Authenticator or Microsoft Authenticator on your phone, scan the QR code and type the code. Then choose your screen-lock PIN for this PC.
   4. **Staff logins.** Press "Copy from old PIN logins", or "Add login" for each person. Print or copy the usernames and passwords shown.
2. **Another device** (a phone): open the preview address, then sign in with a staff username and password.
   - A technician sees only their own jobs: customer name only, no prices.
   - A driver also sees the customer's phone and location.
3. **Test approvals.** As the Service Advisor, void an invoice. The Owner approval PIN is asked for. Type a wrong PIN, then the right one.
4. **Test a quotation link.** Open a quotation → Send WhatsApp. The message contains a link. Open it on another phone, type a name and press Approve. The quote turns "Approved" in the app within a minute.
5. **Test the Owner screens.** Settings → Staff & security:
   - alerts
   - staff logins (reset a password, switch someone off)
   - devices (press **Sign out** on the test phone and watch it get kicked out)
   - audit log
6. **Check your e-mail.** You should have instant alerts for the void, the sign-out, new logins and wrong PINs. At 20:00 the daily summary arrives.

If anything looks wrong, tell Claude what you saw (a screenshot helps). Nothing in the preview can affect the live app.

---

## Part B: going live (about 30 minutes, after closing time)

Until step B6 the app keeps working exactly as today. Staff notice nothing.

- **B1. Backup.** Live app → Settings → Backup & data → **Download backup** (password-protected).
- **B2. Live project.** Repeat **A2 step 3** (sign-ups off, TOTP on), **A3** (extensions) and **A4 script 3 only** (`level2.sql`) on your **live** Supabase project. The live project already has the cloud table and booking inbox.
- **B3. Functions.** Repeat **A6** on the live project, using the same Resend key. Set `APP_URL` = `https://mendtechauto.netlify.app`.
- **B4. Publish the app.**
  1. Close the app on every PC and phone.
  2. Netlify → **mendtechauto** → Deploys → drag the `garagepro` folder (live `config.js`).
  3. Reopen the app everywhere. Everything works as before.
- **B5. Switch on.** Do the four steps from **A9, point 1** on the **Owner PC**, *after closing time*.
- **B6. Hand out logins.** Everyone signs in once on their own phone, and on the office PC with their own username. They each choose a screen-lock PIN.
- **B7. Lock it in.**
  1. Settings → Mobile & booking → **Download config.js**. It now says `accounts: true`.
  2. Put it in the `garagepro/js` folder and publish again. New devices then go straight to the sign-in screen.

### If something goes wrong
- **Lost your phone with the authenticator.**
  - If you added a backup phone (Settings → Staff & security → "Add a backup phone"), use it.
  - If not: in Supabase, SQL Editor, run the line below. Your e-mail and password work alone again; then set up the app again.
    ```sql
    delete from auth.mfa_factors where user_id = 'YOUR-GARAGE-USER-UID';
    ```
- **A staff member forgot their password.** Settings → Staff & security → click the person → **Reset password**.
- **A phone was lost or stolen.** Settings → Staff & security → Devices → **Sign out**. Its copy of the data is wiped when it next opens.
- **Undo the publish.** Netlify → Deploys → previous deploy → **Publish deploy**. The database script can stay: it doesn't stop the old version working until you do step B5.

---

## What each file is
- `sql/level2.sql` is the database part. It sets up:
  - who belongs to the garage, and what each role may see and change, enforced by the database itself
  - the Owner approval PIN, checked by the server, with a lockout after 5 wrong tries
  - the audit log (nobody can edit or delete it)
  - devices and remote sign-out
  - alerts
  - the technician/driver data (their own jobs only)
  - the customer quote link
- `functions/login` handles sign-in with a username or e-mail. 5 wrong passwords lock the login and alert the Owner.
- `functions/staff-admin` lets the Owner (password + authenticator code) create, change, reset, switch off and sign out staff logins.
- `functions/notify` sends the e-mails: instant alerts, plus the daily summary at 20:00 Dubai time.
- `tests/` holds the automatic checks used while building. They run against a local copy of Supabase:
  - 120 database checks
  - 48 function checks
  - 45 checks in a real browser
