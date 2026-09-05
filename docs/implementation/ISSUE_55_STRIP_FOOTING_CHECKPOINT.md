# Issue #55 — Strip / Wall Footing module checkpoint

Status: implemented on `staging`; authenticated browser acceptance pending.

This checkpoint covers the first Issue #55 slice only. Pad / Column Footing and Slab on Grade full module parity remain open under Issue #55. Additional derived-3D expansion remains intentionally deferred until this Strip / Wall Footing slice is browser-accepted.

## Implemented Strip / Wall Footing v2 contract

A new immutable published Strip / Wall Footing archetype version extends the accepted Condition foundation without mutating v1 history.

Module capacity:

- Concrete — rectangular/trapezoid profile, mix/spec metadata, placement and top-surface inputs;
- Forms — formed sides, end-form role, system, form-material factor and stake pattern;
- Reinforcing — repeatable Continuous / Transverse / Dowel / Stirrup / Custom sets with explicit bar size/count/spacing/length/layers/faces/cover/stock/lap/allowance inputs;
- Anchors / embeds — repeatable measured-role, spacing-driven or fixed-count sets;
- Excavation / backfill — explicit trench width method, working room, depth, side slope, swell, export and backfill assumptions;
- Placement / equipment — explicit method, CY/hour and setup/cleanup time;
- Finish / cure / protection — explicit optional top-surface scope;
- Miscellaneous — repeatable estimator-entered count items;
- Labor — explicit production-rate inputs driving server-authoritative MH outputs.

No structural reinforcing design, production rate, excavation assumption, pricing, or waste allowance is inferred by the engine. Reinforcing presets select only a calculation pattern; structural values remain visibly estimator-entered.

## Runtime / persistence

- repeatable module instances now persist through the existing atomic Condition commit path;
- module inputs and provenance flow to the server calculator;
- v1 Conditions retain their original fixed contract;
- new Strip / Wall Footing Conditions use the v2 template/compatibility projection;
- 2D measurement roles remain quantity authority;
- all 23 governed outputs preserve compatibility mapping into the current estimate runtime;
- missing required values hold only dependent outputs;
- platform/company published versions remain immutable.

## Validation

GitHub Actions run 966 on `8591bee075f463956990e1a485a2c7d95762ea84` passed:

- TypeScript typecheck;
- full domain tests including `strip-footing-v2.test.ts`;
- full Next.js production build.

The additive migration `20260905155500_strip_footing_edge_modules_v2.sql` is applied to the isolated QA Supabase project. QA confirms Strip / Wall Footing archetype v1 remains published and v2 is separately published with 9 governed module families and 23 outputs.

## Browser acceptance still required

Do not mark this Strip / Wall Footing slice accepted until the stable staging browser verifies at minimum:

1. create a new Strip / Wall Footing Condition;
2. enter width/depth and draw/assign the primary LF run;
3. add multiple reinforcing sets with different patterns;
4. enable Forms and verify side/end/material/stake controls;
5. enable Excavation / backfill and verify its scoped inputs;
6. enable Anchors / embeds, Placement / equipment, Finish / cure / protection and Miscellaneous;
7. save/recalculate and inspect outputs/holds;
8. confirm no structural or production assumptions are silently inserted;
9. confirm existing v1 Condition history remains readable;
10. confirm 3D/Split stays gated for Strip v2 until this checkpoint is accepted.
