'use server';
import {revalidateFinancialsWorkspace as revalidatePath} from '@/lib/ui/revalidateUnifiedWorkspace';
import {createClient} from '@/lib/supabase/server';
import {executeProcurementCommand,type ProcurementCommand} from '@/lib/financials/procurementCommands';
async function execute(form:FormData,command:ProcurementCommand){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error('Sign in before changing procurement records.');
 await executeProcurementCommand(client,form,command);
 for(const path of ['/procurement','/documents','/pour-control','/projects','/costs','/forecast','/readiness/resources','/production/work-packages'])revalidatePath(path);
}
export async function createVendor(form:FormData){await execute(form,'create_vendor');}
export async function createVendorQuote(form:FormData){await execute(form,'create_quote');}
export async function addVendorQuoteLine(form:FormData){await execute(form,'add_quote_line');}
export async function deleteVendorQuoteLine(form:FormData){await execute(form,'delete_quote_line');}
export async function setVendorQuoteStatus(form:FormData){await execute(form,'quote_status');}
export async function convertQuoteToPurchaseOrder(form:FormData){await execute(form,'convert_quote');}
export async function createPurchaseOrder(form:FormData){await execute(form,'create_po');}
export async function addPurchaseOrderLine(form:FormData){await execute(form,'add_po_line');}
export async function deletePurchaseOrderLine(form:FormData){await execute(form,'delete_po_line');}
export async function issuePurchaseOrder(form:FormData){await execute(form,'issue_po');}
export async function closePurchaseOrder(form:FormData){await execute(form,'close_po');}
export async function recordPurchaseOrderReceipt(form:FormData){await execute(form,'receipt');}
export async function createVendorBill(form:FormData){await execute(form,'create_bill');}
export async function addVendorBillLine(form:FormData){await execute(form,'add_bill_line');}
export async function deleteVendorBillLine(form:FormData){await execute(form,'delete_bill_line');}
export async function postVendorBill(form:FormData){await execute(form,'post_bill');}
export async function voidVendorBill(form:FormData){await execute(form,'void_bill');}
