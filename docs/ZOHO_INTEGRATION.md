# Zoho One Integration Map

## System of record

| Data | Master system |
|---|---|
| Leads, contacts, accounts, properties | Zoho CRM |
| Products, services, quotes, invoices, VAT, payments | Zoho Books / Inventory |
| Projects, task lists, tasks, milestones, progress, timesheets | Zoho Projects |
| Employees, leave, attendance and HR records | Zoho People |
| Photos, reports, IDs and signed documents | Zoho WorkDrive |
| Field dispatch, checklists, GPS, worker acceptance and operational timeline | MendTech OS |

## Two-way synchronization

### Zoho to MendTech OS
- CRM customers and properties
- Books/Inventory items, prices, VAT and quote status
- People employees and employment status
- Projects task changes and completion
- Payment and invoice state

### MendTech OS to Zoho
- Inspections and CRM updates
- Draft/updated quotations
- Approved jobs converted to Projects/tasks
- Assignments, percentages, task comments and timesheets
- Photos and service reports uploaded to WorkDrive
- Invoice trigger after approved completion

## Record linking

Every operational record must retain the Zoho IDs and MendTech IDs to prevent duplicates.

## Sync engine requirements

- OAuth authorization-code flow with offline refresh token
- Encrypted token storage
- Webhooks for incoming changes
- Background outgoing queue
- Retry with exponential backoff
- Idempotency keys
- Scheduled reconciliation
- Conflict-resolution screen
- Complete sync logs
- Read-only initial test before write access

## Suggested first test

1. Import one employee.
2. Import five products/services.
3. Import one CRM customer.
4. Read one approved quote.
5. Create one test Project and tasks.
6. Update one task from MendTech OS.
7. Confirm the change in Zoho.
8. Upload one photo to WorkDrive.
