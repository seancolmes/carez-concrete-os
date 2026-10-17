/** A missing recorded percentage does not establish a legacy or fully tracked shift. */
export function workCoverage(value:unknown){
 const percentage=value===null||value===undefined||value===''?null:Number(value);
 if(percentage===null||!Number.isFinite(percentage)||percentage<0||percentage>100)return {percentage:null,label:'Unavailable',detail:'Work-coverage percentage has not been recorded. Review the task segments below.',needsReview:true};
 return {percentage,label:`${Math.round(percentage)}%`,detail:percentage>=90?'Work coverage looks complete':'Some paid time has no work assignment',needsReview:percentage<90};
}
