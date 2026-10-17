const types=['plan','agreement','proposal','rfq','reference','insurance','w9','tax'];
export function retainedSourceScope(type:string,visibility:string,projectId:string|null){
 if(!types.includes(type))throw new Error('Choose a supported source purpose.');
 if(visibility!=='job'&&visibility!=='office_private')throw new Error('Choose the source access scope.');
 if(['w9','tax'].includes(type)&&visibility!=='office_private')throw new Error('W9 and tax sources require the private company vault.');
 if(visibility==='job'&&!projectId)throw new Error('Choose a job for a job source.');
 return {type,visibility,privateFile:visibility==='office_private',projectId:visibility==='office_private'?null:projectId};
}
