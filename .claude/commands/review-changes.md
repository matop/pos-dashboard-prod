---
description: Review code changes using all relevant skills — frontend-design for UI, web-design-guidelines for accessibility, vercel-react-best-practices for performance, /validate-query for SQL, /test for tests.
---

# Full Code Review with Skills

Comprehensive review of changes made in this session, invoking the appropriate skills.

## Review Pipeline

### 1. Backend Changes
If any `backend/src/**` files were modified:
- Run `/validate-query` to check SQL parameterization
- Run `/test` to verify all tests pass
- Check for: error handling, logging with Winston (not console.log), parameterized queries

### 2. Frontend Component Changes
If any `frontend/src/components/**` files were modified:
- Invoke `frontend-design` skill to review visual quality and design coherence with the ocean theme
- Check: Tailwind classes use the custom ocean palette, CSS custom properties for theming, responsive design

### 3. Frontend Performance
If any `frontend/src/**` files were modified:
- Invoke `vercel-react-best-practices` skill to check for:
  - Unnecessary re-renders (missing useMemo/useCallback)
  - Bundle size impact (barrel imports, large dependencies)
  - Waterfall patterns in data fetching

### 4. Accessibility & UX
If any UI components or CSS were modified:
- Invoke `web-design-guidelines` skill against the changed files
- Check: focus-visible, aria-labels, touch-action, reduced-motion

### 5. Documentation
- Verify CLAUDE.md is still accurate after changes
- Suggest running `/update-doc` if significant changes were made

## Output
Produce a summary table:

| Area | Skill Used | Status | Issues |
|------|-----------|--------|--------|
| SQL Safety | /validate-query | ✅/⚠️/❌ | ... |
| Tests | /test | ✅/❌ | ... |
| Design | frontend-design | ✅/⚠️ | ... |
| Performance | vercel-react | ✅/⚠️ | ... |
| Accessibility | web-guidelines | ✅/⚠️ | ... |
