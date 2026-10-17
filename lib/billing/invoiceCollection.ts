/** Classifications supplied by the two verified invoice-summary contracts.
 * Never recompute invoice dates, status or eligibility in the browser. */
export function invoiceCollectionKind(status:string|null|undefined):'overdue'|'known'|'unavailable'{
 if(status==='overdue'||status==='overdue_partial')return'overdue';
 if(['open','partially_paid','paid','draft','void','credit'].includes(status||''))return'known';
 return'unavailable';
}
