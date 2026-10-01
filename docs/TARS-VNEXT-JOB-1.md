# Tars vNext Job 1 — implementation report

Validated on 2026-10-01 in `focus-timer`, `main`, base `fbac02d`. The initial tree was clean. No commit, push or deployment was performed.

## Files changed

- Build configuration: root `package.json` / `package-lock.json` (build-only Ajv and `atlas:pyq` command), `tools/atlas-build/package.json`, `vite.config.ts` (lazy PYQ caching), `CODEX_HANDOFF.md`.
- Pipeline: `tools/atlas-build/canonical-pyq.mjs`; `lib/canonical-package.mjs`, `lib/atlas-mentions.mjs`, `lib/atlas-relevance.mjs`; `content/pyq/canonical-mappings.mjs`.
- Runtime contracts/components: `src/atlas/pyq/types.ts`, `loaders.ts`, `QuestionBody.tsx`, `quality.mjs`, `quality.d.mts`, `render.mjs`, `render.d.mts`, `blocks.css`.
- Tests/QA: `src/atlas/pyq/loaders.test.ts`, `tools/atlas-build/test/canonical-pyq.test.mjs`, `test/fixtures/canonical-structures.mjs`, `tools/perf/canonical-pyq-audit.mjs`.
- Derived outputs: 100 JSON files in `public/pyq-atlas/v1/` (manifest, place index, 49 question packs, 49 answer packs); seven audit/report files in `tools/atlas-build/reports/`. This report is `docs/TARS-VNEXT-JOB-1.md`.

All original Atlas place data, coordinates, sources, IDs and ledger remain unchanged. No generated files were hand-patched.

## Architecture

The immutable external ZIP is integrity-verified before loading. Only its active index is traversed. The coverage pass scans every active record independently of quiz gates. The quiz pass applies canonical runtime eligibility, deterministic premium renderability and precision-first geographic demand rules, in that order. No repair, source archive fallback or inferred answer is allowed.

The typed runtime reads a manifest, lazy question/answer packs and a separate per-place index. Complete PYQs never enter `places.json`. The shared semantic block tree powers the developer preview and `AtlasPyqBody`; no application screen was redesigned or connected to the new data. Question IDs and representations remain exactly canonical. Exam codes stay exact; display family totals are separate. CDS remains enrichment and does not affect existing priority scores.

Identity records contain release/package/manifest hashes, pipeline version and code hash, Atlas version/source/artifact hashes and mapping hash, with no timestamp. Two consecutive builds produce identical runtime packs, reports and preview bytes.

## Exact import counts

| Stage | Questions |
| --- | ---: |
| Active canonical corpus | 6,982 |
| Runtime eligible under the strict Job 1 policy | 6,792 |
| Premium renderable after runtime eligibility | 6,184 |
| Atlas relevant and included | 149 |
| CSE | 72 |
| PCS | 30 |
| CDS | 47 |

Included types: 84 MCQ, 44 statements, 8 pairs, 4 sequences, 3 assertion–reason, 3 matching, 2 tables, 1 propositions. The exact year distribution is in `canonical-pyq-import.json`.

The package's 6,815 immediately-scoreable count is broader than this job's runtime gate: 23 records with unresolved content issues are additionally rejected. The full release contains 56 active papers; 49 have questions in this strict Atlas subset.

## Exact exclusions

Sequential totals: **190 runtime + 608 premium + 6,035 relevance = 6,833 excluded**. Every excluded active ID has a machine-readable reason in `tools/atlas-build/reports/canonical-pyq-import.json`. Reasons can overlap within a stage; the following counts are not additive across reasons.

Runtime reasons:

| Reason | Records |
| --- | ---: |
| Not QUIZ_USABLE | 164 |
| Not immediately scoreable | 167 |
| Requires local correction | 167 |
| OPTION_BOUNDARY_UNCLEAR | 34 |
| TABLE_STRUCTURE_UNCLEAR | 77 |
| EMPTY_STATEMENT | 54 |
| SOURCE_UNCLEAR | 48 |
| DUPLICATE_OPTION_TEXT | 5 |
| TEXTUAL_INTEGRITY | 2 |
| Answer status not final | 3 |
| Answer not scoreable | 3 |
| ANSWER_UNAVAILABLE issue | 3 |
| Invalid final answer | 3 |

Premium reasons among runtime-eligible records:

