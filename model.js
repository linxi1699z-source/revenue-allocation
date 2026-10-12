/* Synthetic USD data. Integer cents keep daily/monthly ledger totals exact. */
const FinanceModel = (() => {
 const DAY=86400000, asOf=Date.UTC(2026,9,10,15,59,59), countries=['美国','英国','德国','加拿大','日本','澳大利亚','法国','新加坡'];
 const orders=Array.from({length:36},(_,i)=>{const provider=i%3===1?'Google':'Apple',price=[499,999,2999,5999][i%4],tax=Math.round(price*[.088,.2,.19,.05,0][i%5]),paid=Date.UTC(2026,8,18-Math.floor(i/3),1+i%8,47);return {id:i,order:i===0?'P-HK-179151346491393544':`P-HK-${179151346491393500n+BigInt(i*137)}`,platform:provider==='Apple'?`${2000001248157211n+BigInt(i*317)}`:`GPA.3371-2089-6241-${12000+i}`,product:['feature_rc_test_basic_ar','feature_rc_premium_monthly','feature_rc_basic_quarterly','feature_rc_premium_annual'][i%4],provider,status:i%7===3?'已退款':i%7===5?'退款撤销':'已支付',price,tax,paid,refund:i%7===3||i%7===5?paid+5*DAY:null,commission:Math.round(price*.15),country:countries[i%8],account:countries[(i+(i%5===0?1:0))%8],days:[30,30,90,365][i%4]};});
 orders[0].country=orders[0].account='美国';
 // Synthetic Apple sales-report rows, matched by platform order ID; amounts in cents.
 const appleRefundReport=new Map([
  ['2000001248158162',5099],['2000001248158796',849],
  ['2000001248161015',424],['2000001248162600',849],
  ['2000001248164819',424],['2000001248165453',2549],['2000001248167672',849]
 ]);
 function netRefund(o){
  if(!o.refund)return 0;
  if(o.provider==='Google'){
   const refundAmount=o.price+o.tax,refundTax=o.tax;
   return Math.round((refundAmount-refundTax)*15/100);
  }
  return appleRefundReport.get(o.platform)??null;
 }
 function netIncome(o){return o.status==='已退款'?0:o.price-o.commission;}
 function ledger(o){
  const basis=o.price-o.commission,rows=[],receivable=`应收账款-${o.provider}`;
  const start=new Date(o.paid);
  const calendarDay=t=>{const d=new Date(t);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/DAY;};
  const refundDay=o.refund===null?null:calendarDay(o.refund)-calendarDay(o.paid);
  const revokeDay=o.status==='退款撤销'&&refundDay!==null?refundDay+2:null;
  const lastDay=Math.min(calendarDay(asOf)-calendarDay(o.paid),Math.max(o.days-1,refundDay??0,revokeDay??0));
  const add=(day,account,direction,cents,event='allocation',keepZero=false)=>{
   if(!cents&&!keepZero)return;
   const d=new Date(start.getFullYear(),start.getMonth(),start.getDate()+day);
   const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   rows.push({date,account,direction,cents,event});
  };
  add(0,receivable,'借记',basis);add(0,'合同负债','贷记',basis);
  let accrued=0,refundAccrued=0;
  for(let d=0;d<=lastDay;d++){
   if(d===refundDay){
    refundAccrued=accrued;
    // One full-refund event: reverse recognized revenue, remaining liability,
    // and the exact receivable recorded at initial allocation.
    add(d,'主营业务收入','借记',accrued,'refund',true);
    add(d,'合同负债','借记',basis-accrued,'refund',true);
    add(d,receivable,'贷记',basis,'refund',true);
    accrued=0;
   }
   if(refundDay!==null&&d>=refundDay&&(revokeDay===null||d<revokeDay))continue;
   if(d===revokeDay){
    add(d,receivable,'借记',basis);add(d,'合同负债','贷记',basis-refundAccrued);
    add(d,'主营业务收入','贷记',refundAccrued);accrued=refundAccrued;
   }
   const target=Math.floor(basis*Math.min(d+1,o.days)/o.days),amount=target-accrued;
   add(d,'主营业务收入','贷记',amount);add(d,'合同负债','借记',amount);accrued=target;
  }
  return rows;
 }
 function monthly(rows){const groups=new Map(),accounts=[...new Set(rows.map(r=>r.account))],months=[...new Set(rows.map(r=>r.date.slice(0,7)))];for(const date of months)for(const account of accounts)groups.set(date+'|'+account,{date,account,net:0});for(const r of rows){const month=r.date.slice(0,7),key=month+'|'+r.account;const g=groups.get(key)||{date:month,account:r.account,net:0};g.net+=(r.direction==='借记'?1:-1)*r.cents;groups.set(key,g);}return [...groups.values()].filter(g=>!(g.account.startsWith('应收账款-')&&g.net===0)).map(g=>({date:g.date,account:g.account,direction:g.net>0?'借记':g.net<0?'贷记':g.account.startsWith('应收账款')?'贷记':'借记',cents:Math.abs(g.net)}));}
 function balances(o){const rows=ledger(o),sum=(account,normal)=>rows.filter(r=>r.account===account).reduce((s,r)=>s+(r.direction===normal?1:-1)*r.cents,0);const receivable=netIncome(o),revenue=sum('主营业务收入','贷记');return {receivable,liability:receivable-revenue,revenue};}
 return {orders,countries,ledger,monthly,balances,netIncome,netRefund,asOf};
})();
if(typeof module!=='undefined')module.exports=FinanceModel;
