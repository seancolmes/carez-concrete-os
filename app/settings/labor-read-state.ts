type ReadResult<T>={data:T|null;error:unknown};

export function classifyLaborReadState({hasCompanyScope,taxRead,riskRead}:{
  hasCompanyScope:boolean;
  taxRead:ReadResult<unknown>;
  riskRead:ReadResult<readonly unknown[]>;
}){
  const taxStatus=!hasCompanyScope||taxRead.error?'unavailable':taxRead.data==null?'missing':'available';
  const riskStatus=!hasCompanyScope||riskRead.error||!Array.isArray(riskRead.data)?'unavailable':riskRead.data.length===0?'empty':'available';
  return {taxStatus,riskStatus} as const;
}
