import 'server-only';
import {randomUUID} from 'node:crypto';

/** One identity per rendered form; an uncertain retry keeps its original identity. */
export function FinancialRequestId(){return <input type="hidden" name="financial_request_id" value={randomUUID()}/>;}
