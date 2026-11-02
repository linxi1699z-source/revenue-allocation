/* Synthetic multi-currency data. Amounts use integer thousandths. */
const FinanceModel = (() => {
 const DAY=86400000, asOf=Date.UTC(2026,9,30,6,59,59), countries=['美国','英国','德国','加拿大','日本','澳大利亚','法国','新加坡'];
 const orders=Array.from({length:36},(_,i)=>{const provider=i%3===1?'Google':'Apple',price=[499,999,2999,5999][i%4],tax=Math.round(price*[.088,.2,.19,.05,0][i%5]),paid=Date.UTC(2026,8,18-Math.floor(i/3),1+i%8,47);return {id:i,currency:'USD',order:i===0?'P-HK-179151346491393544':`P-HK-${179151346491393500n+BigInt(i*137)}`,platform:provider==='Apple'?`${2000001248157211n+BigInt(i*317)}`:`GPA.3371-2089-6241-${12000+i}`,product:['feature_rc_test_basic_ar','feature_rc_premium_monthly','feature_rc_basic_quarterly','feature_rc_premium_annual'][i%4],provider,discountType:['标准','免费试用','折扣','赠送'][i%4],status:i%7===3?'已退款':i%7===5?'退款撤销':'已支付',price,tax,paid,refund:i%7===3||i%7===5?paid+5*DAY:null,commission:Math.round(price*.15),country:countries[i%8],account:countries[(i+(i%5===0?1:0))%8],days:[30,30,90,365][i%4]};});
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
   const refundAmount=o.refundAmount??o.price+o.tax,refundTax=o.refundTax??o.tax;
   return Math.round((refundAmount-refundTax)*15/100);
  }
  return o.reportNetRefund??appleRefundReport.get(o.platform)??null;
 }
 const PACIFIC='America/Los_Angeles';
 function formatTime(timestamp,zone=PACIFIC){
  if(timestamp===null||timestamp===undefined)return '—';
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp)).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
 }
 const dateInZone=(timestamp,zone=PACIFIC)=>formatTime(timestamp,zone).slice(0,10);
 // Resolve a business-day end to a timestamp with the IANA zone's DST offset.
 function dayEndTimestamp(date,zone=PACIFIC){
  const target=Date.parse(date+'T23:59:59Z');let result=target;
  for(let i=0;i<3;i++)result+=target-Date.parse(formatTime(result,zone).replace(' ','T')+'Z');
  return result;
 }
 for(const o of orders)o.refunds=o.refund===null?[]:[{id:`refund-${o.id}`,timestamp:o.refund,cents:netRefund(o),amount:o.price+o.tax,allocationStarted:false}];
 // Same Pacific date, separate API refund IDs; a replay and an already-started
 // historical refund demonstrate deduplication and exclusion before aggregation.
 orders[10].refunds=[
  {id:'refund-10-a',timestamp:orders[10].refund,cents:200,amount:1450,allocationStarted:false},
  {id:'refund-10-b',timestamp:orders[10].refund+3600000,cents:250,amount:1813,allocationStarted:false},
  {id:'refund-10-a',timestamp:orders[10].refund,cents:200,amount:1450,allocationStarted:false},
  {id:'refund-10-history',timestamp:orders[10].refund-DAY,cents:100,amount:666,allocationStarted:true}
 ];
 function pendingIncome(o){return eligible(o)&&o.stage!=='waiting'&&!ledger(o).some(r=>r.event==='initial')?[{order:o.order,platform:o.platform,cents:incomeBasis(o),date:dateInZone(o.paid),timestamp:o.paid}]:[];}
 function pendingRefundEntries(o){
  if(!eligible(o)||o.stage==='waiting')return [];
  const posted=new Set([...ledger(o).flatMap(r=>r.refundIds||[]),...(o.refunds||[]).filter(r=>r.allocationStarted).map(r=>r.id)]),seen=new Set();
  return (o.refunds||[]).filter(r=>{if(posted.has(r.id)||seen.has(r.id))return false;seen.add(r.id);return true;}).sort((a,b)=>a.timestamp-b.timestamp);
 }
 function pendingRefunds(o){
  const groups=new Map();
  for(const r of pendingRefundEntries(o)){
   const date=dateInZone(r.timestamp);
   const g=groups.get(date)||{order:o.order,platform:o.platform,date,cents:0,timestamps:[]};
   g.cents=g.cents===null||r.cents===null?null:g.cents+r.cents;
   g.timestamps.push(r.timestamp);groups.set(date,g);
  }
  return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date));
 }
 function eligible(o){return o.paid!==null&&o.paid!==undefined&&Number.isFinite(o.paid);}
 function incomeBasis(o){return o.incomeBasis??o.price-o.commission;}
 function netIncome(o){if(!eligible(o)||o.stage==='waiting')return null;if(o.editedNetIncome!==undefined)return o.editedNetIncome;return o.status==='已退款'?(o.refundKind==='partial'?o.price-o.commission-netRefund(o):0):o.price-o.commission;}
 function buildLedger(o){
  const basis=incomeBasis(o),rows=[],receivable='平台应收账款';
  const start=new Date(dateInZone(o.paid)+'T00:00:00Z');
  const calendarDay=t=>Date.parse(dateInZone(t)+'T00:00:00Z')/DAY;
  const refundDay=o.refund===null?null:calendarDay(o.refund)-calendarDay(o.paid);
  const revokeDay=o.status==='退款撤销'&&refundDay!==null?refundDay+2:null;
  const lastDay=Math.min(calendarDay(o.allocationAsOf??asOf)-calendarDay(o.paid),Math.max(o.days-1,refundDay??0,revokeDay??0));
  const add=(day,account,direction,cents,event='allocation',keepZero=false)=>{
   if(!cents&&!keepZero)return;
   const date=new Date(start.getTime()+day*DAY).toISOString().slice(0,10);
   const refundIds=event==='refund'?(o.refunds||[]).filter(r=>!r.allocationStarted&&dateInZone(r.timestamp)===date).map(r=>r.id):[];
   rows.push({date,timestamp:dayEndTimestamp(date),account,direction,cents,event,refundIds});
  };
  add(0,receivable,'借记',basis,'initial');add(0,'合同负债','贷记',basis,'initial');
  let accrued=0,refundAccrued=0;
  for(let d=0;d<=lastDay;d++){
   if(d===refundDay){
    refundAccrued=accrued;
    const refundBasis=o.editedNetIncome!==undefined?Math.min(basis,netRefund(o)):basis;
    const reversedRevenue=Math.min(accrued,Math.round(accrued*refundBasis/Math.max(1,basis)));
    // One full-refund event: reverse recognized revenue, remaining liability,
    // and the exact receivable recorded at initial allocation.
    add(d,'主营业务收入','借记',reversedRevenue,'refund',true);
    add(d,'合同负债','借记',refundBasis-reversedRevenue,'refund',true);
    add(d,receivable,'贷记',refundBasis,'refund',true);
    accrued-=reversedRevenue;
   }
   if(refundDay!==null&&d>=refundDay&&(revokeDay===null||d<revokeDay)&&!(o.editedNetIncome>0&&o.status==='已退款'))continue;
   if(d===revokeDay){
    add(d,receivable,'借记',basis);add(d,'合同负债','贷记',basis-refundAccrued);
    add(d,'主营业务收入','贷记',refundAccrued);accrued=refundAccrued;
   }
   const activeBasis=o.editedNetIncome!==undefined&&o.status==='已退款'&&d>=refundDay?o.editedNetIncome:basis;
   const target=Math.floor(activeBasis*Math.min(d+1,o.days)/o.days),amount=target-accrued;
   add(d,'主营业务收入','贷记',amount);add(d,'合同负债','借记',amount);accrued=target;
  }
  return rows;
 }
 const allocationStatuses=['待分摊','分摊中','完成分摊','分摊异常'];
 Object.assign(orders[0],{stage:'waiting'});
 Object.assign(orders[1],{stage:'matched'});
 Object.assign(orders[2],{stage:'queued'});
 // Pending examples: income only (2), full refund (3), partial refund (5).
 Object.assign(orders[3],{stage:'queued',refundKind:'full'});
 Object.assign(orders[5],{stage:'queued',status:'已退款',refundKind:'partial',reportNetRefund:400,refundAmount:512,refundTax:41});
 orders[5].refunds=[{id:'refund-5',timestamp:orders[5].refund,cents:400,amount:512,allocationStarted:false}];
 Object.assign(orders[6],{days:7});
 Object.assign(orders[8],{days:7,amountMismatch:true});
 Object.assign(orders[9],{failure:{date:'2026-09-20',step:'生成分摊分录',reason:'分摊服务临时不可用',attempts:1,persistent:false}});
 Object.assign(orders[10],{failure:{date:'2026-09-19',step:'生成退款分摊分录',reason:'退款分摊任务临时失败，平台应收账款待冲回',attempts:1,persistent:false}});
 Object.assign(orders[11],{failure:{date:'2026-09-19',step:'写入分摊记录',reason:'计提项映射缺失',attempts:3,persistent:true}});
 // Recent first-page examples for exercising the five-day reset window.
 for(const id of [4,6,7,8,9])orders[id].paid+=40*DAY;
 orders[6].days=3;
 orders[8].days=3;
 orders[9].failure.date='2026-10-30';
 const currencyByCountry={'美国':'USD','英国':'GBP','德国':'EUR','法国':'EUR','加拿大':'CAD','日本':'JPY','澳大利亚':'AUD','新加坡':'SGD'};
 for(const o of orders){
  o.currency=currencyByCountry[o.account];
  const factor=o.currency==='JPY'?(o.provider==='Google'?99900:100000)/o.price:1;
  const scale=n=>Math.round(n*factor*10);
  const appleRefund=o.provider==='Apple'?netRefund(o):null;
  for(const key of ['price','tax','commission','refundAmount','refundTax','reportNetRefund'])if(o[key]!==undefined)o[key]=scale(o[key]);
  if(appleRefund!==null)o.reportNetRefund=scale(appleRefund);
  for(const r of o.refunds){if(r.cents!==null)r.cents=scale(r.cents);r.amount=scale(r.amount);}
 }
 function updateAmounts(o,values){
  if(o.provider==='Apple'&&values.reportMatched===false){
   if(!Number.isSafeInteger(values.netIncome))throw Error('请输入有效净收入，最多保留 3 位小数');
   const basis=values.netIncome+(o.status==='已退款'?(netRefund(o)??0):0);
   Object.assign(o,{reportMatched:false,editedNetIncome:values.netIncome,incomeBasis:basis,commission:Math.max(0,(o.userPaid??o.price+o.tax)-o.tax-basis)});
   if(o.stage==='waiting')o.stage='queued';
   return;
  }
  const keys=o.provider==='Google'?['userPaid','tax','refundAmount','refundTax','netIncome']:['userPaid','refundAmount','netIncome','netRefund'];
  for(const key of keys){if(!Number.isSafeInteger(values[key]))throw Error('请输入有效金额，最多保留 3 位小数');if(key!=='netIncome'&&values[key]<0)throw Error('除净收入外，其他金额不能为负数');}
  if(o.provider==='Google'&&(values.tax>values.userPaid||values.refundTax>values.refundAmount))throw Error('税费不能大于对应支付或退款金额');
  if(values.refundAmount>values.userPaid)throw Error('退款金额不能大于用户支付金额');
  if(values.refundAmount>0&&!o.refund)throw Error('该订单暂无退款时间，不能新增退款金额');
  const refund=o.provider==='Google'?Math.round((values.refundAmount-values.refundTax)*.15):values.netRefund;
  if(o.provider==='Apple'&&refund>values.refundAmount)throw Error('净退款额不能大于退款金额');
  const next={...o,userPaid:values.userPaid,refundAmount:values.refundAmount,editedNetIncome:values.netIncome};
  if(o.provider==='Google'){next.tax=values.tax;next.refundTax=values.refundTax;}else{next.reportNetRefund=refund;next.reportMatched=values.reportMatched??true;}
  next.incomeBasis=values.netIncome+(o.status==='已退款'?refund:0);
  next.commission=Math.max(0,values.userPaid-next.tax-next.incomeBasis);
  if(next.stage==='waiting')next.stage='queued';
  next.refunds=(o.refunds||[]).map(r=>({...r}));
  const active=next.refunds.filter(r=>!r.allocationStarted),unique=[...new Map(active.map(r=>[r.id,r])).values()];
  let assigned=0;for(let i=0;i<unique.length;i++){const cents=i===unique.length-1?refund-assigned:Math.floor(refund/unique.length);assigned+=cents;for(const r of active)if(r.id===unique[i].id)r.cents=cents;}
  Object.assign(o,next);
 }
 function resetEligibility(o,now=Date.now()){
  const cutoff=latestAllocationTimestamp(o);
  if(cutoff===null)return {allowed:false,reason:'该订单暂无收入分摊截止时间，无法校验 15 天重置期限',cutoff};
  if(now<cutoff)return {allowed:false,reason:'收入分摊截止时间晚于当前时间，无法重置',cutoff};
  return {allowed:now-cutoff<=15*DAY,reason:now-cutoff<=15*DAY?'':'当前时间距收入分摊截止时间已超过 15 天，不允许重置分摊',cutoff};
 }
 function resetAllocation(o,values,now=Date.now()){
  const eligibility=resetEligibility(o,now);if(!eligibility.allowed)throw Error(eligibility.reason);
  const previous=ledger(o),next=JSON.parse(JSON.stringify(o));
  updateAmounts(next,values);
  delete next.stage;delete next.resetLedger;delete next.editedAllocationStatus;
  if(next.failure&&!next.failure.persistent)delete next.failure;
  next.allocationAsOf=now;
  const batch=(o.resetCount??0)+1;
  const rebuilt=[];
  next.resetPending=true;next.stage='queued';
  next.deletedLedger=[...(o.deletedLedger||[]),...previous.map((r,i)=>({...r,id:r.id??`${o.id}-original-${i}`,deleted:true,deletedAt:now,resetBatch:batch}))];
  next.resetLedger=rebuilt;next.resetCount=batch;next.lastResetAt=now;
  Object.assign(o,next);
  return {deletedCount:previous.length,generatedCount:rebuilt.length};
 }
 function editLedger(o,selection,direction,amount){
  if(!['借记','贷记'].includes(direction))throw Error('请选择资金方向');
  if(!Number.isSafeInteger(amount)||amount<0)throw Error('金额须为非负数，最多保留 3 位小数');
  const rows=ledger(o).map(r=>({...r})),preservedStatus=allocationStatus(o),now=Date.now(),revision=(o.ledgerEditRevision??0)+1;let index=selection.index;
  let monthlyPrevious=null;
  if(selection.tab==='monthly'){
   monthlyPrevious=monthly(rows).find(r=>r.date===selection.date&&r.account===selection.account);
   const indices=rows.map((r,i)=>r.date.slice(0,7)===selection.date&&r.account===selection.account?i:-1).filter(i=>i>=0);
   if(!indices.length)throw Error('记录已变更，请重新打开编辑弹窗');
   index=indices[indices.length-1];
   const net=indices.reduce((sum,i)=>sum+(rows[i].direction==='借记'?rows[i].cents:-rows[i].cents),0);
   const old=rows[index],target=(direction==='借记'?amount:-amount)-net+(old.direction==='借记'?old.cents:-old.cents);
   direction=target<0?'贷记':target>0?'借记':direction;amount=Math.abs(target);
  }
  if(!rows[index])throw Error('记录已变更，请重新打开编辑弹窗');
  const previous={...rows[index],id:rows[index].id??`${o.id}-original-${index}`};
  rows[index]={...previous,id:`${o.id}-edit-${revision}`,direction,cents:amount,deleted:false,replacesId:previous.id};
  o.deletedLedger=[...(o.deletedLedger||[]),{...previous,deleted:true,deletedAt:now}];
  if(monthlyPrevious){
   const updated=monthly(rows).find(r=>r.date===selection.date&&r.account===selection.account)??{...monthlyPrevious,direction,cents:0};
   o.monthlyEditHistory=[...(o.monthlyEditHistory||[]),{previous:{...monthlyPrevious,deleted:true,deletedAt:now},replacement:{...updated,deleted:false,timestamp:monthlyPrevious.timestamp}}];
  }
  o.ledgerEdits=[...(o.ledgerEdits||[]),{timestamp:now,previous:{...previous,deleted:true},updated:{...rows[index]}}];
  o.ledgerEditRevision=revision;o.editedAllocationStatus=preservedStatus;
  o.resetLedger=rows;
 }
 function addManualRecord(o,{date,account,direction,cents},zone=PACIFIC){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('请选择有效统计日期');
  if(!['平台应收账款','合同负债','主营业务收入','财务费用'].includes(account))throw Error('请选择计提项');
  if(!['借记','贷记'].includes(direction))throw Error('请选择资金方向');
  if(!Number.isSafeInteger(cents)||cents<0)throw Error('请输入非负金额，最多保留 3 位小数');
  const rows=ledger(o).map(r=>({...r})),status=allocationStatus(o),timestamp=dayEndTimestamp(date,zone);
  const record={id:`${o.id}-manual-${Date.now()}-${o.manualSequence=(o.manualSequence||0)+1}`,date:dateInZone(timestamp),timestamp,account,direction,cents,manual:true,deleted:false};
  o.resetLedger=[...rows,record].sort((a,b)=>a.timestamp-b.timestamp);o.editedAllocationStatus=status;
  return record;
 }
 function addManualRecords(o,{startDate,endDate,account,direction,cents},zone=PACIFIC){
  const valid=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
  if(!valid(startDate))throw Error('请选择统计开始时间');
  if(!valid(endDate))throw Error('请选择有效统计结束时间');
  if(endDate<startDate)throw Error('统计结束时间不能早于统计开始时间');
  if(!['平台应收账款','合同负债','主营业务收入','财务费用'].includes(account))throw Error('请选择计提项');
  if(!['借记','贷记'].includes(direction))throw Error('请选择资金方向');
  if(!Number.isSafeInteger(cents)||cents<0)throw Error('请输入非负金额，最多保留 3 位小数');
  const dates=[];for(let day=Date.parse(startDate+'T00:00:00Z'),last=Date.parse(endDate+'T00:00:00Z');day<=last;day+=DAY)dates.push(new Date(day).toISOString().slice(0,10));
  return dates.map(date=>addManualRecord(o,{date,account,direction,cents},zone));
 }
 function deleteManualRecord(o,id){
  const rows=ledger(o).map(r=>({...r})),record=rows.find(r=>r.id===id&&r.manual);
  if(!record)throw Error('仅人工添加记录允许删除');
  const status=allocationStatus(o);record.deleted=true;record.deletedAt=Date.now();
  o.deletedLedger=[...(o.deletedLedger||[]),{...record}];o.resetLedger=rows;o.editedAllocationStatus=status;
 }
 function ledger(o){
  if(o.resetLedger)return o.resetLedger.filter(r=>!r.deleted);
  if(!eligible(o)||['waiting','matched','queued'].includes(o.stage))return [];
  let rows=buildLedger(o);
  if(o.failure)rows=rows.filter(r=>r.date<o.failure.date);
  if(o.amountMismatch){rows=rows.map((r,i)=>i===0?{...r,cents:r.cents+1}:r);}
  return rows;
 }
 function reconciliation(o){const rows=ledger(o);const total=(name,normal)=>rows.filter(r=>r.account===name).reduce((s,r)=>s+(r.direction===normal?r.cents:-r.cents),0);const receivable=total('平台应收账款','借记'),financialExpenses=total('财务费用','借记'),revenue=total('主营业务收入','贷记');return {receivable,financialExpenses,revenue,difference:receivable+financialExpenses-revenue};}
 function entitlementExpiry(o){return o.expiresAt??dayEndTimestamp(new Date(Date.parse(dateInZone(o.paid)+'T00:00:00Z')+(o.days-1)*DAY).toISOString().slice(0,10));}
 function allocationStatus(o){
  if(!eligible(o))return null;
  if(o.resetPending)return '待分摊';
  if(o.editedAllocationStatus)return o.editedAllocationStatus;
  if(o.failure)return '分摊异常';
  const registered=latestAllocationTimestamp(o);
  if(registered===null)return '待分摊';
  if(entitlementExpiry(o)<=registered||balances(o).liability===0)return '完成分摊';
  return '分摊中';
 }
 function anomalyRemark(o){if(o.failure)return o.failure.reason;return allocationStatus(o)==='完成分摊'&&reconciliation(o).difference!==0?'完成分摊（金额异常）':'';}
 function retry(o){
  if(!o.failure)return false;
  o.failure.attempts++;
  if(o.failure.persistent)return false;
  o.lastRetry={date:o.failure.date,attempts:o.failure.attempts};
  delete o.failure;
  return true;
 }

 function monthly(rows){const manual=rows.filter(r=>r.manual).map(r=>({...r}));rows=rows.filter(r=>!r.manual);const groups=new Map(),accounts=[...new Set(rows.map(r=>r.account))],months=[...new Set(rows.map(r=>r.date.slice(0,7)))];for(const date of months)for(const account of accounts)groups.set(date+'|'+account,{date,account,net:0});for(const r of rows){const month=r.date.slice(0,7),key=month+'|'+r.account;const g=groups.get(key)||{date:month,account:r.account,net:0};g.net+=(r.direction==='借记'?1:-1)*r.cents;groups.set(key,g);}return [...groups.values()].filter(g=>!(g.account==='平台应收账款'&&g.net===0)).map(g=>({date:g.date,timestamp:dayEndTimestamp(new Date(Date.UTC(Number(g.date.slice(0,4)),Number(g.date.slice(5,7)),0)).toISOString().slice(0,10)),account:g.account,direction:g.net>0?'借记':g.net<0?'贷记':g.account.startsWith('平台应收账款')?'贷记':'借记',cents:Math.abs(g.net)})).concat(manual).sort((a,b)=>a.timestamp-b.timestamp);}
 function balances(o){
  const proceeds=netIncome(o),rows=ledger(o);
  // Only committed daily records are exposed by ledger; failed dates are excluded.
  if(!rows.length)return {receivable:proceeds,liability:o.resetPending?0:(proceeds??0),revenue:0,financialExpenses:0};
  const total=(account,normal)=>rows.filter(r=>r.account===account).reduce((sum,r)=>sum+(r.direction===normal?r.cents:-r.cents),0);
  const receivable=total('平台应收账款','借记');
  const revenue=total('主营业务收入','贷记');
  return {receivable,liability:receivable-revenue,revenue,financialExpenses:total('财务费用','借记')};
 }
 function firstAllocationTimestamp(o){const rows=ledger(o);return rows.length?rows[0].timestamp:null;}
 function latestAllocationTimestamp(o){const rows=ledger(o);return rows.length?rows[rows.length-1].timestamp:null;}
 function latestAllocationTime(o,zone=PACIFIC){return formatTime(latestAllocationTimestamp(o),zone);}

 return {orders,countries,addManualRecord,addManualRecords,deleteManualRecord,editLedger,resetEligibility,resetAllocation,updateAmounts,incomeBasis,ledger,monthly,balances,netIncome,netRefund,asOf,eligible,allocationStatuses,allocationStatus,anomalyRemark,entitlementExpiry,reconciliation,retry,firstAllocationTimestamp,latestAllocationTime,latestAllocationTimestamp,formatTime,dateInZone,dayEndTimestamp,pendingIncome,pendingRefunds,pendingRefundEntries};
})();
if(typeof module!=='undefined')module.exports=FinanceModel;
