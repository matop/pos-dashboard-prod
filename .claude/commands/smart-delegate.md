---
description: Token optimizer — routes subtasks to the cheapest model that can handle them. Use before starting any multi-step task to plan delegation. Haiku for reads/writes/search, Sonnet for planning/research/design, Opus for complex code and debugging.
---

# Smart Delegate — Token Optimizer

Route every subtask to the cheapest model capable of handling it correctly.

## Routing Table

| Task type | Model | When to use |
|-----------|-------|-------------|
| File reads, keyword searches, glob patterns, directory listing | **haiku** | Gathering raw info with no analysis |
| Simple file edits, boilerplate writes, renaming, formatting | **haiku** | Mechanical changes with clear spec |
| Codebase exploration — "how does X work?" | **haiku** | Use Explore subagent type with model:haiku |
| Planning, architecture decisions, trade-off analysis | **sonnet** | Need structured thinking, not heavy code |
| Research — library docs, best practices, debugging hypotheses | **sonnet** | Use general-purpose subagent |
| UI/design review, accessibility audit | **sonnet** | Frontend skills invocation |
| Complex bug diagnosis — reading stack traces + code together | **sonnet** | Root cause analysis |
| Writing non-trivial backend logic, refactoring multi-file code | **opus** | High correctness requirement |
| Debugging subtle issues — race conditions, query bugs, type errors | **opus** | Need deep reasoning over code |
| Security review, SQL validation, auth logic | **opus** | Zero-tolerance for errors |

## How to Apply This Skill

When invoked (`/smart-delegate`), analyze the current pending task and produce a delegation plan:

1. **Break the task** into atomic subtasks (read, analyze, write, verify).
2. **Assign a model** to each subtask using the routing table above.
3. **List the plan** to the user before starting:

```
Subtask 1: Read 3 route files to understand current SQL patterns → haiku
Subtask 2: Design the new endpoint + validate query safety → sonnet
Subtask 3: Write the implementation + tests → opus
Subtask 4: Run /test and /validate-query → haiku (tool invocation)
```

4. **Execute in order**, spawning Task agents with the assigned model parameter.
   - Reading agents: `subagent_type: "Explore"`, `model: "haiku"`
   - Planning agents: `subagent_type: "Plan"`, `model: "sonnet"`
   - Implementation agents: `subagent_type: "general-purpose"`, `model: "opus"`

## Parallel Execution Rules

- All **read-only haiku tasks** that don't depend on each other → launch in parallel.
- Planning (sonnet) → wait for reads to complete first.
- Implementation (opus) → wait for plan to be confirmed by user.

## Cost Guardrails

- Never use opus for tasks that are purely informational (reading, searching).
- Never use haiku for tasks where a wrong output would require an opus fix anyway.
- If unsure between sonnet and opus: use sonnet first; escalate to opus only if the output is wrong or incomplete.
- Batch multiple small reads into a single haiku agent instead of launching one per file.

## Example Usage

User asks: "Add a new `/api/charts/daily-summary` endpoint"

```
Plan:
1. [haiku/Explore]  Read existing route files (salesHistory, topProducts) to understand patterns
2. [haiku/Explore]  Read db.ts and middleware to understand pool + validate usage
3. [sonnet/Plan]    Design endpoint: params, SQL shape, response type, validate rules
4. [sonnet]         Run /validate-query mentally against planned SQL
5. [opus]           Write the route file + tests
6. [haiku]          Run /test to confirm passing
```
