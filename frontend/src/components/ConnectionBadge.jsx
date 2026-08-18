import { useEffect, useState } from 'react';
import { apiBase, flushOutbox, outboxCount } from '../lib/api';

export default function ConnectionBadge(){
  const [online,setOnline]=useState(navigator.onLine);
  const [pending,setPending]=useState(outboxCount());
  useEffect(()=>{
    let live=true;
    const tick=async()=>{
      let ok=false;
      if(navigator.onLine){
        try{ const r=await fetch(`${apiBase}/health`,{cache:'no-store'}); ok=r.ok; }catch{}
      }
      if(!live) return;
      setOnline(ok);
      if(ok){ const left=await flushOutbox(); if(live)setPending(left); }
      else setPending(outboxCount());
    };
    tick(); const id=setInterval(tick,3000);
    return()=>{live=false;clearInterval(id)};
  },[]);
  return <div className={`connection ${online?'online':'offline'}`}><span className="dot"/>{online?'آنلاین':'آفلاین'}{pending>0&&<small>{pending} مورد منتظر ارسال</small>}</div>;
}
