import {Spinner} from '@fluentui/react-components';
import {AppShell} from '@/components/AppShell';

export default function FieldLoading(){
 return <AppShell userName=""><section aria-busy="true" className="pt-workspace-loading"><Spinner size="small"/><div><h1 className="text-lg font-semibold">Field</h1><p role="status" className="mt-1 text-sm text-muted-foreground">Opening workspace…</p></div></section></AppShell>;
}
