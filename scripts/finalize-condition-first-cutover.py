from pathlib import Path

path = Path('components/takeoff/TakeoffDrawingWorkspace.tsx')
source = path.read_text()

replacements = [
    (
        "if(event.key==='Escape'){setDraftPoints([]);setDraftScaleRegionId(null);setCalibrationPoints([]);setScaleRegionPoints([]);setPendingScaleCandidate(null);setPendingManualCalibration(null);setEditGeometry(null);editOriginalRef.current=null;setHoverPoint(null);setTool('select');return;}",
        "if(event.key==='Escape'){cancelTool();return;}",
        'Escape must clear hidden Condition compatibility selection',
    ),
    (
        "<button type=\"button\" className={styles.secondary} disabled={busy} onClick={()=>void duplicateSelected()}><Copy size={14}/> Duplicate</button>",
        "{!conditionAuthoringActive&&<button type=\"button\" className={styles.secondary} disabled={busy} onClick={()=>void duplicateSelected()}><Copy size={14}/> Duplicate</button>}",
        'Condition-first mode must not duplicate legacy measurements outside Condition lineage',
    ),
]

for before, after, label in replacements:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    source = source.replace(before, after, 1)

path.write_text(source)
print('Finalized Condition-first geometry lifecycle guards.')
