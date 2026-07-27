# Security and Role Model

## Owner

Complete access to all company information, prices, users, integrations, audit logs, backups and permissions. Only the Owner can approve users and grant elevated access.

## Admin

Operations, customers, quotes and job management as approved. No integration-secret access, Owner changes or permanent deletion.

## Supervisor

Assigned jobs, teams, progress, evidence, issues and quality controls. No prices by default.

## Worker

Only assigned jobs, approved scope, site details, required materials, checklists, photos, time, support and signature capture.

## HR

Employees, documents, attendance, leave, skills, certifications and onboarding. No financial access unless specifically granted.

## Outsourced staff

- Phone OTP
- Job-specific permissions
- Start and expiry date/time
- No customer directory
- No prices
- No unrelated jobs
- Automatic logout after expiry/completion
- Immediate owner revocation

## Login flow

1. Owner sends invitation to registered phone number.
2. User receives OTP.
3. User verifies phone.
4. Account remains Pending Owner Approval.
5. Owner selects role and access.
6. Device is registered.
7. User creates PIN and may enable biometrics.
8. New devices require another OTP and Owner policy checks.

## Production controls

- Server-side authorization on every request
- Short-lived sessions and refresh-token rotation
- Encrypted database and file storage
- Secrets only in server vault/environment storage
- Rate limiting and OTP abuse protection
- Device/session revocation
- Immutable audit log
- Soft delete and owner-only restoration
- Nightly encrypted backups
- Tested disaster recovery
- WorkDrive signed URLs with expiry
- No Zoho credentials on phones
- Mandatory MFA for Owner/Admin
- Security alerts by email and Slack
