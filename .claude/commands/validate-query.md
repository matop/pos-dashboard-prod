---
description: Validate PostgreSQL parameterized queries in backend routes for common pg/node-postgres pitfalls.
---

# PostgreSQL Query Validator

Scan backend route files for common node-postgres query issues that cause runtime errors.

## What to check

Read all files in `backend/src/routes/*.ts` and validate each `pool.query(sql, params)` call:

### 1. Orphan Parameters
Every `params[i]` pushed to the array MUST be referenced as `$N` in the SQL string. PostgreSQL rejects unreferenced parameters with: "no se pudo determinar el tipo del parámetro $N".

- Trace every `params.push(...)` call and verify the corresponding `$N` appears in the SQL
- Watch for CONDITIONAL pushes (e.g., `if (condition) { params.push(x) }`) where the SQL reference is also conditional

### 2. Array Parameters with Type Cast
`= ANY($N::bigint[])` or `= ANY($N::int[])` with pg array params is FRAGILE.
- **Prefer:** `IN ($a, $b, $c)` with individual params (node-postgres FAQ recommended pattern)
- **Flag** any `ANY($N::type[])` usage as a warning

### 3. Parameter Index Alignment
When building SQL dynamically with `$${params.length}`:
- Verify the index matches the actual position in the params array (1-based in SQL, 0-based in JS)
- Check that optional conditions (ubicod, products) don't shift subsequent indices

### 4. SQL Injection Vectors
- Flag any string interpolation of user input into SQL (should ONLY use $N placeholders)
- `extraWhere` and similar dynamic SQL builders should only use parameterized values

## Output Format
For each file, report:
- ✅ File clean — no issues
- ⚠️ Warning — potential issue (with line number and description)
- ❌ Error — definite bug (with line number and fix suggestion)

## Context (node-postgres FAQ)
```javascript
// SAFE — flat params with IN:
client.query("SELECT * FROM t WHERE id IN ($1, $2, $3)", [1, 2, 3])

// RISKY — array param with ANY + cast:
client.query("SELECT * FROM t WHERE id = ANY($1::int[])", [[1, 2, 3]])
```
