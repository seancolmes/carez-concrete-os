import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyLaborReadState} from '../app/settings/labor-read-state.ts';

test('populated labor reads remain available, including genuine zero rates',()=>{
  const tax={social_security_rate:0,medicare_rate:0};
  const risks=[{code:'QA',employer_rate_per_hour:0}];
  assert.deepEqual(classifyLaborReadState({hasCompanyScope:true,taxRead:{data:tax,error:null},riskRead:{data:risks,error:null}}),{
    taxStatus:'available',riskStatus:'available',
  });
  assert.equal(tax.social_security_rate,0);
  assert.equal(risks[0].employer_rate_per_hour,0);
});

test('successful empty reads distinguish missing tax settings from empty risk classes',()=>{
  assert.deepEqual(classifyLaborReadState({hasCompanyScope:true,taxRead:{data:null,error:null},riskRead:{data:[],error:null}}),{
    taxStatus:'missing',riskStatus:'empty',
  });
});

test('tax and risk-class failures remain independent',()=>{
  const failed={data:null,error:new Error('read failed')};
  assert.deepEqual(classifyLaborReadState({hasCompanyScope:true,taxRead:failed,riskRead:{data:[{code:'QA'}],error:null}}),{
    taxStatus:'unavailable',riskStatus:'available',
  });
  assert.deepEqual(classifyLaborReadState({hasCompanyScope:true,taxRead:{data:{social_security_rate:0},error:null},riskRead:failed}),{
    taxStatus:'available',riskStatus:'unavailable',
  });
});

test('missing company scope makes both reads unavailable',()=>{
  assert.deepEqual(classifyLaborReadState({hasCompanyScope:false,taxRead:{data:null,error:null},riskRead:{data:[],error:null}}),{
    taxStatus:'unavailable',riskStatus:'unavailable',
  });
});
