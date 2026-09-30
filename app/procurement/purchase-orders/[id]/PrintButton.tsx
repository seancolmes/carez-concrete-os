'use client';

import {Button} from '@fluentui/react-components';

export default function PrintButton(){return <Button type="button" appearance="primary" onClick={()=>window.print()}>Print / Save PDF</Button>;}
