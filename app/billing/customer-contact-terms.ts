export function customerContactTermsPayload(fd:FormData){
  const text=(key:string)=>String(fd.get(key)||'').trim()||null;
  return {
    contact_name:text('contact_name'),
    email:text('email'),
    phone:text('phone'),
    billing_terms:text('billing_terms'),
  };
}

export const customerAddressKeys=['billing_address_line1','billing_address_line2','billing_city','billing_state','billing_postal_code'] as const;

export function customerBillingPayload(fd:FormData){
  const present=customerAddressKeys.filter(key=>fd.has(key));
  const contact=customerContactTermsPayload(fd);
  if(!present.length)return {payload:contact,revision:null};
  if(present.length!==customerAddressKeys.length)throw new Error('The complete billing address must be loaded before saving. Reopen the customer.');
  const raw=String(fd.get('billing_profile_revision')??'');
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw new Error('Billing profile revision is missing. Reopen the customer before saving.');
  const address=Object.fromEntries(customerAddressKeys.map(key=>[key,String(fd.get(key)||'').trim()||null]));
  return {payload:{...contact,...address},revision:Number(raw)};
}
