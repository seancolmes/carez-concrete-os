# Pourtrace Takeoff workspace

Status: Takeoff-specific layout approved by Nik and implemented locally; method-specific company rate mapping and signed-in visual QA remain open. This does not approve the product-wide Titanium design target.

## Direction

The PDF and persisted page-coordinate geometry own the workspace. A compact **Select Pages** control sits in the measurement toolbar. A short Condition bar above the plan selects an existing Condition or opens its list, creates a Condition, and opens editing. The list retains search, grouping, status, and 3D visibility controls without taking permanent plan width. The measurement inspector appears only on demand. The quantity worksheet remains below the plan on desktop.

```text
Desktop
┌──────────────────── Pourtrace / Preconstruction / Takeoff ────────────────────┐
│ Condition [select] [Condition list] [New condition] [Edit condition]         │
│ [Select Pages ▾] [Select] [Pan] [Scale] [Conditions] [Edit] ... [Zoom]        │
│                                                                              │
│                          PDF PLAN + 2D MEASUREMENTS                          │
│                                                                              │
│ [Page / scale / tool state]                                      [2D Split 3D]│
│ Quantity worksheet: measurement → Condition outputs → holds → estimate       │
└──────────────────────────────────────────────────────────────────────────────┘

Condition editor (opens over the plan, one scroll, fixed Save action)
┌────────────────────── Condition name / version ──────────────── [Close] ┐
│ Dimensions · assembly-specific inputs and elevation                      │
│ Concrete · section and mix                                                │
│ Reinforcement · bars, dowels, anchors, embeds                              │
│ Forms · Yes/No; settings only when Yes                                     │
│ Labor · activity rates / crew productivity                                 │
│ Pour method · delivery/access/equipment                                    │
│ Site, finish, and procurement details only when supported by the family    │
│ Takeoff link · select an existing measurement or draw one                   │
│ Review · holds and calculated outputs                                       │
├──────────────────── status ─────────────────────── [Save draft/calculate] ┤
└───────────────────────────────────────────────────────────────────────────┘
```

On mobile, the top Condition selector and page selector remain visible, the plan gets the viewport, and the Condition window fills the screen. Existing mobile Takeoff remains review-only; controls that write Condition or geometry are disabled. Desktop is the authoring environment under the current Takeoff contract.

## Calculation and workflow rules

- A Condition can be created and its inputs saved before any geometry exists. This is an **unmeasured draft**: it creates no quantity, output, estimate item, or compatibility projection. Once a primary role is linked, the existing atomic calculation path applies. Drawing first remains possible by linking an existing measurement in the same editor.
- Geometry supplies length, area, or count. Family-specific dimensions supply physical section facts: a strip footing needs run length plus width and depth; a slab needs measured net area plus thickness; a pad footing needs counted locations plus length, width, and depth. Missing required inputs create a hold rather than a fabricated volume. Installed volume and procurement allowance remain separate.
- Reinforcement, forms, placement equipment, finish, and other modules use the current versioned Condition contract. Forms explicitly presents the enabled state as Yes/No and hides its properties when No. The former Scope, Drawing, and More tabs are removed from the editor; their governing inputs are placed in Dimensions, procurement, and specific physical categories.
- Labor uses the existing deterministic quantity × factor or quantity ÷ crew production × crew size calculations. The rate input stays blank; focusing a supported factor field reveals a recommended source value. The estimator enters the final rate, including any Condition-specific override. Missing input remains a calculation hold.
- Nik designated the *2026 National Construction Estimator* as the source for company recommendations. Its Concrete section, printed p. 351 (PDF p. 39), lists strip footing placing labor at 0.564 MH/CY direct chute, 0.125 MH/CY trailer pump, and 0.701 MH/CY buggy. These exclude forms, finishing, reinforcing, and separately priced pump equipment. The first implemented focus guide covers strip footing placing factors only. Slab placing factors must not be used in the current combined place-and-finish field.

## Decision record

**Nik explicitly approved:** Pourtrace name and supplied black logo; top global navigation for the broader redesign; silver Titanium Concept B; Ant Design for complex workflow components with a custom Pourtrace shell; Takeoff PDF priority, Select Pages dropdown, on-demand single-scroll Condition editor, the named section sequence, removal of Scope/Drawing/More tabs, and either authoring order; National Estimator recommended rates shown on input focus, with blank fields and estimator-entered values.

**Inferred implementation details:** Keep the desktop worksheet and 2D quantity authority; preserve a closed-by-default Condition list and measurement detail overlay; keep mobile review-only until a separate authoring contract is approved; retain existing UI primitives in this first Takeoff slice because swapping the component library simultaneously would add migration risk to calculation work.

**Open:** Verified mappings for other Condition families and labor activities; signed-in desktop/mobile Takeoff captures; local database migration replay. Logo color and product-wide layout remain pending final visual approval.
