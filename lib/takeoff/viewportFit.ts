/** Fit the paper inside the viewport's usable drawing area, including paper margins. */
export function fitDrawingPage(input:{width:number;height:number;pageWidth:number;pageHeight:number;left:number;right:number;top:number;bottom:number}){
 const width=input.width-input.left-input.right-26;
 const height=input.height-input.top-input.bottom-26;
 if(!Object.values(input).every(Number.isFinite)||width<=0||height<=0||input.pageWidth<=0||input.pageHeight<=0)return null;
 return Math.min(width/input.pageWidth,height/input.pageHeight);
}
