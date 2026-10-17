export function clockLocationEvidence(latitude:unknown,longitude:unknown,inside:unknown){
 if(latitude==null||longitude==null||!Number.isFinite(Number(latitude))||!Number.isFinite(Number(longitude)))return{state:'missing',label:'GPS not recorded',needsReview:true};
 if(inside===false)return{state:'outside',label:'Outside jobsite',needsReview:true};
 if(inside===true)return{state:'inside',label:'On jobsite',needsReview:false};
 return{state:'unconfigured',label:'Location recorded · jobsite boundary unavailable',needsReview:true};
}
export function shiftLocationEvidence(shift:Record<string,unknown>){
 const clockIn=clockLocationEvidence(shift.clock_in_latitude,shift.clock_in_longitude,shift.clock_in_inside_geofence);
 const clockOut=clockLocationEvidence(shift.clock_out_latitude,shift.clock_out_longitude,shift.clock_out_inside_geofence);
 return{clockIn,clockOut,needsReview:clockIn.needsReview||clockOut.needsReview,label:clockIn.state==='missing'||clockOut.state==='missing'?'Not recorded':clockIn.state==='outside'||clockOut.state==='outside'?'Outside':clockIn.needsReview||clockOut.needsReview?'Boundary unavailable':'Inside'};
}
