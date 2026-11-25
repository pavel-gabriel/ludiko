# Ludiko — Content & IP Policy

> **Mandatory** for everyone who adds content, assets or dependencies, human or AI agent.
> Goal: Ludiko never depends on content it does not own or is not licensed to use, so that
> free use **and future paid plans** stay safe.
> This is an internal policy, not legal advice. Before launching any paid plan, a Romanian IP
> lawyer must review it (see §9).

---

## 1. Legal background (summary)

- **Law 8/1996** on copyright and related rights (republished 2018, amended by Law 69/2022).
  - **Art. 9** excludes *official texts* of a political, legislative, administrative or judicial nature, and their official translations, from protection. This covers laws, ministerial orders and the like. It does **not** cover authored educational material: textbooks, workbooks, exam papers, teacher-made items. ⚠️ Exact wording not yet verified against legislatie.just.ro.
  - **Art. 33** allows some free uses (quotation, illustration for teaching). Courts read these exceptions **narrowly**, and they are not a safe basis for a commercial product. ⚠️ Verify the exact letters.
  - Law 69/2022 transposed the EU DSM Directive (2019/790), including its education exception. It is generally understood as non-commercial teaching use.
- **Conclusion we act on:** exceptions are not a business model. Everything Ludiko ships must be **ours**, **openly licensed for commercial use**, **public domain**, or **official text**.
- **Attribution is required but not sufficient.** Naming the author is a licence condition and respects moral rights, but it does **not** make unlicensed use legal.

## 2. What we may use

| Material | Allowed? | Conditions |
|---|---|---|
| Our own items, explanations, SVGs, audio, code | ✅ | `licence: OWN` |
| Procedurally generated items (math generators) | ✅ | `source: generated`, `licence: OWN` |
| AI-drafted text/items | ✅ | `source: ai-draft`, `licence: OWN`; must be edited/approved by a human before leaving `beta` (see §5) |
| Official texts: laws, ministerial orders, **structure** of the programa (competence codes, list of contents) | ✅ | `source: official-text`, `licence: RO-OFFICIAL-TEXT`; descriptions written in our own words |
| Public-domain works (author died > 70 years ago, or explicitly PD/CC0) | ✅ | `basis` must say why (e.g. "author died 1889") |
| Open-licence media/text: **CC0, CC BY, CC BY-SA** | ✅ | Author, title, URL, retrieval date, licence; note if modified; CC BY-SA derivatives stay CC BY-SA |
| Fonts under **OFL-1.1** | ✅ | Listed in credits |
| Code libraries: **MIT, BSD, ISC, Apache-2.0** | ✅ | Listed in credits |

## 3. What we must NOT use

| Material | Why |
|---|---|
| ❌ Textbook pages, exercises, texts, illustrations (any publisher) | Protected authored works |
| ❌ Workbooks, auxiliary books, online worksheets (Wordwall, Didactic.ro, Digitaliada, LIVRESQ…) | Protected; platform terms |
| ❌ National-exam or simulation items copied verbatim or near-verbatim | Authored works; exception unsafe for a product |
| ❌ Anything licensed **NC** (non-commercial) or **ND** (no derivatives) | Blocks paid plans / adapting content |
| ❌ Images found via search engines without a clear licence | Unknown rights |
| ❌ Characters, logos, brands, mascots of others | Copyright + trademark |
| ❌ Copyleft code (GPL/AGPL) in the shipped bundle | Licence obligations on the whole app |
| ❌ Song lyrics, recordings, voices of others | Copyright + neighbouring rights |

## 4. Exam papers and textbooks: format reference only

We may study EN II/IV/VI/VIII papers and textbooks to learn **which competence** is tested and **in what format**. We then write **original** items:

- ✅ Same competence, same item type (e.g. "word problem with two operations, grade IV").
- ✅ Same difficulty level and timing conventions.
- ❌ Not the same text, story, characters, numbers, images, tables or sequence of questions.
- ❌ No "lightly reworded" copies. If a reviewer can match an item to a source item, rewrite it.

Facts and ideas (2 + 3 = 5, Bucharest is the capital, the Danube flows into the Black Sea) are not protected. A specific expression of them is.

## 5. AI-generated content

- AI drafts are `source: ai-draft`, `licence: OWN`, `reviewStatus: beta`.
- Prompts must never ask for text "from textbook X" or "from the EN 2025 paper". Prompts must ask for **original** content for a named competence.
- Romanian copyright needs human creative contribution, so a human edits and approves before an item becomes `reviewed`.
- Spot-check drafts for verbatim matches with known sources (well-known textbook stories, exam items).

## 6. Provenance: required on every asset and content record

Every third-party asset is listed in [`content/credits.json`](../content/credits.json). Every future content record (skill, item, explanation, media) carries a `provenance` object. Schema: [`content/schema/provenance.schema.json`](../content/schema/provenance.schema.json).

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | Unique |
| `kind` | ✅ | `image`, `audio`, `font`, `text`, `item`, `explanation`, `library`, `data` |
| `title` | ✅ | Work title |
| `author` | ✅ | Person/organisation; `Ludiko` for own work |
| `source` | ✅ | `own`, `generated`, `ai-draft`, `official-text`, `public-domain`, `open-licence` |
| `licence` | ✅ | One of the allowlist in §2 (SPDX-style id) |
| `url` | for third-party | Where it was obtained |
| `retrieved` | for third-party | `YYYY-MM-DD` |
| `modified` | optional | `true` if we changed it (required to state for CC BY/BY-SA) |
| `basis` | for public domain | Why it is PD |

**Enforced automatically:** `tests/contentPolicy.test.ts` validates `content/credits.json` and every `provenance` object under `content/`, and rejects unknown licences, NC/ND licences, and missing fields. The deploy workflow runs the tests, so a violation blocks deployment.

## 7. Attribution

- The in-app **Credits** page (`/credits`) is generated from `content/credits.json`: title, author, licence and link for every third-party asset.
- Where a licence requires it (CC BY / BY-SA), attribution also appears next to the asset (e.g. a small caption under an image).
- Format: *"Title" — Author, licence (link), modified by Ludiko* (when modified).

## 8. User-generated content (teachers' custom questions)

- Teachers can write custom questions today. The UI reminds them to write their own and not copy textbooks or tests.
- Before public sharing of teacher content is added (it is not planned in v2 Phase 1), we need terms of use in which the teacher warrants they own the rights, plus a report and takedown flow.
- Teacher content stays private to the teacher's sessions.

## 9. Takedown and review

- **Report:** every item will have a "Raportează o greșeală" (report a mistake) button (Plan Phase 0) that also accepts rights complaints. Rights complaints hide the item immediately until resolved.
- **Contact:** a public contact address for rights holders, to be set by the owner (**TODO**), shown on the Credits page.
- **Audit:** review `content/credits.json` and run a spot-check for copied content before each phase release.
- **Before any paid plan:**
  1. A Romanian IP lawyer reviews this policy and the content inventory.
  2. Verify Law 8/1996 art. 9, art. 33 and the Law 69/2022 changes against the official text.
  3. For content we want but don't own (reading texts, illustrations): commission it under a contract that **assigns** rights to Ludiko, or license it (publishers; collective management organisations such as UCMR-ADA; ORDA for guidance).

## 10. Checklist for every PR that adds content or dependencies

- [ ] No textbook, workbook or exam text/images copied or closely paraphrased
- [ ] Every new third-party asset is in `content/credits.json` with a licence from the allowlist
- [ ] No NC/ND licences; no GPL code in the bundle
- [ ] AI drafts marked `ai-draft` + `beta`
- [ ] `npm test` passes (the content policy test)
