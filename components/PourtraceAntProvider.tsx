'use client';

import {useEffect,useState} from 'react';
import {ConfigProvider,theme} from 'antd';

export function PourtraceAntProvider({children}:{children:React.ReactNode}){
  const [dark,setDark]=useState(false);

  useEffect(()=>{
    const root=document.documentElement;
    const update=()=>setDark(root.classList.contains('dark'));
    update();
    const observer=new MutationObserver(update);
    observer.observe(root,{attributes:true,attributeFilter:['class']});
    return()=>observer.disconnect();
  },[]);

  return <ConfigProvider componentSize="small" theme={{
    algorithm:dark?theme.darkAlgorithm:theme.defaultAlgorithm,
    token:{
      colorPrimary:'#007A52',
      colorBgBase:dark?'#121212':'#F5F7F6',
      colorTextBase:dark?'#F4F6F5':'#171B19',
      colorBorder:dark?'#343A3F':'#D4DBD7',
      fontFamily:'var(--font-fira-sans), "Fira Sans", sans-serif',
      fontSize:13,
      borderRadius:4,
      controlHeight:36,
    },
  }}>{children}</ConfigProvider>;
}
