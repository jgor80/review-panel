# Output contract (every judge)

Write your review in Markdown with exactly these sections, in this order:

## Summary
Two to four sentences: your overall call and the one thing that matters most.

## Workflows or areas reviewed
A table: name, entry point (file), your score out of 10, one-line reason.

## Findings
Most severe first. Use this format for each, and leave the section as "None" if you have
no findings. Zero findings is a valid result; never pad.

### [Critical|High|Medium|Low] Short title
- Class: Defect | Risk | Preference
- Confidence: High | Medium | Low
- Location: path:lines
- Scenario: who does what, and what goes wrong
- Impact: who is affected and how badly
- Recommendation: the smallest change that fixes it

Severity: Critical = data loss, a security breach, money wrong, or a core feature broken for
most users. High = a real user-facing bug on an important path. Medium = a bug on a minor
path or degraded behaviour. Low = minor issue or preference. A Critical caps your score at
2 and a High caps it at 4.

## Open questions
Questions whose answer would change your call. "None" if there are none.

## What you could not check
Anything a reader might assume you checked but you didn't.

End with these two lines exactly, and nothing after them:

SCORE: <number from 1 to 10, one decimal allowed>
VERDICT: <SHIP | FIX_FIRST | BLOCK>

SHIP = nothing above Low. FIX_FIRST = Medium or High findings worth fixing first.
BLOCK = at least one Critical, or the app does not do its core job.
