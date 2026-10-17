/** Authenticated original-file ranges stay below the hosting payload limit. */
export function drawingPdfSource(url:string){
 return url.startsWith('/api/documents/')?{url,withCredentials:true,rangeChunkSize:1024*1024,disableStream:true,disableAutoFetch:true}:{url};
}
