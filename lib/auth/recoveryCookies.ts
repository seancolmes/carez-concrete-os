import {recoveryVerifier} from './recoveryContext.ts';
type Cookie={name:string;value:string;options?:{maxAge?:number;[key:string]:unknown}};
/** Buffer SDK writes so masked account outcomes have identical cookie behavior. */
export function recoveryRequestCookies(){
 const current=new Map<string,Cookie>();let generated:Cookie[]|null=null;
 return {
  getAll:()=>[...current.values()],
  setAll(items:Cookie[]){
   for(const item of items){if(item.options?.maxAge===0)current.delete(item.name);else current.set(item.name,item);}
   const values=[...current.values()];if(!generated&&recoveryVerifier(values))generated=values.map(cookie=>({...cookie}));
  },
  completed(maskedAccountError:boolean){return maskedAccountError?generated||[]:[...current.values()];},
 };
}
