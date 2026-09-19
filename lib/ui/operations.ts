import type {CarezStatusTone} from './state';

export type CarezOperationalState='ready'|'hold'|'planning'|'setup'|'completed';
export type CarezPriority='critical'|'high'|'normal';
export type CarezProjectRecordStatus='active'|'on_hold'|'planning'|'completed';

export type CarezOperationalPresentation={
  kind:CarezOperationalState;
  label:string;
  tone:CarezStatusTone;
};

export type CarezPriorityPresentation={
  kind:CarezPriority;
  label:string;
  tone:CarezStatusTone;
};

export type CarezRecordStatusPresentation={
  kind:CarezProjectRecordStatus;
  label:string;
  tone:CarezStatusTone;
};

const OPERATIONAL_STATE:Record<CarezOperationalState,CarezOperationalPresentation>={
  ready:{kind:'ready',label:'Ready',tone:'success'},
  hold:{kind:'hold',label:'Hold',tone:'blocked'},
  planning:{kind:'planning',label:'In progress',tone:'info'},
  setup:{kind:'setup',label:'Waiting',tone:'warning'},
  completed:{kind:'completed',label:'Complete',tone:'success'},
};

const PRIORITY:Record<CarezPriority,CarezPriorityPresentation>={
  critical:{kind:'critical',label:'Critical',tone:'error'},
  high:{kind:'high',label:'High',tone:'warning'},
  normal:{kind:'normal',label:'Normal',tone:'neutral'},
};

const PROJECT_RECORD_STATUS:Record<CarezProjectRecordStatus,CarezRecordStatusPresentation>={
  active:{kind:'active',label:'Active',tone:'info'},
  on_hold:{kind:'on_hold',label:'On hold',tone:'blocked'},
  planning:{kind:'planning',label:'Planning',tone:'neutral'},
  completed:{kind:'completed',label:'Complete',tone:'success'},
};

function resolveKnown<K extends string,V>(value:unknown,map:Record<K,V>):V|null{
  if(typeof value!=='string')return null;
  return Object.prototype.hasOwnProperty.call(map,value)?map[value as K]:null;
}

export function resolveOperationalState(value:unknown){
  return resolveKnown(value,OPERATIONAL_STATE);
}

export function resolvePriority(value:unknown){
  return resolveKnown(value,PRIORITY);
}

export function resolveProjectRecordStatus(value:unknown){
  return resolveKnown(value,PROJECT_RECORD_STATUS);
}
