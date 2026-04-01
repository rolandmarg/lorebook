# PR Review Lorebook Entry — Design Spec

**Date:** 2026-03-31
**Output:** Single global lorebook entry at `~/.claude/lorebook/code-review.md`
**Approach:** Directive-style entry with context-reading instructions (Approach B)

## Problem

Need a universal PR review philosophy that AI agents (primary: Opus 4.6) can follow when reviewing code across all projects. The review should be triggered by keywords in the user's prompt and injected via lorebook, not via a multi-agent orchestration system.

## Design Decisions

- **Single agent, no subagent orchestration** — the reviewer is the user's main Opus 4.6 session
- **Lorebook-triggered** — fires on keywords: review, pr, pull request, go over, code review, check my code, look over, audit
- **Priority 5** — injected early so review guidance comes before most other context
- **Universal** — works across all projects; repo-specific context comes from project docs
- **~1800 chars** — fits within the 4000 char lorebook cap with room for other entries
- **All dimensions equal weight** — no tier system, everything gets flagged
- **Own the whole codebase** — pre-existing issues are fair game, not just the diff

## Context-Gathering

Before reviewing, the agent reads these project files if they exist:
- `CLAUDE.md` — repo conventions, commit policy, design decisions
- `PHILOSOPHY.md` — project values and principles
- `CRITERIA.md` — acceptance criteria and standards
- `AGENTS.md` — agent-specific rules

Every finding must be grounded in these docs or existing codebase patterns — not abstract best practices.

## Review Dimensions (all equal weight)

1. **Repo alignment** — does the change respect the project's documented philosophy, conventions, and acceptance criteria?
2. **Clean design & simplicity** — minimal abstraction, YAGNI, no over-engineering, no speculative features
3. **Minimal diff** — does only what it claims, no scope creep, no drive-by refactors
4. **Codebase consistency** — matches existing patterns, naming, style, architecture decisions
5. **Security & vulnerabilities** — injection, auth, secret handling, OWASP concerns
6. **Bugs, logic gaps & correctness** — edge cases, missing error handling, race conditions, incorrect assumptions

## Review Process

1. Read the diff and the files it touches — verify by reading code, not trusting descriptions
2. Compare against plan/spec/issue if one exists
3. Check for missing pieces, extra unneeded work, and misunderstandings
4. Flag everything — no issue is too minor if it violates a dimension

## Reporting Format

For each issue: what's wrong, where (file:line), which dimension, how to fix.
End with a verdict: ready to merge, needs changes, or do not merge.

## False Positive Filters

Only skip:
- Issues a linter or typechecker would catch
- Pedantic nitpicks a senior engineer wouldn't flag

Everything else is fair game — including pre-existing issues and lines the PR didn't modify.

## Lorebook Entry

The full entry text lives at `~/.claude/lorebook/code-review.md` with:
- `keys: [review, pr, pull request, go over, code review, check my code, look over, audit]`
- `priority: 5`
- No `exclude_keys`

## Sources

Useful patterns drawn from:
- `obra/superpowers` agents/code-reviewer.md — review dimensions, issue categorization
- `requesting-code-review/code-reviewer.md` — review checklist structure
- `receiving-code-review/SKILL.md` — YAGNI checks, pushback guidance
- `code-review` command — false positive filters
- `spec-reviewer-prompt.md` — skepticism principle (verify by reading code)
