mendtech. workshop app v3.4
===========================

START
  Windows Start menu -> type "GaragePro"  (or double-click "Open GaragePro.bat" in this folder).
  Works 100% offline — PDF and Excel engines are built in (lib folder). Always use the same
  browser (Chrome): your data is stored inside it on this PC.

FIRST-TIME SETUP
  1. Settings > Garage details: name, logo, TRN, VAT %, labour rate, bank details.
  2. Settings > Staff & security: add yourself as Owner with a 6-8 digit PIN, then your staff
     (Service Advisor / Technician). From then on the app asks "Who's working?" + PIN.
  3. Technicians, Labour Catalogue, Parts & Stock, Service Packages (Minor/Major service…)
     — or Settings > Backup & data > "Import from Excel template".
  4. Optional: Settings > Cloud & devices to go online (see below).

DAILY WORKFLOW
  Bookings    -> plan the day, WhatsApp confirmation, reminder the day before, "Check in"
  Car arrives -> type plate or VIN -> full history opens (or register new car + owner)
  Job card    -> one per visit: complaint, technician, odometer, packages/parts/labour,
                 inspection, BEFORE/DURING/AFTER photos, customer e-signature
  Quotation   -> send by WhatsApp/Email -> "Approved -> Job card"
  Ready       -> WhatsApp "your car is ready" -> customer signs on collection
  Invoice     -> tax invoice with amount in words -> WhatsApp/Email PDF -> record payment -> receipt

ROLES
  Owner: everything.  Service Advisor: front desk, quotes, jobs, invoices, payments, stock
  (no profit reports, expenses, month-end or settings).  Technician: job cards, vehicles,
  bookings, stock.  Every record shows who created / last changed it.  Lock button bottom-left.

ONLINE (optional) — Settings > Cloud & devices
  1. Free account at supabase.com (personal email) -> New project.
  2. SQL Editor -> paste the script shown in the app -> Run.
  3. Authentication > Providers > Email: turn off "Confirm email".
  4. Project Settings > API: copy Project URL + anon key into the app -> Save
     -> "Create garage account". All data uploads; it now syncs automatically.
  5. Phone/tablet: drag this GaragePro folder onto app.netlify.com/drop (free) to get a
     web address -> open it on the phone -> "Add to Home screen" -> sign in with the same
     garage account. Works offline too; syncs when internet returns.

MONTH END — Finance > Month-end closing (checklist, P&L, VAT, cash-up, aging, lock month).

PRINT — every screen has 🖨 Print (choose "Save as PDF" for a file).

SECURITY LEVEL 2 (v3.4, once switched on — see garagepro-cloud/SETUP-GUIDE.md)
  Everyone signs in with their own username + password (Owner: e-mail + password + authenticator
  code). The PIN only unlocks the screen on that device. The cloud database enforces what each role
  may see and change; approvals use the Owner's approval PIN checked by the server; every change is
  in an audit log; the Owner can sign out any device; alerts go to mendtech23@gmail.com.

SECURITY (v3.1 — still used until Level 2 is switched on)
  5 wrong PINs lock a login for 15 minutes. Staff need the Owner's PIN for big discounts
  (over 10%), voiding / deleting invoices, deleting payments, changing an invoice's payment link
  and reopening a closed month. Bank / Stripe details, restore and erase always ask for the Owner PIN.
  Alerts: Settings > Staff & security.

!! BACKUP !!
  Without cloud sync: Settings > Backup & data > "Download backup" every week (includes photos).
  Each backup is locked with a password you choose — keep it written down, away from the file.
  With cloud sync: data is also kept in your Supabase project; still take a monthly backup.
