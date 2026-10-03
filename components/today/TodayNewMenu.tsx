'use client';

import {useRouter} from 'next/navigation';
import {Button,Menu,MenuItem,MenuList,MenuPopover,MenuTrigger} from '@fluentui/react-components';
import {AddRegular} from '@fluentui/react-icons';

export function TodayNewMenu(){
  const router=useRouter();
  return <Menu><MenuTrigger disableButtonEnhancement><Button type="button" appearance="primary" size="small" icon={<AddRegular/>}>New</Button></MenuTrigger><MenuPopover><MenuList>
    <MenuItem onClick={()=>router.push('/opportunities')}>Opportunity / estimate</MenuItem>
    <MenuItem onClick={()=>router.push('/projects')}>Direct project</MenuItem>
    <MenuItem onClick={()=>router.push('/field?view=schedule')}>Pour / schedule item</MenuItem>
  </MenuList></MenuPopover></Menu>;
}
