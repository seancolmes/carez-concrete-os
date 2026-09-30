'use client';

import {Button} from '@fluentui/react-components';

export function PrintButton(){
  return <Button type="button" appearance="outline" onClick={()=>window.print()}>Print / Save PDF</Button>;
}
