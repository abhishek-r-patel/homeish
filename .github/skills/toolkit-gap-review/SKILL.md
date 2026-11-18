---
name: toolkit-gap-review
description: "Enrich this society-management app with functionality from the Glex society toolkit — find new features, enhancements and conflicts, let me accept/reject each, then update the app plan"
disable-model-invocation: true
---
# Enrich my app from the society-management toolkit

## Goal
My society-management app (this workspace) is already built. A ready-made toolkit of 300 society-management tools describes a lot of functionality. I want to **reuse that functionality to make my app richer and more correct**.

Your job:
1. Work out what the toolkit offers that my app does not have, or does only partly.
2. Find where the toolkit **conflicts** with how my app already works.
3. Give me a **decision summary** I can accept or reject item by item.
4. After I decide, **update my app's plan** so it records every decision: accepted items become planned work, and rejected or deferred items are recorded with their status and reason.

Do **not** write application code, schema or migrations in this session unless I ask separately.

## Where the toolkit is
Folder (read-only; do not modify anything in it):
`C:\Users\Abhishek.Patel\Apps\Local-Dev\Cooperative & Housing Society Management Toolkit`

- **`TOOLKIT_GUIDE.md`**: start here. It covers:
  - what each of the 25 modules does
  - how the modules feed each other
  - a suggested data model (ER diagram)
  - a one-line purpose for every tool
- **`TOOLKIT_TOOL_REFERENCE.md`**: detail for each tool. It covers:
  - the fields, and whether the user types them in or the tool works them out
  - dropdown values, business rules and dashboard figures

  It is about 580 KB, so read only the part you need. Module sections start at `<a id="ref-mN">` and tool sections at `<a id="tN">`; module N holds tools 12N-11 to 12N. Search for the anchor, then read that range.
- **The original Excel, PDF and Word files** sit in the module folders. Open one only when the two documents don't answer a question, and say when you did.

**What to know about the toolkit:**
- **Module 5 (Committee) is missing.** Do not guess its contents.
- **Modules 12 and 20 come in two versions.** Treat each pair as one capability and mention any useful differences between the versions.
- **Its numbers are only examples.** Rates, interest methods, notice periods, quorum rules, fees and deadlines are indicative, and the sample data is fictitious. If my app differs, that is a question for me, not proof my app is wrong. Mark legal or statutory points "verify against the state co-operative act / our bye-laws".
- **Reuse rights.** I have bought the reuse rights (royalty) and have the seller's full permission, so ignore the standard licence notice in the toolkit folder. You may reuse the toolkit's features, fields, dropdown values, formulas, business rules, dashboard figures, report layouts and wording directly. Quote the exact formula or rule from the toolkit where it helps, so the plan is precise.

## Step 1: Understand my app
1. Read `AGENTS.md` and the documents it points to: requirements, plan or roadmap, architecture and data model.
2. Find **the plan document** that Step 5 will update, and tell me which file it is. If there is more than one candidate, ask me.
3. List what the app does today:
   - modules and screens
   - main data (entities and their key fields)
   - calculations and rules
   - roles and permissions
   - reports and dashboards
   - notifications
   - imports and exports
4. For each feature, say whether it is **built, tested, or only planned**. Back this with file paths.
5. If the plan has a "toolkit review decisions" section from an earlier run of this review, read it. Do not raise rejected or deferred items again unless something has changed; say so if it has.
6. Run `git status`. Leave any uncommitted work untouched.

## Step 2: Agree the scope (one short question form)
Ask me about:
- **Society type:** housing only, or also the credit co-operative (Module 21) and dairy co-operative (Module 22) tools. Default: housing only.
- **Modules:** which to cover this run. Default: those closest to what the app already has. Suggest an order, starting with core flows (setup, units, members, billing, dues, accounts).
- **Depth:**
  - *feature level*: what the app can do
  - *detail level*: also fields, statuses and rules for features the app already has

## Step 3: Compare, module by module
For each toolkit tool in scope, compare it with the app and sort the finding into one of these:

