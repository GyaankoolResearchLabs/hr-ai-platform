# Problem → Solution Matrix

This document is the human-readable counterpart to
`client/src/config/categories.js`, which is the actual source of truth the
app renders from. Every tool on the platform — built or not-yet-built —
must have a row here (or in whatever research doc supersedes this one)
before it's added to the config.

**Status key:** `Planned` (documented, not built) · `In development` ·
`Available` (live for subscribed organizations). Everything below is
currently `Planned` — this app ships the foundation and navigation only;
no tool logic has been built yet.

> This starter matrix was drafted to give the foundation real, specific
> content instead of placeholder Lorem Ipsum. Replace or expand rows as
> your own HR research produces more precise problem statements — the
> config format is designed for that (see the comment at the top of
> `categories.js`).

---

## 1. Administrative HR

### Payroll (core section — not an add-on)

| HR Problem | Tool |
|---|---|
| Manual payroll calculations across spreadsheets cause errors, delays, and rework every cycle. | Payroll Run Engine |
| Statutory deductions (PF, ESI, TDS, and regional equivalents) are tracked manually and easy to miscalculate or file late. | Statutory Deduction Engine |
| Payslip generation and distribution is a manual, month-end scramble with no self-serve access. | Payslip Generator & Portal |
| Reimbursement and expense claims are submitted over email/chat and reconciled by hand against payroll. | Reimbursement & Expense Manager |
| Leadership has no real-time visibility into payroll cost breakdowns by department, location, or role. | Payroll Cost Analytics |
| Full-and-final settlement calculations vary by whoever processes them, creating disputes on exit. | Full & Final Settlement Calculator |

### Employee Records & Documentation

| HR Problem | Tool |
|---|---|
| Employee master data lives across spreadsheets, email threads, and paper files with no single source of truth. | Central Employee Data Hub |
| HR re-drafts the same letters and certificates from scratch every time. | Document & Letter Generator |

### Attendance & Leave

| HR Problem | Tool |
|---|---|
| Attendance and leave balances are tracked manually, leading to disputes and payroll mismatches. | Attendance & Leave Tracker |
| Shift patterns and holiday calendars differ by location with no shared source of truth. | Shift & Holiday Calendar Manager |

---

## 2. Recruitment

### Sourcing & Screening

| HR Problem | Tool |
|---|---|
| Resume screening is slow and inconsistent, with different recruiters applying different bars. | AI Resume Screening Assistant |
| Job descriptions are written inconsistently and take too long to produce per requisition. | Job Description Generator |

### Interview & Selection

| HR Problem | Tool |
|---|---|
| Interview feedback is unstructured, making it hard to compare candidates fairly across panels. | Structured Interview Scorecards |
| Hiring managers have no visibility into pipeline status without asking recruiters directly. | Hiring Pipeline Tracker |

---

## 3. Employee Support

### HR Helpdesk

| HR Problem | Tool |
|---|---|
| HR answers the same policy questions repeatedly instead of pointing to self-serve answers. | AI HR Helpdesk |
| Employee requests submitted over email/chat get lost with no tracking or SLA. | Case & Ticket Management |

### Self-Service

| HR Problem | Tool |
|---|---|
| Employees can't self-serve simple requests like letters, ID changes, or bank detail updates. | Employee Self-Service Portal |

---

## 4. Onboarding

### Pre-boarding

| HR Problem | Tool |
|---|---|
| New-hire paperwork, IT provisioning, and asset requests only start on day one, delaying productivity. | Pre-boarding Checklist & Workflow |

### Day-1 to 90-Day Ramp

| HR Problem | Tool |
|---|---|
| There is no consistent onboarding journey, so the new-hire experience varies by manager and team. | Onboarding Journey Builder |
| Buddy and mentor assignments for new hires are ad hoc or skipped entirely. | Buddy / Mentor Assignment Tool |

---

## 5. Performance

### Goal Setting & Reviews

| HR Problem | Tool |
|---|---|
| Goal setting is inconsistent across teams and rarely revisited once set. | Goal & OKR Tracker |
| Performance review cycles are run manually and take weeks to consolidate. | Review Cycle Manager |

### Feedback

| HR Problem | Tool |
|---|---|
| Feedback only happens during formal review cycles, missing issues and wins in real time. | Continuous Feedback Tool |

