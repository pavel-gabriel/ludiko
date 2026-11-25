# Ludiko — Market & Evidence Research

> Compiled November 2026 to support the v2 direction in [`PLAN.md`](./PLAN.md).
> Many sources are vendor or comparison blogs; market claims are directional.
> Figures marked ⚠️ should be re-checked against the primary source before external use.

---

## 1. The problem in Romania

| Signal | Data | Source |
|---|---|---|
| Functional illiteracy | PISA 2022: **33.2%** of Romanian 15-year-olds below level 2 in all three areas vs 16.4% OECD average | [Romania Insider](https://www.romania-insider.com/society/romania-2022-pisa-assessment-eu), [OECD country note](https://www.oecd.org/en/publications/pisa-2022-results-volume-i-and-ii-country-notes_ed6fbcc5-en/romania_cfe329e8-en.html) |
| Reading getting worse | PISA 2025: reading −16 points vs 2022; math/science flat | [OECD PISA 2025 Romania](https://www.oecd.org/en/publications/pisa-2025-results-volume-i-country-notes_2d4ff9ea-en/romania_2b6e8684-en.html), [Spotmedia](https://spotmedia.ro/en/news/education/functional-illiteracy-reaches-around-50-in-romania-more-than-half-of-students-lack-basic-maths-skills-what-pisa-2025-results-show) |
| Rural–urban gap | EN VIII 2026 math: **42.5%** of rural students below 5 vs 15.5% urban. EN VIII 2025: rural below-5 rate 3× urban | [Edupedu 2026](https://www.edupedu.ro/evaluarea-nationala-2026-adanceste-decalajul-dintre-rural-si-urban-peste-o-treime-dintre-elevii-de-la-sate-nu-au-obtinut-media-5-la-matematica-43-au-luat-note-sub-5/amp/), [Edupedu 2025](https://www.edupedu.ro/procentul-elevilor-cu-medii-sub-5-la-evaluare-nationala-2025-de-trei-ori-mai-mare-in-rural-decat-in-urban-cea-mai-mica-pondere-a-elevilor-cu-medii-sub-5-din-ultimii-13-ani-la-nivel-national-conf/) |
| Private tutoring fills the gap | **48%** of surveyed parents pay for meditații, ~**1,000 lei/month**, now reaching primary school; total family education spend ×3 since 2018 | [Salvați Copiii 2025](https://www.salvaticopiii.ro/sites/ro/files/2025-03/cat-dau-parintii-pe-meditatii-costurile-ascunse-ale-educatiei-studiu-national.pdf), [Edupedu](https://www.edupedu.ro/costurile-educatiei-gratuite-cu-meditatii-after-school-si-materiale-didactice-au-crescut-de-trei-ori-in-ultimii-7-ani-pana-la-o-medie-de-10-000-de-lei-anual-spun-parintii-partic/) |
| Gaps surface late | National evaluations exist at II, IV, VI, VIII, but there is no individual, continuous diagnosis in between; a teacher with ~28 pupils cannot track every gap | [edu.ro — EN II/IV/VI](https://edu.ro/node/1289) |

**Conclusion:** gaps start in primary school and pile up until grade VIII, unnoticed. Families who can pay buy tutoring. Families who can't, mostly rural, fall behind.

---

## 2. Competitive landscape

### International
| Product | What it is | Gap vs Ludiko's goal |
|---|---|---|
| Khan Academy Kids | Free, ad-free, ages 2–8, broad content | English-first, caps ~age 8, not personalised diagnosis, not RO curriculum |
| Prodigy | Math RPG, K-8, premium cosmetics | US curriculum, paid extras, math only |
| Matific | Math games 4–12, available in Romanian | Paid, translated rather than built on the RO programa, math only |
| Blooket / Gimkit / Kahoot / Wayground | Quiz shells with many game modes, power-ups | Teachers must bring content; missed questions don't resurface; no diagnosis |
| DreamBox, Zearn, IXL, SplashLearn | Structured adaptive practice | English/US, paid |

Sources: [Outschool](https://outschool.com/articles/best-educational-apps-for-kids), [Cuemath](https://cuemath.com/blog/best-math-apps-for-kids), [Kidslox](https://kidslox.com/guide-to/math-apps-for-kids/), [Prodigy vs Blooket](https://prodigygame.com/main-en/blog/educational-games-vs-blooket), [Jotform Blooket vs Gimkit](https://jotform.com/blog/blooket-vs-gimkit), [Wayground rebrand](https://thejournal.com/Articles/2025/06/24/Quizizz-Rebrands-as-Wayground-Announces-New-AI-Features.aspx)

### Romania
| Product | What it is | Gap vs Ludiko's goal |
|---|---|---|
| Digitaliada (Orange Foundation) | Free, 10,000+ teacher-made lessons and tests for grades V–VIII, EN practice | A library rather than a tutor: no diagnosis, not a game, no primary-school content |
| LIVRESQ | Teacher authoring tool, 42,600+ teachers | For teachers, not a child-facing tutor |
| manuale.edu.ro | Official digital textbooks (PDF) | Static |
| Kinderpedia | School management + parent communication | Not a learning product |
| MatematiX (academic) | Research game app for primary math | Prototype |

Sources: [Edupedu — Digitaliada](https://www.edupedu.ro/teste-de-antrenament-pentru-evaluarea-nationala-2026-in-platforma-digitaliada-elevii-de-clasa-a-viii-a-au-acces-la-pregatire-conform-programei-oficiale-pentru-examen-baremelor-de-notare-si-evaluare/amp/), [Edupedu — LIVRESQ](https://www.edupedu.ro/peste-1-500-de-surse-de-lectii-digitale-pe-care-profesorii-le-pot-adapta-pentru-elevii-lor-lansate-gratuit-pe-platforma-livresq-aplicatia-livtome-propune-cadrelor-didactice-300-de-fise-editabile-pe/), [Romania Insider — Kinderpedia](https://www.romania-insider.com/kinderpedia-funding-growth-february-2026), [MatematiX paper](https://www.scitepress.org/Papers/2024/126211/126211.pdf), [Matific](https://apps.apple.com/si/app/matific-maths/id1440019986)

### Where Ludiko fits
| | Digitaliada | Matific | Kahoot/Wordwall | **Ludiko** |
|---|---|---|---|---|
| Grades 0–IV | ❌ | ✅ | depends on the teacher | ✅ |
| Diagnoses individual gaps | ❌ | partly | ❌ | ✅ **core** |
| Game-based | ❌ | ✅ | ✅ | ✅ |
| Free | ✅ | ❌ | partly | ✅ |
| RO programa + competence codes | ✅ | translated | ❌ | ✅ |
| Explains progress to parents | ❌ | ❌ | ❌ | ✅ |
| Offline / low-end phones | ❌ | partial | ❌ | ✅ |

**What we deliberately do NOT build:** quiz editors (Wordwall/Kahoot do it), test libraries (Digitaliada), textbooks (manuale.edu.ro).

---

## 3. Learning-science evidence

| Finding | Implication for Ludiko | Source |
|---|---|---|
| Retrieval practice ≈ +0.5 SD, but **ineffective without feedback** when the child fails | Every wrong answer gets an explanation | [Nature Rev. Psych.](https://www.nature.com/articles/s44159-022-00089-1) |
| Spaced practice ≈ 0.74 effect size | Daily mission includes spaced review | same |
| Interleaving: mixed evidence | Use it in reviews, don't build around it | [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10950551), [Rohrer 2019](https://Www.Gwern.net/doc/psychology/spaced-repetition/2019-rohrer.pdf) |
| "Brain training" barely transfers to school skills | No "train your brain" claims; logic puzzles framed as puzzles | [Children EF meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC7726355), [Melby-Lervåg](https://pubmed.ncbi.nlm.nih.gov/22612437/), [Kassai 2019](https://Www.Gwern.net/doc/dual-n-back/2019-kassai.pdf) |
| Words + pictures beat words alone; extraneous decoration hurts (coherence principle) | One clear picture per idea, short frames, no clutter | [Mayer — Multimedia Learning](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/30ABD6E79E538FDA038EC264C5F870A6/9781108841580c1_3-16.pdf/introduction-to-multimedia-learning.pdf), [TU Delft](https://tudelft.nl/teaching-support/didactics/develop/multimedia-foundations-combining-text-and-images) |
| Streaks work through loss aversion; can distress young kids | Gentle streaks that never reset painfully | [Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit), [Screenwise](https://screenwiseapp.com/guides/duolingo-khan-academy-and-the-streak-obsession) |

---

## 4. Curriculum context

- Primary (0–IV) is graded with **calificative** (FB/B/S/I); gimnaziu (V–VIII) uses marks 1–10.
- National evaluations at II, IV, VI, VIII.
- Primary MEM programa is tied to OMEN 3418/2013 ⚠️; gimnaziu plan-cadru in force is OMENCS 3590/2016 ⚠️ ([Matepolis](https://matepolis.ro/plan-cadru-gimnaziu/), [Edupedu — preparatory curriculum](https://www.edupedu.ro/curriculum-programa-orar-clasa-pregatitoare/)).
- **Curriculum in flux:** official proposal to merge Physics/Chemistry/Biology into "Științe" for V–VII ([Edupedu](https://www.edupedu.ro/comasarea-disciplinelor-fizica-chimie-si-biologie-intr-o-singura-materie-numita-stiinte-pentru-elevii-claselor-a-v-a-a-vii-a-propusa-oficial-in-noul-curriculum-de-ministerul-edu/amp/)); new optional subjects in 2026–2027 ([Adevărul](https://adevarul.ro/stiri-interne/educatie/anul-scolar-2026-2027-discipline-optionale-noi-2544095.html)). **Content must be tagged by competence + programa version, so it can be remapped instead of rewritten.**

---

## 5. Legal & privacy

- GDPR-K: parental consent for a child's data where consent is the legal basis; national age threshold 13–16. COPPA 2025 amendments (compliance April 2026) require separate consent for third-party sharing. ([PRIVO](https://www.privo.com/blog/2026-readiness), [Foley Hoag](https://foleyhoag.com/news-and-insights/blogs/security-privacy-and-the-law/2026/july/the-amended-children-s-online-privacy-protection-act-(coppa)-regulations-what-your-business-needs/), [Epic](https://www.epicgames.com/help/c-202300000001627/c-202300000001697/a202300000011411?lang=en-US))
- Ludiko stance: no ads, no third-party trackers, no child email, data minimisation, local-first.
- Official texts (programa, EN papers) are likely outside copyright under Law 8/1996 art. 9 ⚠️ — verify before republishing items verbatim.
