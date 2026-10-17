/** Required authority must load before empty-state, lock, or authoring decisions. */
export function requireTakeoffRead<T>(label:string,data:T,error:unknown,required=true):T {
  if(error||(required&&data==null))throw new Error(`Takeoff ${label} unavailable. Reload to recover; no dependent changes were enabled.`);
  return data;
}
