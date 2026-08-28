'use client';
export default function PrintButton(){return <button onClick={()=>window.print()} style={{border:0,borderRadius:8,padding:'10px 16px',background:'#244ca6',color:'#fff',fontWeight:800,cursor:'pointer'}}>Print / Save PDF</button>;}
