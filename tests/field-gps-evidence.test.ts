import test from 'node:test';
import assert from 'node:assert/strict';
import {clockLocationEvidence,shiftLocationEvidence} from '../lib/field/gpsEvidence.ts';
test('missing GPS and an unknown boundary require review without becoming a physical-work gate',()=>{
 assert.equal(clockLocationEvidence(null,null,null).label,'GPS not recorded');assert.equal(clockLocationEvidence(40,-120,null).needsReview,true);assert.equal(clockLocationEvidence(40,-120,true).needsReview,false);assert.equal(clockLocationEvidence(40,-120,false).needsReview,true);
 assert.equal(shiftLocationEvidence({clock_in_latitude:40,clock_in_longitude:-120,clock_in_inside_geofence:true,clock_out_latitude:null,clock_out_longitude:null}).needsReview,true);
});