- **NEW**: useful functionality my app lacks entirely.
- **ENHANCEMENT**: my app has it partly. Examples: missing fields, statuses, alerts, ageing, reports, dashboard figures, history or audit trail.
- **CONFLICT**: my app already does it, but differently. Examples: a calculation, rule, workflow, status set, approval step or meaning of data. Explain exactly what the app does now versus the toolkit, and what changing it would affect: existing data, users, screens or reports.
- **Already covered / Not relevant / App-only**: count these and list them briefly; they need no decision.

**Rules:**
- **Search before claiming a gap.** Before saying the app lacks something, search the code and docs using the toolkit's words and synonyms (for example "arrears", "outstanding", "dues", "overdue").
- **Merge repeats.** The same capability often appears in several tools. Make it one item and list all the tool numbers.
- **Check the links between modules.** Treat how the toolkit's modules feed each other (units → members → billing → dues → accounts → reports) as requirements, and flag where the app breaks such a chain.
- **Say how sure you are** (High / Medium / Low) when the evidence is thin.

## Step 4: Decision summary (save it, then ask me)
Save the summary to the session workspace, or where I tell you. Then show me a short version in chat.

**Top of the summary:**
- counts by type and by module
- the 10 most valuable items
- every conflict that touches money, legal compliance or member rights

**Then one card per item, grouped by module:**

```
GAP-M08-03 · ENHANCEMENT · Value H · Effort M · Confidence High
What: <one line>
Why it helps: <one line>
Toolkit source: Tool 98 (TOOLKIT_TOOL_REFERENCE.md#t98)
App today: <what exists, with file path — or "nothing found (searched: …)">
Change needed: <data / logic / screens / reports, in plain words — include the toolkit's exact fields, values or formula where relevant>
Depends on: <other IDs or existing features>
Risks / verify: <data migration, permissions, privacy, legal check, impact on existing users>
For conflicts — Options: A) keep app behaviour  B) adopt toolkit approach  C) <other>  → Recommended: <X, one-line reason>
Decision: [ ] Accept  [ ] Reject  [ ] Defer
```

**Then ask me to decide:**
- Use a question form, one module at a time, with Accept, Reject or Defer for each item and nothing pre-selected.
- For conflicts, also ask which option I choose.
- If no form is available, ask me to reply with the IDs, e.g. "accept GAP-M08-03, M08-05; reject M09-02; defer the rest".
- If the review is large, finish and decide one module at a time instead of skimming everything. Tell me which modules are still left.

## Step 5: Update the app plan
After I decide, update the plan document from Step 1 for **every item I decided**, not only the accepted ones:

1. Add the **accepted items** as planned work:
   - Follow its existing format, numbering and ID conventions.
   - Order the items so dependencies come first.
   - For each item, include a short description, the changes it needs (data, logic, screens, reports), acceptance criteria and the toolkit tool numbers it came from.
2. For **accepted conflicts**, write the chosen option as a change to existing behaviour. Note any data migration, impact on existing users, and anything to verify against the bye-laws or the law.
3. Record **rejected items** in the plan as "Not doing", with the date and my one-line reason. For a **rejected conflict**, note that the app's current behaviour is confirmed as intended, so nobody "fixes" it later.
4. Record **deferred items** in the plan as "Deferred / backlog", with the date, the reason and what would need to happen before it is reconsidered (a trigger or target phase).
5. Put a **toolkit review decisions** section in the plan document itself, in the plan's own format. It lists every decided ID with Accept, Reject or Defer, the chosen option for conflicts, the date, the reason and, for accepted items, a link to the plan entry it became. The plan must stay the single place to see what was decided; do not keep decisions only in a separate file. The next run reads this section to skip settled items.
6. Items I have not decided yet stay out of the plan. List them at the end of the chat reply as "still open".
7. Show me the plan edits before you save them. After saving, re-read the changed sections to check they are complete.
8. Do not create new plan files if an existing document fits. Do not change code, schema, migrations or tests. Do not commit or push.

## Ground rules
- Do not invent features that are in neither the toolkit nor my app's documents.
- Never put secrets, real member data or the toolkit's sample names into the summary or the plan.
- Use plain everyday language. Add a one-line explanation for any technical term you can't avoid.
- Say what you read and what you could not check.
