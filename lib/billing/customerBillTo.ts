export const invoiceCustomerColumns='id,name,contact_name,email,billing_terms,billing_address_line1,billing_address_line2,billing_city,billing_state,billing_postal_code';

export async function readInvoiceCustomer(supabase:any,companyId:string,customerId:string|null){
  if(!customerId)return null;
  const {data,error}=await supabase.from('customers').select(invoiceCustomerColumns)
    .eq('id',customerId).eq('company_id',companyId).maybeSingle();
  if(error)throw new Error('Customer bill-to information is unavailable. Reload after billing setup is restored.');
  if(!data)throw new Error('The linked customer is unavailable. Review the project customer before creating an invoice.');
  return data;
}

export function customerBillToSnapshot(customer:any){
  return {
    bill_to_name:customer?.name??null,bill_to_contact:customer?.contact_name??null,bill_to_email:customer?.email??null,
    bill_to_address_line1:customer?.billing_address_line1??null,bill_to_address_line2:customer?.billing_address_line2??null,
    bill_to_city:customer?.billing_city??null,bill_to_state:customer?.billing_state??null,bill_to_postal_code:customer?.billing_postal_code??null,
  };
}
