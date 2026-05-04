# Security Spec: PropAgent AI

## Data Invariants
1. A **Property** must have a title, price, and address. Prices must be positive.
2. A **Lead** must have a name, email, and valid status. `createdAt` and `lastActive` must be server timestamps.
3. A **Message** must belong to a **Lead**. It must have a sender ("user" or "agent") and a text body.
4. A **Viewing** must reference a valid **Lead** and **Property**.
5. A **Reminder** must reference a valid **Lead**.
6. Only **Admins** can manage properties, viewings, reminders, and see all leads.
7. Anyone can browse properties.
8. Anyone can create a lead, send a message to their own lead, or schedule a viewing (creating a viewing record).

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempting to create a property as a non-admin.
2. **Resource Poisoning**: Creating a lead with a 1MB string for the name.
3. **State Shortcutting**: Updating a viewing status from 'pending' to 'confirmed' as a non-admin.
4. **Identity Integrity Breach**: Creating a lead and setting the `ownerId` (if we had one) to someone else.
5. **PII Leak**: A non-admin trying to list all leads.
6. **Shadow Update**: Updating a lead with an extra field `isVerified: true`.
7. **Type Poisoning**: Sending a boolean for the property price.
8. **Orphaned Writes**: Creating a viewing for a property ID that doesn't exist.
9. **Terminal State Bypass**: Updating a 'closed' lead to 'new'.
10. **Timestamp Fraud**: Providing a client-side timestamp for `createdAt` instead of `request.time`.
11. **Malicious ID**: Creating a property with a document ID containing path injection characters.
12. **Denial of Wallet**: A non-admin trying to perform a deep list query that skips rule-side owner checks.

## Test Runner (Draft)
A comprehensive test suite will be implemented in `firestore.rules.test.ts` after the rules are drafted.