---

## 6. Learning & Development

### Content & Delivery

| HR Problem | Tool |
|---|---|
| Turning existing documents and recordings into structured training content is slow and manual. | AI Course Generator |
| Employees don't know which training maps to the skill gaps in their role. | Skill-Gap Based Learning Recommender |

### Tracking & Compliance

| HR Problem | Tool |
|---|---|
| Mandatory training completion is hard to track and report on for audits. | Training Compliance Tracker |

---

## 7. Workforce Planning

### Headcount & Forecasting

| HR Problem | Tool |
|---|---|
| Headcount planning happens in disconnected spreadsheets that go stale as soon as they're shared. | Headcount Planning Tool |
| There is no visibility into attrition-driven hiring needs before they become urgent. | Attrition & Demand Forecasting |

### Org Design

| HR Problem | Tool |
|---|---|
| Org charts go stale the moment they're built and rarely reflect current reporting lines. | Live Org Chart Builder |

---

## 8. Employee Engagement

### Listening

| HR Problem | Tool |
|---|---|
| Engagement surveys run infrequently and results take weeks to analyze, so issues surface too late. | Pulse Survey & Sentiment Tool |

### Recognition

| HR Problem | Tool |
|---|---|
| Peer recognition has no consistent, visible channel and depends entirely on individual managers. | Recognition & Rewards Wall |

---

## 9. HR Analytics

### Workforce Metrics

| HR Problem | Tool |
|---|---|
| Core HR metrics like attrition, headcount, and diversity live in siloed spreadsheets nobody trusts. | Workforce Metrics Dashboard |
| HR can't quickly answer ad hoc workforce questions from leadership without manual data pulls. | Ask-Your-Data HR Query Assistant |

---

## 10. Compensation

### Pay Structuring

| HR Problem | Tool |
|---|---|
| Salary bands and structures are inconsistent across roles and levels, creating pay equity risk. | Pay Band & Structure Builder |
| Benchmarking pay against the market is a manual, spreadsheet-heavy exercise done rarely. | Market Benchmarking Tool |

### Annual Cycles

| HR Problem | Tool |
|---|---|
| Annual compensation review and increment cycles run on spreadsheets and are error-prone at scale. | Comp Review Cycle Manager |

---

## 11. Employee Relations

### Case Management

| HR Problem | Tool |
|---|---|
| Grievances and disciplinary cases lack a documented, consistent process, creating legal exposure. | ER Case Management Tool |

### Investigations

| HR Problem | Tool |
|---|---|
| Investigation timelines and evidence get scattered across emails with no single record. | Investigation Tracker |

---

## 12. HR Compliance

### Policy Management

| HR Problem | Tool |
|---|---|
| Policy versions and employee acknowledgments aren't tracked, making audits painful. | Policy Library & Acknowledgment Tracker |

### Statutory Compliance

| HR Problem | Tool |
|---|---|
| Multi-jurisdiction statutory compliance deadlines are tracked manually and easy to miss. | Compliance Calendar & Alerts |

---

## 13. HR Technology

### Integrations

| HR Problem | Tool |
|---|---|
| HR tools don't talk to each other, causing duplicate data entry across systems. | Integration Hub |

### Data & Access

| HR Problem | Tool |
|---|---|
| There is no central audit trail of who accessed sensitive employee data, or when. | Access & Audit Log Viewer |

---

## 14. Strategic HR

### Planning

| HR Problem | Tool |
|---|---|
| HR strategy isn't linked to measurable business outcomes, making its impact hard to demonstrate. | Strategic HR Roadmap Tool |

### Succession

| HR Problem | Tool |
|---|---|
| Succession planning for key roles is undocumented and only happens reactively after someone leaves. | Succession Planning Tool |

---

## Adding a new tool

1. Confirm the problem is real and specific — not "generic analytics" or
   a feature nobody asked for.
2. Add a row to the relevant category/subcategory section above (or a new
   subcategory if none fits).
3. Add the matching entry to `client/src/config/categories.js` under the
   same category → subcategory. The navigation, dashboard, and category
   detail page all render from that file automatically — no routing or
   layout changes needed.
4. Leave `status: 'planned'` until the tool is actually built.
