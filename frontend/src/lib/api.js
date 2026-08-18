const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const apiBase = API;

export function getSession(){
  try { return JSON.parse(localStorage.getItem('vali_session') || 'null'); } catch { return null; }
}
export function setSession(session){ localStorage.setItem('vali_session', JSON.stringify(session)); }
export function clearSession(){ localStorage.removeItem('vali_session'); }

export async function request(path, options={}){
  const session=getSession();
  const res=await fetch(`${API}${path}`,{
    ...options,
    headers:{'Content-Type':'application/json', ...(session?.token?{Authorization:`Bearer ${session.token}`}:{ }), ...(options.headers||{})}
  });
  if(!res.ok){
    let data={}; try{data=await res.json();}catch{}
    throw new Error(data.error || `HTTP_${res.status}`);
  }
  if(res.status===204) return null;
  return res.json();
}

export async function onlineLogin(username,password){
  return request('/api/auth/login',{method:'POST',body:JSON.stringify({username,password})});
}

async function sha256(text){
  const data=new TextEncoder().encode(text);
  const digest=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function saveOfflineVerifier(username,password){
  const verifier=await sha256(`${username.trim().toLowerCase()}::${password}`);
  localStorage.setItem('vali_offline_verifier',JSON.stringify({username:username.trim().toLowerCase(),verifier}));
}
export async function canOfflineLogin(username,password){
  const saved=JSON.parse(localStorage.getItem('vali_offline_verifier')||'null');
  if(!saved) return false;
  return saved.username===username.trim().toLowerCase() && saved.verifier===await sha256(`${username.trim().toLowerCase()}::${password}`);
}

export function queueExpense(payload){
  const q=JSON.parse(localStorage.getItem('vali_outbox')||'[]');
  q.push({id:crypto.randomUUID(),type:'expense',payload,createdAt:new Date().toISOString()});
  localStorage.setItem('vali_outbox',JSON.stringify(q));
  return q.length;
}
export function outboxCount(){ return JSON.parse(localStorage.getItem('vali_outbox')||'[]').length; }
export async function flushOutbox(){
  const q=JSON.parse(localStorage.getItem('vali_outbox')||'[]');
  if(!q.length) return 0;
  const remain=[];
  for(const item of q){
    try{
      if(item.type==='expense') await request('/api/expenses',{method:'POST',body:JSON.stringify(item.payload)});
    }catch{ remain.push(item); }
  }
  localStorage.setItem('vali_outbox',JSON.stringify(remain));
  return remain.length;
}
