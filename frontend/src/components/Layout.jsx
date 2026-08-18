import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, FileText, Gauge, LogOut, ReceiptText, Truck, Users } from 'lucide-react';
import ConnectionBadge from './ConnectionBadge';
import { clearSession, getSession } from '../lib/api';

export default function Layout(){
  const nav=useNavigate(); const session=getSession(); const role=session?.user?.role;
  const links=[
    ['/',Gauge,'داشبورد'],
    ...(role!=='employee'?[['/drivers',Truck,'راننده‌ها']]:[]),
    ...(role==='manager'?[['/companies',Building2,'شرکت‌ها']]:[]),
    ['/expenses',ReceiptText,'هزینه‌ها'],
    ...(role==='manager'?[['/users',Users,'کارمندان']]:[]),
    ...(role!=='employee'?[['/invoice',FileText,'فاکتور A5']]:[]),
  ];
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">V</div><div><b>VALI</b><span>TRANSPORT</span></div></div>
      <nav>{links.map(([to,I,label])=><NavLink key={to} to={to} end={to==='/'}><I size={19}/>{label}</NavLink>)}</nav>
      <button className="logout" onClick={()=>{clearSession();nav('/login')}}><LogOut size={18}/>خروج</button>
    </aside>
    <main className="main"><header><div><h1>VALI Transport System</h1><p>{session?.user?.fullName} · {role==='manager'?'مدیر':role==='office'?'دفتر‌دار':'کارمند'}</p></div><ConnectionBadge/></header><Outlet/></main>
  </div>
}
