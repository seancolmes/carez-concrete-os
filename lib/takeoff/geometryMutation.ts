/** Expected concurrency rejection must cross a production server-action boundary. */
export function geometryMutationConflict(error:unknown){
  return error&&typeof error==='object'&&'code' in error&&error.code==='40001'
    ?{ok:false as const,conflict:true as const,message:'Drawing changed since this edit. History was retired; saved work is unchanged. Reloaded current drawing data.'}
    :null;
}
