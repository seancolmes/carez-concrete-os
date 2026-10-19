/** Only schedule items depend on the company date; other reads start immediately. */
export async function loadScheduleReadSets<C,I,R>(calendar:()=>PromiseLike<C>,items:(calendar:C)=>PromiseLike<I>,related:()=>PromiseLike<R>){
 const date=Promise.resolve().then(calendar);
 const records=date.then(items);
 const independent=Promise.resolve().then(related);
 return Promise.all([date,records,independent]);
}
