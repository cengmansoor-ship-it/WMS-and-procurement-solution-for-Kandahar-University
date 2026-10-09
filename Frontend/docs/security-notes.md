# Security Notes

This document contains important security information about the Kandahar University Warehouse Management System.

## 1. Firebase Rules (Firestore)

- **Important:** the rules currently active in the system are for **testing only**. Before the system goes into production, the rules in the `firestore.rules` file must be applied.
- The Firebase rules must not allow regular users access to other users' data.
- **Editing is forbidden:** Audit Logs and Stock Transactions must never be edited or deleted.

## 2. Role-Based Access Control (RBAC)

- The system works on roles (Super Admin, Admin, Director, etc.).
- Each role can only access its related pages.
- If a user types a restricted page URL directly, the system must deny access.

## 3. Deletion & Recovery (Soft Delete)

- Nothing is permanently deleted in this system.
- When a record is deleted, it is only marked as "deleted" so that stock history is not broken.
- Super Admin can restore deleted records from the Trash.

## 4. Backup Retention

- Only Super Admin can create a full system backup.
- A downloaded backup file contains sensitive information and must be stored on a secure hard disk or flash drive.

## 5. User Activation

- Newly registered users cannot log in until they are activated (Active) by the Super Admin.

## 6. Important Recommendations

- Never share the `.env.local` file that contains sensitive keys.
- Always log out when leaving the computer.
- Do not save passwords on public computers.

---

**Kandahar University — Warehouse Management System**
**Security Management Section**