| Reason | Records |
| --- | ---: |
| Malformed code reference | 240 |
| Instruction embedded in an item | 161 |
| Inconsistent sequence inventory | 79 |
| Orphaned quote | 46 |
| Broken lines/options | 38 |
| Raw formatting/extraction token | 36 |
| Incomplete matching code | 30 |
| Broken assertion–reason structure | 20 |
| Invalid mapping labels | 4 |
| Incomplete matching labels | 4 |
| Missing text | 2 |
| Truncated stem | 2 |
| Visual dependency | 2 |
| Incomplete demand | 1 |
| Suspect extraction token | 1 |
| Duplicate option text | 1 |
| Orphaned/duplicate label | 1 |
| Extraction artefact | 1 |

Relevance reasons after both earlier gates: **4,942** no resolved gazetteer place; **729** place mention only; **355** non-geographic demand; **9** no meaningful mapping beyond distractors. These sum to 6,035.

## Geographic coverage and candidates

The broad scan records **9,920 mention occurrences**: **3,091 resolved occurrences covering 893 existing place IDs**, plus **6,829 unresolved/review occurrences**.

| Review class | Occurrences |
| --- | ---: |
| Existing country/state polygon entity, lacking a gazetteer place ID | 5,347 |
| Ambiguous identity | 453 |
| Lower-case/case-context review | 288 |
| Polygon versus named-feature collision | 488 |
| Unresolved feature/name | 253 |

The unresolved-feature occurrences group into **213 unconfirmed candidate names**, preserving exact spelling variants and canonical question IDs. Examples include Abyssinian Plateau, Askot Wildlife Sanctuary, Badkhal Lake, Baglihar Hydel Project and Amaravati Stupa. They are review leads, not approved additions; some lexical candidates are source artefacts or may duplicate a differently named existing entity. Full records are in `unresolved-geography.json`.

**Zero places were added; zero coordinates were inferred.** New coordinates must be sourced and identities reviewed through the existing gazetteer candidate/build pipeline. Another **43,175 residual proper-name occurrences** are retained as potential-name review items, not claimed geographic inventory. Dictionary scanning cannot certify exhaustive recognition of every possible geographic referent.

Coverage relation roles: 8,948 incidental, 197 primary, 339 supporting, 325 distractor and 111 comparison. Coverage relations can belong to excluded questions. Only admitted resolved primary stem mentions have advisory mastery eligibility; incorrect options and table/pair alignment never grant it.

## Validation and audit

- Canonical integrity: all **324** manifest-listed files verified; full 6,982-record schema/identity/provenance/CPYQ joins passed. The source ZIP remains unchanged: SHA-256 `a86e3b62e749500158cb5406cabfd4aef58e395cf6b6ed90932afbb1ec058d71`.
- `npm run typecheck`: passed.
- Root tests: **92/92**, 12 files, passed.
- Atlas-build tests: **42/42**, zero skipped with the external package, passed. Every supported block has a fixture; malformed/visual/non-geographic cases and incorrect-option mastery are tested.
- Production `npm run build`: passed. Existing Vite `advancedChunks` deprecation warning remains.
- Production smoke: all 12 checks passed, including timer run/pause, Atlas selection/pan/pinch, service-worker registration and offline reload; no page errors.
- Legacy `node build.mjs --places-only`: passed, 783 old ledger entries / 1,044 matched places / 0 unmatched / 0 ambiguous / 0 invalid. Its live-source overlay refresh was reverted to preserve the shipped maps; it added no Job 1 places.
- Consecutive builds: runtime artifacts, all reports and HTML preview byte-identical; curation also invariant to source traversal order.
- Developer preview audit: all **149** questions checked at **375px and 1280px**; four options each, no page overflow or escaped table overflow. Stratified screenshots cover all three exams, old/recent years, MCQ, statements, matching, ordinary tables, pairs, sequences, assertion–reason and multiple places. The same component tree/CSS also renders every fixture.
- Self-review checked source isolation, immutable identities, generated-data separation, ID collision behavior, source-exclusion leakage and priority/mastery ownership. No `/review` command/tool is available in this session; human semantic review of the published audit remains useful.

## Remaining risks and Job 2 assumptions

Coverage remains a review workflow: known polygons, ambiguous references and new candidates need identity/coordinate review. Conservative gates intentionally exclude some clean questions. External ZIP integration tests explicitly skip when the package is absent in CI; provide `CANONICAL_PYQ_PACKAGE` for full release verification. Unvisited lazy packs are not available offline until loaded. No native-device or new quiz-screen audit is claimed because Job 1 adds no learner UI.

Job 2 may use the 149-question manifest, stable canonical IDs, exact supplied question structures, separately verified final answer alternatives, typed lazy loaders, shared semantic block renderer and place relations/family counts. It must keep CDS secondary, distinguish primary/supporting/comparison/distractor roles and preserve existing learner semantics. It may not assume review candidates have been resolved or treat a place reference, question view or incorrect option as mastery evidence.
