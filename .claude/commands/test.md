---
description: Run backend tests and report results. Use BEFORE delivering any backend code changes.
---

# Pre-delivery Test Runner

Run all backend tests to validate code changes before delivering to the user.

## Steps

1. Run `cd backend && npx vitest run` and capture output
2. If ANY test fails:
   - Show the failing test name and error
   - Diagnose the root cause by reading the relevant source file
   - Fix the issue
   - Re-run tests until ALL pass
3. If all tests pass:
   - Report: "✅ {N} tests passed"
   - Run `npx tsc --noEmit` to verify TypeScript compilation
4. If tsc fails, fix type errors and re-run both

## Important

- NEVER deliver code to the user without running this first
- If a test catches a bug, fix it before reporting success
- The test suite mocks the database — no real DB connection needed
