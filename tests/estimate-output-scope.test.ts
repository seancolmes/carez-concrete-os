import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'app/estimates/[estimateId]/page.tsx';

test('Estimate workspace scopes Takeoff outputs to the current Estimate measurements before rendering review surfaces', () => {
  const page = readFileSync(pagePath, 'utf8');

  assert.match(page, /const estimateMeasurementIds\s*=\s*new Set\(/);
  assert.match(page, /const estimateOutputs\s*=\s*\(outputs\s*\|\|\s*\[\]\)\.filter\(/);
  assert.match(page, /estimateMeasurementIds\.has\(row\.measurement_id\)/);

  for (const component of ['PricingCoverage', 'LaborReview', 'EstimateWorksheet']) {
    assert.match(
      page,
      new RegExp(`<${component}[\\s\\S]{0,500}outputs=\\{estimateOutputs\\}`),
      `${component} must receive only outputs scoped to the current Estimate`,
    );
  }
});
