import { getSession } from '../lib/api';
export default function Dashboard(){
 const role=getSession()?.user?.role;
 return <section><div className="hero"><div><span className="eyebrow">پنل مدیریت</span><h2>سلام، به VALI خوش آمدی</h2><p>هزینه‌ها، راننده‌ها، حساب‌ها و فاکتورها از همین پنل کنترل می‌شوند.</p></div><div className="hero-truck">🚛<b>VALI</b></div></div><div className="cards"><div className="stat"><span>دسترسی فعلی</span><b>{role==='manager'?'مدیر کامل':role==='office'?'دفتر‌دار':'ثبت هزینه'}</b></div><div className="stat"><span>واحدهای مالی</span><b>دلار + تومان</b></div><div className="stat"><span>همگام‌سازی</span><b>هر ۳ ثانیه</b></div><div className="stat"><span>فاکتور</span><b>A5 · FA / TR</b></div></div></section>
}
