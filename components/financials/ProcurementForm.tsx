import {FinancialRequestId} from './FinancialRequestId';
import {ProcurementFormControls,type ProcurementFormProps} from './ProcurementFormControls';

/** One stable request per rendered business form, including uncertain retries. */
export function ProcurementForm({children,...props}:ProcurementFormProps){
 return <ProcurementFormControls {...props}><FinancialRequestId/>{children}</ProcurementFormControls>;
}
