import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crewDaysToManHoursPerUnit,
  laborDirectPerSfToManHoursPerUnit,
  manHoursPerUnitToCrewDays,
  manHoursPerUnitToLaborDirectPerSf,
} from '../lib/takeoff/laborConversion.ts';

test('crew days convert both ways through the saved MH per production unit',()=>{
  const rate=crewDaysToManHoursPerUnit(5,4,8,100);
  assert.equal(rate,1.6);
  assert.equal(manHoursPerUnitToCrewDays(rate!,100,4,8),5);
  assert.equal(crewDaysToManHoursPerUnit(0,4,8,100),0);
});

test('labor-direct dollars per SF convert through the selected burdened hourly rate',()=>{
  const rate=laborDirectPerSfToManHoursPerUnit(80,50);
  assert.equal(rate,1.6);
  assert.equal(manHoursPerUnitToLaborDirectPerSf(rate!,50),80);
  assert.equal(laborDirectPerSfToManHoursPerUnit(80,0),null);
});

test('invalid or missing production inputs cannot create an MH assumption',()=>{
  assert.equal(crewDaysToManHoursPerUnit(5,4,8,0),null);
  assert.equal(crewDaysToManHoursPerUnit(5,2.5,8,100),null);
  assert.equal(crewDaysToManHoursPerUnit(-1,4,8,100),null);
  assert.equal(manHoursPerUnitToCrewDays(1.6,100,4,0),null);
  assert.equal(manHoursPerUnitToLaborDirectPerSf(1.6,Number.POSITIVE_INFINITY),null);
});
