# RSCI Final Year Project (FYP) Management Portal
<img width="1600" height="1600" alt="fyp-portal-launch-square" src="https://github.com/user-attachments/assets/c3adf01d-b4c2-4dd6-b41f-7d93d6d5eb69" />


Enterprise-grade, centralized web application for managing the complete Final Year Project lifecycle at the **Riphah School of Computing & Innovation (RSCI)**.

Built in strict compliance with:
- **RSCI FYP Framework v1.0** (10 Project Pathways, AI Usage Policies, 15 Common Obligations, 300-hour / 9h-per-week effort expectations)
- **Software Requirements Specification (SRS) v1.0** (15 Core Functional Modules M1–M15, 9 User Roles, NFRs)
- **Database Design Document v1.0** (Relational Schema with 34 tables, foreign key constraints, and append-only audit trail)
- **REST API Specification v1.0** (Standard envelopes, JWT + rotating refresh tokens, session-scoped RBAC)
- **Test Plan v1.0** (90 Functional Acceptance Test Cases & quality gates)

---

## 🏛️ System Overview

### Core Modules (M1 – M15)
1. **M1 User & Identity Management**: Secure authentication, password controls, soft deactivation, and CSV bulk roster import (`FR-UM-01..05`).
2. **M2 Role-Based Access Control**: 9 specialized user roles (`SUPER_ADMIN`, `FYP_COORDINATOR`, `HOD`, `SUPERVISOR`, `CO_SUPERVISOR`, `STUDENT`, `INTERNAL_EVALUATOR`, `EXTERNAL_EXAMINER`, `INDUSTRY_PARTNER`) with session-scoped permissions.
3. **M3 Academic Session Management**: Offerings (`Fall 2026`), academic calendar windows, and milestone scheduling.
4. **M4 Multi-Domain Project Catalogue**: Complete catalog of the 10 official computing project categories with granular AI policies and eligible degree programs (`CS`, `SE`, `IT`, `AI`, `DS`, `CY`, `CGV`).
5. **M5 Group Formation & Registration**: Student group registration, automatic code generation (`FYP-F26-xxx`), team invitations, and 2–4 student limit validation.
6. **M6 Proposal Workflow**: Formal submission, version freezing, multi-stage approval (`DRAFT` → `UNDER_SUPERVISOR_REVIEW` → `UNDER_COORDINATOR_REVIEW` → `APPROVED` / `RESUBMISSION_REQUIRED` / `REJECTED`).
7. **M7 Supervisor Allocation**: Faculty profiles with expertise tags, capacity tracking against the hard cap (maximum 6 active groups), and auditable reassignments.
8. **M8 Meetings & 300-Hour Logbook**: Scheduling, attendance tracking (`PRESENT`, `ABSENT`, `EXCUSED`), immutable minutes sign-off lock, and student effort tracking rolling up to 300 cumulative hours with a 9-hour weekly pace indicator.
9. **M9 Deliverable Checklists**: Merging 15 common framework obligations with type-specific deliverables.
10. **M10 Document Repository**: Quarantined file ingestion, SHA-256 checksum integrity, version control, and IDOR protection.
11. **M11 AI-Usage Compliance**: 4 normalized AI tiers (`NONE`, `API_ONLY`, `EXTENSIVE`, `LIMITED`), student attestation, automatic policy mismatch detection, and supervisor attestation.
12. **M13 Notifications & Announcements**: Targeted institutional broadcasts and in-app alerts.
13. **M12 Evaluations & Rubrics**: 5 stages (`E1` 10%, `E2` 20%, `E3` 10%, `E4` 30%, `E5` 30%), multi-criterion scoring, normalized mean aggregation, moderation adjustments, and formal grade publication.
14. **M14 Dashboards & Analytics**: Role-tailored consoles, supervisor capacity utilization, at-risk group radar, and CSV roster exports.
15. **M15 Immutable Audit Trail**: Append-only event ledger capturing actor, role, session, timestamp, IP, entity, and before/after values.

---

## 🚀 Running the Application

### 1. Prerequisites
- **Node.js**: v18+ (tested on v25.2.1)
- **npm**: v9+ (tested on v11.6.2)

### 2. Start Backend API Server
```bash
cd backend
npm install
npm run seed
npm run dev
```
*The backend starts at `http://localhost:5000` with standard REST API prefix `/api/v1`.*

### 3. Start Frontend Web Client
```bash
cd frontend
npm install
npm run dev
```
*The frontend starts at `http://localhost:5173`.*

---

## 🔑 Pre-Seeded Institutional Demonstration Accounts

All accounts share the standard demonstration password: `RsciPortal2026!`

| Role | Name | Institutional Email | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Super Admin** | System Administrator | `admin@rsci.edu.pk` | Full platform administration & audit logs |
| **FYP Coordinator** | Dr. Muhammad Asim | `coordinator@rsci.edu.pk` | Session setup, allocations, rubric building, publication |
| **Head of Department** | Prof. Dr. Naveed Akhtar | `hod.cs@rsci.edu.pk` | Cross-program oversight, result ratification |
| **Supervisor** | Dr. Tariq Mahmood | `supervisor@rsci.edu.pk` | Group meetings, minutes sign-off, effort verification |
| **Internal Evaluator** | Dr. Ayesha Malik | `evaluator@rsci.edu.pk` | Stage rubric scoring, oral defense assessment |
| **External Examiner** | Engr. Bilal Khan | `external@industry.com.pk` | Viva defense assessment, industry feedback |
| **Student Leader** | Hamza Ahmed | `student.lead@students.rsci.edu.pk` | Team creation, proposal submission, 300h effort logging |
| **Student Member** | Fatima Noor | `student.member@students.rsci.edu.pk` | Team member, deliverable evidence submission |

> *Note: Each account has dedicated permissions and a role-tailored dashboard. To switch between personas, click **Sign Out** in the top navigation bar and log in with any of the institutional accounts above.*
