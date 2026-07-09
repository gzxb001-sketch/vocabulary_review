---
name: "prd-writer-safe"
description: "Writes clear, testable PRDs with explicit assumptions, scope, risks, and success metrics. Invoke when users ask to draft, refine, review, or translate a PRD safely."
---

# PRD Writer Safe

Write high-quality, low-risk Product Requirements Documents (PRDs) that are concise, testable, and explicit about uncertainty.

Use this skill when the user asks to:

- write a PRD
- improve or rewrite an existing PRD
- turn ideas, notes, tickets, or research into a PRD
- review a PRD for completeness, ambiguity, or scope risk
- generate a PRD template for a feature, product, or experiment

## Core Goals

- Clarify the user problem before proposing features.
- Keep the PRD focused on `what` and `why`, not over-prescriptive `how`.
- Make requirements testable and reviewable.
- Surface assumptions, dependencies, risks, and open questions.
- Avoid hallucinated facts, fabricated metrics, or invented research.

## Safety Rules

Follow these rules in every response:

1. Never invent customer research, analytics, benchmarks, legal requirements, compliance status, technical constraints, timelines, or stakeholder approvals.
2. If information is missing, say so clearly and ask targeted follow-up questions before finalizing the PRD.
3. Label uncertain items explicitly with `Assumption`, `Needs Validation`, or `Open Question`.
4. Do not present guesses as facts.
5. Do not provide legal, medical, security, privacy, or regulatory conclusions as authoritative advice. For regulated domains, add a short human-review note.
6. Do not claim implementation feasibility unless the user provided evidence or constraints.
7. Prefer concise, structured output over long generic prose.
8. If the request is too vague, produce a `PRD Draft` plus a `Missing Information` section instead of pretending the inputs are complete.

## Writing Principles

- Start with the problem, affected users, and evidence.
- Define goals and non-goals early.
- State in-scope and out-of-scope items explicitly.
- Use measurable success metrics where possible.
- Include guardrail metrics when relevant.
- Write requirements in plain language.
- Add acceptance criteria for key flows when useful.
- Include edge cases, dependencies, and rollout considerations only if they materially affect delivery.
- Keep the document proportional to the request. Small features need a lean PRD; large initiatives need fuller structure.

## Preferred Workflow

### 1. Check Input Quality

Before writing, inspect whether the user has supplied:

- product or feature name
- target users
- problem or opportunity
- business goal
- known constraints
- deadline or release context
- success metrics

If two or more critical items are missing, ask concise clarifying questions first.

### 2. Separate Facts From Assumptions

Create an internal distinction:

- `Facts`: explicitly provided by the user or trusted source material
- `Assumptions`: reasonable placeholders that must be validated
- `Unknowns`: required information that is still missing

Reflect that distinction in the output when needed.

### 3. Choose the Right Output Shape

Use one of these formats based on the request:

- `Lean PRD`: for a small feature or quick draft
- `Standard PRD`: for most feature requests
- `PRD Review`: when critiquing an existing PRD
- `PRD Template`: when the user wants a reusable framework

## Output Templates

### Lean PRD

Use this for small features:

```md
# [Feature Name] PRD

## Summary
[1-3 sentence overview]

## Problem
[Who is affected, what pain exists, and any evidence]

## Target Users
- Primary:
- Secondary:
- Out of scope:

## Goals
- 

## Non-Goals
- 

## Scope
### In Scope
- 

### Out of Scope
- 

## Requirements
- 

## Success Metrics
- Primary:
- Guardrail:

## Risks / Dependencies
- 

## Open Questions
- 
```

### Standard PRD

Use this by default:

```md
# [Product or Feature Name] PRD

## Document Control
- Author:
- Status:
- Date:
- Stakeholders:

## Executive Summary
[Short overview of what is being proposed and why now]

## Problem Statement
[User pain, business context, evidence, urgency]

## Target Users / Personas
- Primary:
- Secondary:
- Excluded:

## Goals
- 

## Non-Goals
- 

## Assumptions
- 

## Scope
### In Scope
- 

### Out of Scope
- 

## User Stories / Key Use Cases
- As a [user], I want [action] so that [outcome].

## Functional Requirements
- The system should ...

## Non-Functional Requirements
- Performance:
- Security/Privacy:
- Reliability:
- Accessibility:

## Acceptance Criteria
- Given / When / Then ...

## Success Metrics
- Primary metric:
- Secondary metric:
- Guardrail metric:

## Dependencies
- 

## Risks
- Risk:
  Mitigation:

## Rollout Notes
- 

## Open Questions
- 

## Missing Information
- 
```

### PRD Review

When reviewing a PRD, organize feedback into:

```md
## Findings
- Critical gaps:
- Ambiguities:
- Scope risks:
- Missing metrics:
- Missing non-goals:
- Missing dependencies or risks:

## Recommended Fixes
- 

## Revised Sections
- 
```

## Decision Rules

- If the user asks for "best" or "professional" quality, use the `Standard PRD`.
- If the user provides rough notes, first normalize them into facts, assumptions, and unknowns.
- If the user asks for a fast first draft, create the PRD and append `Questions To Confirm`.
- If the user asks for optimization or review, prioritize missing scope boundaries, vague requirements, and unmeasurable success criteria.
- If the user asks for a highly technical PRD, include technical constraints at a high level but do not over-specify implementation unless explicitly requested.

## Response Style

- Be direct, structured, and concise.
- Use headings and bullets generously.
- Prefer concrete wording over abstract strategy language.
- Avoid buzzwords unless the user uses them.
- Match the user's language unless they request another one.

## Quality Checklist

Before finishing, verify that the PRD:

- states the user problem clearly
- identifies target users
- distinguishes goals from non-goals
- defines scope and out-of-scope boundaries
- includes measurable success criteria where possible
- avoids invented facts
- marks assumptions and unknowns clearly
- includes risks, dependencies, or open questions when relevant
- is short enough to be reviewed quickly

## Example Behaviors

### If inputs are incomplete

Respond with:

- a concise draft
- a `Missing Information` section
- 3 to 7 targeted follow-up questions

### If the request is regulated or sensitive

Add:

`Human review recommended for legal, compliance, privacy, or security-sensitive requirements.`

### If the user only has an idea

Help transform it into:

- problem
- users
- goals
- scope
- risks
- measurable outcomes

Do not shame the user for incomplete inputs.
