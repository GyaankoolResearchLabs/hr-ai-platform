# Employee and HR Portal Compatibility Matrix

| Area | Shared source of truth | HR surface | Employee surface | Current behavior |
| --- | --- | --- | --- | --- |
| Profile | `employees` | Employee Management | `GET /api/employees/me`, Employee Dashboard | HR edits update the same employee record the employee dashboard reads. User-to-employee mapping prefers `employees.user_id`, then organization-scoped email fallback. |
| HR requests | `hr_requests` | Employee Request Tracker | Employee Self-Service, Employee Dashboard | Employee-created requests now write to `hr_requests`, so HR sees them in the existing tracker. |
| Payroll | `payroll_runs`, `payroll_run_items` | Payroll Run Engine | `GET /api/payroll-runs/me`, Employee Dashboard | Employee payroll reads processed payroll items for the resolved employee. No frontend recalculation. |
| Payslips | `payslips` | Payslip Generator & Portal | `GET /api/payslips/me`, Employee Dashboard | Employee payslip APIs resolve the authenticated employee and return published payslips only. |
| Reimbursements | `expense_claims`, related expense tables | Reimbursement & Expense Manager | `GET /api/expense-claims/me`, `POST /api/expense-claims/me`, Employee Dashboard | Employee claims use the same expense claim service and employee ID is resolved server-side. |
| Attendance | `attendance_records` | Attendance & Leave Tracker | `GET /api/attendance-leave/me/attendance`, Employee Dashboard | Employee attendance reads the resolved employee's shared attendance rows. |
| Leave | `leave_balances`, `leave_requests` | Attendance & Leave Tracker, Leave Exception Analyzer | `GET /api/attendance-leave/me/leave/*`, `POST /api/attendance-leave/me/leave/requests`, Employee Dashboard | Employee leave requests are created in the same `leave_requests` table HR manages. |
| Learning | `learning_courses`, `learning_course_assignments` | Learning tools | Not implemented yet | Existing HR learning tables exist, but employee assignment/progress APIs still need a secure `/me` surface. |
| Documents | document tables | Document tools | Not implemented yet | Employee document visibility still needs a secure `/me` surface and policy. |
| Notifications | Not yet centralized | Not implemented yet | Not implemented yet | A centralized notification table/API is still needed. |
| F&F | F&F settlement tables | Full & Final Settlement Calculator | Not implemented yet | Employee-visible settlement status still needs a restricted `/me` endpoint. |

## Required Database Hardening

Add `employees.user_id` and backfill it for employee accounts. Email fallback exists only to keep current data usable while the stronger mapping is introduced.

```sql
alter table employees
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists employees_organization_user_unique
  on employees (organization_id, user_id)
  where user_id is not null;
```
