# Security Specification - Equiparação Hospitalar

## Data Invariants
1. A lead must contain all required contact information (name, clinic, email, whatsapp).
2. Financial values must be positive numbers.
3. `createdAt` must be exactly the server timestamp.
4. Public users can ONLY create leads. They cannot read, list, update, or delete.

## The "Dirty Dozen" Payloads (Anti-Patterns)
1. **The Ghost Field**: Creating a lead with an extra `isVerified: true` field.
2. **Identity Spoofing**: Attempting to read a lead without being an admin.
3. **Resource Poisoning**: Sending a 1MB string in the `clinicName` field.
4. **Temporal Fraud**: Setting `createdAt` to a date in the past.
5. **Type Mismatch**: Sending `revenue` as a string instead of a number.
6. **Mass Update**: Attempting to list all leads as a public user.
7. **Negative Finance**: Setting `revenue` to a negative value.
8. **Shadow List**: Attempting to query leads using a wildcard.
9. **Update Gap**: Attempting to modify a lead's email after it was saved.
10. **ID Poisoning**: Using a 2KB string as a document ID for a lead.
11. **Admin Escalation**: Attempting to create a document in an `/admins` collection.
12. **PII Leak**: Attempting to 'get' a specific lead ID by guessing.

## Firestore Rules Test Runner
(I will implement `firestore.rules` first to meet the goal, then I can add tests if needed, but the instructions say to output this file first).
Since I am a high-level assistant, I will proceed to generate the rules.
