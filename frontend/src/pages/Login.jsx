import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canOfflineLogin, getSession, onlineLogin, saveOfflineVerifier, setSession } from '../lib/api';

export default function Login(){
  const nav=useNavigate();
  const [username,setUsername]=useState(''); const [password,setPassword]=useState(''); const [remember,setRemember]=useState(true); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(e){
    e.preventDefault();setBusy(true);setError('');
    try{
      const data=await onlineLogin(username,password); setSession(data); if(remember) await saveOfflineVerifier(username,password); nav('/');
    }catch{
      const old=getSession();
      if(!navigator.onLine && old && await canOfflineLogin(username,password)){ setSession(old); nav('/'); }
      else setError(navigator.onLine?'نام کاربری یا رمز عبور درست نیست.':'این دستگاه برای ورود آفلاین آماده نشده؛ یک بار آنلاین وارد شوید.');
    }finally{setBusy(false)}
  }
  return <div className="login-page"><div className="truck-scene"><div className="truck-card"><span>🚛</span><strong>VALI</strong><small>TRANSPORT SYSTEM</small></div></div><form className="login-card" onSubmit={submit}><div className="mini-logo">VALI</div><h2>ورود به سیستم</h2><p>مدیریت آنلاین و آفلاین شرکت حمل‌ونقل</p><label>نام کاربری<input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username"/></label><label>رمز عبور<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>ذخیره ورود روی این دستگاه</label>{error&&<div className="error">{error}</div>}<button disabled={busy}>{busy?'در حال ورود...':'ورود'}</button><small className="secure-note">رمز عبور به‌صورت متن ساده روی دستگاه ذخیره نمی‌شود.</small></form></div>
}
