import 'server-only';
import { measureDrawingGeometry, roundMeasurement, type DrawingGeometry } from '../../geometry.ts';
import { prepareDerived3DSources } from './sources.ts';
import type { BuildDerived3DSceneInput } from './contracts.ts';

/** Called only with rows from the authenticated page's company/set-scoped queries. Read-only. */
export function resolveDerived3DSnapshot(companyId: string, takeoffSetId: string, data: any, measurements: any[], sheets: any[], regions: any[]): BuildDerived3DSceneInput {
  const snapshot = prepareDerived3DSources(companyId, takeoffSetId, data, measurements, sheets, regions);
  for (const measurement of snapshot.measurements) {
    const sheet = snapshot.sheets.find(s => s.id === measurement.sheet_id);
    if (!sheet) continue;
    try {
      const measured = measureDrawingGeometry(measurement.geometry as DrawingGeometry, Number(sheet.page_width), Number(sheet.page_height), measurement.calibration);
      if (roundMeasurement(measured.quantity, 4) !== roundMeasurement(Number(measurement.raw_quantity), 4) || measured.unit !== measurement.raw_unit) {
        measurement.sourceIssue = 'Saved quantity and calibrated geometry differ. Review the measurement and recalculate before 3D verification.';
      }
    } catch { /* The shared projection validator reports exact geometry/scale requirements. */ }
  }
  return snapshot;
}
