import test from 'node:test';
import assert from 'node:assert/strict';
import {fitDrawingPage} from '../lib/takeoff/viewportFit.ts';
test('fit page respects phone controls, desktop dock space and paper margins',()=>{
 for(const input of [
  {width:390,height:600,pageWidth:350,pageHeight:245,left:8,right:8,top:100,bottom:50},
  {width:1024,height:736,pageWidth:1000,pageHeight:700,left:16,right:16,top:58,bottom:128},
  {width:1024,height:736,pageWidth:700,pageHeight:1000,left:16,right:16,top:58,bottom:128},
 ]){
  const zoom=fitDrawingPage(input)!;assert.ok(zoom>0);
  assert.ok(input.pageWidth*zoom<=input.width-input.left-input.right-26+.0001);
  assert.ok(input.pageHeight*zoom<=input.height-input.top-input.bottom-26+.0001);
 }
 assert.equal(fitDrawingPage({width:0,height:600,pageWidth:100,pageHeight:100,left:8,right:8,top:100,bottom:50}),null);
});
