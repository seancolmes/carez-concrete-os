export type CarezStatusTone='neutral'|'info'|'success'|'warning'|'error'|'blocked';
export type CarezVisualTone='neutral'|'info'|'success'|'warning'|'error';
export type CarezSaveStateKind='saved'|'saving'|'unsaved'|'validation-required'|'save-failed'|'device-only'|'queued';
export type CarezAuthorityKind='user-confirmed'|'system-calculated'|'imported'|'ai-suggested'|'versioned'|'issued'|'frozen';
export type CarezFeedbackScope='inline'|'workspace';
export type CarezNumericKind='quantity'|'count'|'length'|'area'|'volume'|'currency'|'unit-cost'|'production-rate'|'percentage'|'duration';

export type CarezStatusToneContract={kind:CarezStatusTone;label:string;tone:CarezVisualTone};
export type CarezSaveStateContract={kind:CarezSaveStateKind;label:string;tone:CarezVisualTone;serverPersisted:boolean};
export type CarezAuthorityStateContract={kind:CarezAuthorityKind;label:string;tone:CarezVisualTone};
export type CarezFeedbackScopeContract={kind:CarezFeedbackScope;role:'status'};
export type CarezNumericKindContract={kind:CarezNumericKind;inputMode:'decimal'|'numeric'};

const STATUS_TONES:Record<CarezStatusTone,CarezStatusToneContract>={
  neutral:{kind:'neutral',label:'Neutral',tone:'neutral'},
  info:{kind:'info',label:'Information',tone:'info'},
  success:{kind:'success',label:'Success',tone:'success'},
  warning:{kind:'warning',label:'Warning',tone:'warning'},
  error:{kind:'error',label:'Error',tone:'error'},
  blocked:{kind:'blocked',label:'Blocked',tone:'error'},
};

const SAVE_STATES:Record<CarezSaveStateKind,CarezSaveStateContract>={
  saved:{kind:'saved',label:'Saved',tone:'success',serverPersisted:true},
  saving:{kind:'saving',label:'Saving…',tone:'info',serverPersisted:false},
  unsaved:{kind:'unsaved',label:'Unsaved changes',tone:'warning',serverPersisted:false},
  'validation-required':{kind:'validation-required',label:'Validation required',tone:'warning',serverPersisted:false},
  'save-failed':{kind:'save-failed',label:'Save failed',tone:'error',serverPersisted:false},
  'device-only':{kind:'device-only',label:'Saved on device',tone:'info',serverPersisted:false},
  queued:{kind:'queued',label:'Waiting to sync',tone:'info',serverPersisted:false},
};

const AUTHORITY_STATES:Record<CarezAuthorityKind,CarezAuthorityStateContract>={
  'user-confirmed':{kind:'user-confirmed',label:'User confirmed',tone:'success'},
  'system-calculated':{kind:'system-calculated',label:'System calculated',tone:'info'},
  imported:{kind:'imported',label:'Imported',tone:'neutral'},
  'ai-suggested':{kind:'ai-suggested',label:'AI suggested',tone:'info'},
  versioned:{kind:'versioned',label:'Versioned',tone:'neutral'},
  issued:{kind:'issued',label:'Issued',tone:'neutral'},
  frozen:{kind:'frozen',label:'Frozen',tone:'neutral'},
};

const FEEDBACK_SCOPES:Record<CarezFeedbackScope,CarezFeedbackScopeContract>={
  inline:{kind:'inline',role:'status'},
  workspace:{kind:'workspace',role:'status'},
};

const NUMERIC_KINDS:Record<CarezNumericKind,CarezNumericKindContract>={
  quantity:{kind:'quantity',inputMode:'decimal'},
  count:{kind:'count',inputMode:'numeric'},
  length:{kind:'length',inputMode:'decimal'},
  area:{kind:'area',inputMode:'decimal'},
  volume:{kind:'volume',inputMode:'decimal'},
  currency:{kind:'currency',inputMode:'decimal'},
  'unit-cost':{kind:'unit-cost',inputMode:'decimal'},
  'production-rate':{kind:'production-rate',inputMode:'decimal'},
  percentage:{kind:'percentage',inputMode:'decimal'},
  duration:{kind:'duration',inputMode:'decimal'},
};

function resolveKnown<T extends string,V>(value:unknown,contracts:Record<T,V>):V|null{
  if(typeof value!=='string')return null;
  return Object.prototype.hasOwnProperty.call(contracts,value)?contracts[value as T]:null;
}

export function resolveStatusTone(value:unknown){return resolveKnown(value,STATUS_TONES)}
export function resolveSaveState(value:unknown){return resolveKnown(value,SAVE_STATES)}
export function resolveAuthorityState(value:unknown){return resolveKnown(value,AUTHORITY_STATES)}
export function resolveFeedbackScope(value:unknown){return resolveKnown(value,FEEDBACK_SCOPES)}
export function resolveNumericKind(value:unknown){return resolveKnown(value,NUMERIC_KINDS)}
