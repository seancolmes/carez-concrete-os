> **Document status:** SUPERSEDED — HISTORICAL REFERENCE  
> **Canonical owner:** `docs/modules/estimating.md`, `docs/ARCHITECTURE.md`  
> **Use:** Historical record of the existing assembly/AST runtime and authoring contract. Do not use as the active product model.  
> **Supersession:** Superseded for new product/domain work by `docs/concrete-condition-3d-workstation-target.md` and ADR-012. Existing immutable versions, deterministic AST behavior, RLS, and referenced lineage remain compatibility requirements during migration.

# Carez Custom Assembly Authoring Foundation

## Purpose

Carez assemblies are user-authored concrete recipes, not a fixed Carez catalog. The existing `concrete_assemblies` / immutable `concrete_assembly_versions` model remains the commercial and production lineage boundary. This foundation extends it with folders, reusable properties, deterministic property bindings, nested published child assemblies, and a runtime that flattens child outputs into the selected parent takeoff object.

The rule remains:

`Takeoff -> Published Assembly Version -> Deterministic Outputs -> Estimate Items -> Proposal -> Frozen Budget`

A published version is immutable. Edits happen in a draft revision and publication creates the exact recipe future takeoff objects can select.

## Authoring model

```text
Assembly Library
└─ Folder
   └─ Assembly identity
      ├─ Draft / Published Versions
      ├─ Properties
      ├─ Property Bindings
      ├─ Direct Outputs
      │  ├─ Material
      │  ├─ Labor
      │  ├─ Equipment
      │  ├─ Subcontractor
      │  └─ Other
      └─ Child Assembly Versions
```

The assembly identity owns organization metadata. Each version snapshots the code, name, category, description, and primary measurement basis used by that immutable version.

## Property namespaces

Formula variables remain an explicit JSON AST. JavaScript `eval`, SQL expression strings, and arbitrary executable formulas are not allowed.

Canonical names available to formulas and property bindings are:

- `Takeoff.Quantity`
- `Takeoff.Length`
- `Takeoff.Area`
- `Takeoff.Count`
- `Takeoff.Volume`
- `Takeoff.Perimeter`
- `Properties.<variable_key>`
- `Project.<key>`
- `Parent.<key>`
- `PlanFact.<property_key>`

Legacy unprefixed property keys and `quantity` remain available so existing published assemblies continue to calculate identically.

### Resolution order

Each property can have zero or more bindings. Higher `precedence` values win among available bindings.

For a normal overridable property:

1. Explicit takeoff input
2. Highest-precedence available binding
3. Published default
4. Optional numeric fallback `0`

For `allow_override = false`, a resolved binding wins over explicit input. If no binding resolves, an explicit input may still preserve a previously resolved historical value.

Required values that cannot be resolved become `missing_input` holds. They do not silently become zero-priced valid estimate lines.

## Binding sources

`concrete_assembly_property_bindings.source_namespace` supports:

- `takeoff` — physical measurement context
- `project` — project-level context supplied by the server
- `parent` — resolved properties of the parent assembly node
- `plan_fact` — confirmed/approved Plan Intelligence facts supplied by the server
- `property` — another property in the same assembly version

Property-to-property cycles are rejected by the runtime. Publish-time validation also requires `property` bindings to name a property in the same version.

Plan Intelligence does not write raw AI output directly into an assembly. The future review/application workflow supplies confirmed effective facts as `PlanFact.*` context or explicitly applies them to a takeoff property, preserving human authority.

## Nested assemblies

`concrete_assembly_children` links an immutable parent version to an immutable child version.

Each edge has:

- `child_key` — stable path segment
- `label`
- `quantity_formula` — determines the child's primary measured quantity from the parent formula context
- `variable_bindings` — numeric formulas that map parent context into named child properties

A parent can contain direct outputs, child assemblies, or both.

A child link can only be published when the child version is already published. Database cycle guards prevent recursive assembly graphs.

### Output lineage

At runtime the assembly tree is flattened to component paths:

```text
root direct component        -> concrete
child component              -> reinforcing/rebar
repeated child branch        -> north_wall/rebar
nested child component       -> wall/reinforcing/rebar
```

`/` is reserved as the path delimiter and is not allowed inside `component_key` or `child_key`.

The selected root assembly version remains on the takeoff measurement and generated estimate item. Each takeoff output also stores the exact immutable child component ID that produced it. The component path makes repeated use of the same child version unambiguous.

The commit/update RPCs recompute the expected flattened component set server-side and reject missing, duplicate, or foreign component paths before persistence.

## Draft and publication rules

- At most one draft exists per assembly identity.
- `carez_create_custom_assembly(...)` creates the assembly identity and version 1 draft atomically.
- `carez_create_assembly_revision(version_id)` clones a published/retired version into the next draft, including properties, outputs, child links, and property bindings.
- `carez_publish_assembly_version(version_id)` publishes only a draft.
- Publish requires at least one direct output or child assembly.
- Child versions must already be published.
- Component, labor, child-quantity, and child-property formulas must pass the supported deterministic AST validator.
- Published variables, components, property bindings, and child links cannot be inserted, updated, moved, or deleted. A new version is required.

## Security

All assembly tables are tenant-scoped with RLS. Data API policies are explicitly `TO authenticated` and require a non-employee office profile in the same company.

Anonymous roles have no assembly-table privileges. Authenticated roles receive only `SELECT`, `INSERT`, `UPDATE`, and `DELETE`; broad default `TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges were removed.

Composite company/version foreign keys prevent IDs from another tenant being attached to a local assembly graph even if application code is wrong.

## Runtime behavior

`prepareAssemblyOutputs()` now:

1. Loads the selected published root version using its version snapshots.
2. Resolves properties and provenance.
3. Calculates direct component quantities and labor deterministically.
4. Recursively evaluates child quantity/property bindings.
5. Emits stable component-path outputs.
6. Preserves missing-input holds.
7. Resolves labor and material pricing using the existing provenance chain.
8. Sends the complete flattened set to the atomic Takeoff RPC.

The database independently validates that the submitted paths equal the immutable published assembly graph before creating or updating Takeoff outputs and linked estimate items.

## UI contract

The visual assembly builder can be implemented independently by the UI/Figma workstream against these domain contracts. It should expose, without changing the domain rules:

- Folder tree
- Assembly identity and draft/published versions
- Property editor and groups
- Property binding/source editor
- Output rows
- Child assembly picker with quantity/property mappings
- Formula builder using the supported JSON AST
- Publish validation/errors
- Read-only published-version inspection

Do not add a second client-side formula engine with different behavior. Preview calculations should use the same deterministic formula/property-resolution helpers or a server preview endpoint.
