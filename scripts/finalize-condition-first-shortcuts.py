from pathlib import Path

workspace_path = Path('components/takeoff/TakeoffDrawingWorkspace.tsx')
workspace = workspace_path.read_text()
before = "if(event.key.toLowerCase()==='d'&&!locked&&selectedGeometry){event.preventDefault();void duplicateSelected();}"
after = "if(event.key.toLowerCase()==='d'&&!conditionAuthoringActive&&!locked&&selectedGeometry){event.preventDefault();void duplicateSelected();}"
if workspace.count(before) != 1:
    raise RuntimeError(f'duplicate shortcut guard: expected one match, found {workspace.count(before)}')
workspace_path.write_text(workspace.replace(before, after, 1))

test_path = Path('tests/condition-first-cutover.test.ts')
test_source = test_path.read_text()
needle = "  assert.match(workspace, /if\\(conditionAuthoringActive\\)\\{openConditions\\(\\);return;\\}/);\n"
replacement = needle + "  assert.match(workspace, /if\\(event\\.key\\.toLowerCase\\(\\)===\'d\'&&!conditionAuthoringActive/);\n"
if test_source.count(needle) != 1:
    raise RuntimeError(f'cutover test anchor: expected one match, found {test_source.count(needle)}')
test_path.write_text(test_source.replace(needle, replacement, 1))

print('Guarded legacy duplicate keyboard shortcut in Condition-first mode.')
