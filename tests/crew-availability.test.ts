import assert from 'node:assert/strict';
import test from 'node:test';
import {crewAvailability} from '../lib/ui/crew-availability.ts';
const failed={message:'Unavailable'};
test('successful crew reads allow the existing profile and rate workflows',()=>{assert.deepEqual(crewAvailability({directoryError:null,profileError:null,historyError:null}),{directoryAvailable:true,profileAvailable:true,historyAvailable:true,rateChangesAvailable:true});});
test('missing worker schema keeps the directory but prevents default-filled worker and rate writes',()=>{const state=crewAvailability({directoryError:null,profileError:failed,historyError:null});assert.equal(state.directoryAvailable,true);assert.equal(state.profileAvailable,false);assert.equal(state.rateChangesAvailable,false);});
test('history failure preserves profiles but never permits a rate change',()=>{const state=crewAvailability({directoryError:null,profileError:null,historyError:failed});assert.equal(state.profileAvailable,true);assert.equal(state.historyAvailable,false);assert.equal(state.rateChangesAvailable,false);});
test('directory failure cannot expose worker editing even when dependent queries succeed',()=>{const state=crewAvailability({directoryError:failed,profileError:null,historyError:null});assert.equal(state.profileAvailable,false);assert.equal(state.rateChangesAvailable,false);});
