# content/

Learning content and third-party asset records for Ludiko (see `docs/PLAN.md` §5).

**Before adding anything here, read [`docs/LEGAL_CONTENT_POLICY.md`](../docs/LEGAL_CONTENT_POLICY.md).**

- `credits.json` — every third-party asset/library shipped in the app (shown on `/credits`).
- `schema/provenance.schema.json` — required `provenance` shape for assets and content records.
- Any object with a `provenance` key in any `.json` file under `content/` is validated by
  `tests/contentPolicy.test.ts` (runs in CI before deploy).

## Layout (docs/PLAN.md section 5)

```
content/
  credits.json                      third-party assets (shown on /credits)
  schema/                           JSON Schemas: provenance, skill, item (11 types), explanation
  skills/<subject>/*.json           arrays of Skill      (e.g. skills/mat/grade1.json)
  items/<subject>/*.json            arrays of static Item (authored banks; math mostly uses generators)
  explanations/<subject>/*.json     arrays of Explanation (2-6 frames each)
  data/<subject>/*.json             curated own word/sentence lists read by generators (e.g. data/rom/words.json:
                                    child words + hyphenation + emoji); each file carries a `provenance` object
```

- Types: `src/engine/types.ts`. Validators: `src/engine/content/validate.ts`
  (`validateSkill`, `validateItem`, `validateExplanation`, `validateSkillGraph`).
- Loader: `src/engine/content/registry.ts` bundles every JSON file under `skills/`, `items/`,
  `explanations/` at build time (`getSkill`, `getSkillsBySubject`, `getItemsForSkill`, `getExplanation`).
- `tests/contentValidation.test.ts` validates every file, the skill graph (existence, no cycles,
  no prerequisite from a later grade/semester) and cross references (item.skillId, skill.explanations).
- Skill ids: `<subject>.<topic>...` (e.g. `mat.sub.borrow.100`); the prefix must equal `subject`.
- Every record carries `provenance` (unique id across all content). Seed skills: `source: own`;
  AI-drafted items/explanations: `source: ai-draft`, `reviewStatus: beta`.
- Seed competence codes (MEM-2013) are plausible placeholders: verify against the official programa.
