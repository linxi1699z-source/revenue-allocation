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
 function eligible(o){return o.paid!==null&&o.paid!==undefined&&Number.isFinite(o.paid);}
 function netIncome(o){if(!eligible(o)||o.stage==='waiting')return null;return o.status==='已退款'?0:o.price-o.commission;}
 function buildLedger(o){
  const basis=o.price-o.commission,rows=[],receivable=`平台应收款-${o.provider}`;
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
  add(0,receivable,'借记',basis,'initial');add(0,'合同负债','贷记',basis,'initial');
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
 const allocationStatuses=['待获取净收入数据','已匹配收入','待分摊','分摊中','完成分摊','完成分摊（金额异常）','分摊异常'];
 Object.assign(orders[0],{stage:'waiting'});
 Object.assign(orders[1],{stage:'matched'});
 Object.assign(orders[2],{stage:'queued'});
 Object.assign(orders[6],{days:7});
 Object.assign(orders[8],{days:7,amountMismatch:true});
 Object.assign(orders[9],{failure:{date:'2026-09-20',step:'生成分摊分录',reason:'分摊服务临时不可用',attempts:1,persistent:false}});
 Object.assign(orders[10],{failure:{date:'2026-09-20',step:'生成退款分摊分录',reason:'退款分摊任务临时失败，平台应收款待冲回',attempts:1,persistent:false}});
 Object.assign(orders[11],{failure:{date:'2026-09-19',step:'写入分摊记录',reason:'科目映射缺失',attempts:3,persistent:true}});
 function ledger(o){
  if(!eligible(o)||['waiting','matched','queued'].includes(o.stage))return [];
  let rows=buildLedger(o);
  if(o.failure)rows=rows.filter(r=>r.date<o.failure.date);
  if(o.amountMismatch){rows=rows.map((r,i)=>i===0?{...r,cents:r.cents+1}:r);}
  return rows;
 }
 function reconciliation(o){const rows=ledger(o);const total=(name,normal)=>rows.filter(r=>r.account===name).reduce((s,r)=>s+(r.direction===normal?r.cents:-r.cents),0);return {receivable:total(`平台应收款-${o.provider}`,'借记'),revenue:total('主营业务收入','贷记')};}
 function allocationStatus(o){
  if(!eligible(o))return null;
  if(o.stage==='waiting')return allocationStatuses[0];
  if(o.stage==='matched')return allocationStatuses[1];
  if(o.stage==='queued')return allocationStatuses[2];
  if(o.failure)return allocationStatuses[6];
  const b=balances(o),check=reconciliation(o);
  if(b.liability===0&&b.revenue===netIncome(o))return check.receivable===check.revenue?allocationStatuses[4]:allocationStatuses[5];
  return allocationStatuses[3];
 }
 function retry(o){
  if(!o.failure)return false;
  o.failure.attempts++;
  if(o.failure.persistent)return false;
  o.lastRetry={date:o.failure.date,attempts:o.failure.attempts};
  delete o.failure;
  return true;
 }

 function monthly(rows){const groups=new Map(),accounts=[...new Set(rows.map(r=>r.account))],months=[...new Set(rows.map(r=>r.date.slice(0,7)))];for(const date of months)for(const account of accounts)groups.set(date+'|'+account,{date,account,net:0});for(const r of rows){const month=r.date.slice(0,7),key=month+'|'+r.account;const g=groups.get(key)||{date:month,account:r.account,net:0};g.net+=(r.direction==='借记'?1:-1)*r.cents;groups.set(key,g);}return [...groups.values()].filter(g=>!(g.account.startsWith('平台应收款-')&&g.net===0)).map(g=>({date:g.date,account:g.account,direction:g.net>0?'借记':g.net<0?'贷记':g.account.startsWith('平台应收款')?'贷记':'借记',cents:Math.abs(g.net)}));}
 function balances(o){
  if(netIncome(o)===null)return {receivable:null,liability:null,revenue:null};
  const rows=ledger(o);
  const revenue=rows.filter(r=>r.account==='主营业务收入').reduce((s,r)=>s+(r.direction==='贷记'?r.cents:-r.cents),0);
  // Initialize from matched income; apply refunds/reversals only once posted.
  // Initial-entry discrepancies remain independently checked by reconciliation.
  const receivable=o.price-o.commission+rows.filter(r=>r.account===`平台应收款-${o.provider}`&&r.event!=='initial').reduce((s,r)=>s+(r.direction==='借记'?r.cents:-r.cents),0);
  return {receivable,liability:receivable-revenue,revenue};
 }
 function latestAllocationTime(o){const rows=ledger(o);return rows.length?rows[rows.length-1].date+' 23:59:59':'—';}

 return {orders,countries,ledger,monthly,balances,netIncome,netRefund,asOf,eligible,allocationStatuses,allocationStatus,reconciliation,retry,latestAllocationTime};
})();
if(typeof module!=='undefined')module.exports=FinanceModel;
