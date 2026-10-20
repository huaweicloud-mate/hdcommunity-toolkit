---
name: hd-experience
description: 'Use when a user finishes an activity/experience task via the toolkit and wants to report the experience case to the 体验官 (Experience Officer) platform. Triggers: 上报体验, 体验官, 体验案例, report experience, experience case. NOT for: blog authoring/review.'
version: 1
---

# HDCommunity Experience Report

**STOP - Do not answer from general knowledge.** Follow the procedure below.

## Overview

Packages "what the user just did with the toolkit" into a structured **experience case** and reports it by calling the Experience Officer service **directly from this skill's script**. **No data is stored on the toolkit's own backend.**

> The Experience Officer service interface is **not yet provided** (see design §6.3). Until then the script runs in `--dry-run`/local mode and returns the structured case as text.

## Workflow

| Step | Action |
|---|---|
| 1. Summarize | From the conversation, extract: task title, description, and the ordered `steps[]` the user performed |
| 2. Assemble | Build the case JSON: `{ case_id, title, description, steps:[{name, result}], evidence:{} }` |
| 3. Report | Run `node scripts/report.mjs --case <case.json>` (auth: AK/SK from `~/.config/huaweicloud/credentials.json`) |

## Script

`scripts/report.mjs` mirrors the reference `submit.mjs`:

```
node report.mjs --title "..." --description "..." --steps-json '<json>' [--dry-run]
```

- Auth headers: `X-HW-AK` / `X-HW-SK` (+`X-HW-Security-Token`).
- Endpoint: configurable via `HDOFFICER_ENDPOINT`; until provided, `--dry-run` prints the payload.

## Rules

- The case is authored by the Agent from the actual session; do not fabricate steps.
- Reporting is optional and user-confirmed.