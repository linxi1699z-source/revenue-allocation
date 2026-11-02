const $=s=>document.querySelector(s), money=n=>n===null?'<span class="pending-amount">待匹配</span>':(n/1000).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:3});
const state={filtered:[...FinanceModel.orders],page:1,size:10,detailPage:1,detailSize:10,tab:'daily',order:null,timezone:'America/Los_Angeles',pendingOrder:null,ledgerFilters:{daily:{},monthly:{}}};
$('#allocation-cutoff').textContent=`收入分摊截止时间：${FinanceModel.incomeCutoffDate()} 23:59:59（太平洋时间）`;
const time=n=>n===null||n===undefined?'—':`<span class="timezone-value">${FinanceModel.formatTime(n,state.timezone).slice(0,16)}</span>`;
const allocationDate=(o,first=false)=>{const timestamp=first?FinanceModel.firstAllocationTimestamp(o):FinanceModel.latestAllocationTimestamp(o);return timestamp===null?'—':`<span class="timezone-value">${FinanceModel.formatTime(timestamp,state.timezone).slice(0,16)}</span>`;};
let timezoneFeedbackTimer;
$('#timezone').onchange=e=>{
 if(state.timezone===e.target.value)return;
 state.timezone=e.target.value;
 $('#search-form').requestSubmit();if(state.pendingOrder)renderPending();if(state.order)renderDetail();
 clearTimeout(timezoneFeedbackTimer);
 const notice=$('#timezone-notice');notice.textContent='已切换至 '+state.timezone+'，时间已更新';notice.hidden=false;
 document.body.classList.remove('timezone-updated');
 void notice.offsetWidth;
 document.body.classList.add('timezone-updated');
 timezoneFeedbackTimer=setTimeout(()=>{document.body.classList.remove('timezone-updated');notice.hidden=true;},3200);
};
for(const id of ['user-country','account-country']){const box=$('#'+id);box.innerHTML=`<button type="button" class="multi-select-toggle" aria-expanded="false" aria-label="${id==='user-country'?'用户国家':'应用商店账号国家'}">请选择</button><div class="multi-select-menu">${FinanceModel.countries.map(c=>`<label class="multi-option"><input type="checkbox" value="${c}">${c}</label>`).join('')}</div>`;box.querySelector('button').onclick=()=>{const open=!box.classList.contains('open');document.querySelectorAll('.multi-select').forEach(b=>{b.classList.remove('open');b.querySelector('button').setAttribute('aria-expanded','false');});box.classList.toggle('open',open);box.querySelector('button').setAttribute('aria-expanded',String(open));};}
document.addEventListener('click',e=>{if(!e.target.closest('.multi-select'))document.querySelectorAll('.multi-select').forEach(b=>{b.classList.remove('open');b.querySelector('button').setAttribute('aria-expanded','false');});});
$('.finance').onclick=()=>{const hidden=!$('#finance-nav').hidden;$('#finance-nav').hidden=hidden;$('.finance').setAttribute('aria-expanded',String(!hidden));};
document.querySelector('select[name=allocationStatus]').innerHTML+=FinanceModel.allocationStatuses.map(s=>`<option>${s}</option>`).join('');
const allocationBadge=(o,interactive=false)=>{const label=FinanceModel.allocationStatus(o);if(interactive&&label==='待分摊')return `<button type="button" class="allocation-badge pending-state-link" data-pending-id="${o.id}" title="查看待分摊明细">待分摊</button>`;return `<span class="allocation-badge ${label?.includes('异常')?'error':label==='完成分摊'?'complete':''}">${label||'不参与分摊'}</span>`;};
const headers=['支付订单ID','平台订单ID','产品ID','支付服务商','订单状态','收入分摊状态','币种','产品价格','用户支付金额','税费','不含税收入','渠道佣金','退款金额','退款税费','净退款额','净收入','已确认收入','合同负债','财务费用','用户国家','应用商店账号国家','折扣类型','首次收入登记时间','收入分摊截止时间','支付时间','退款时间','异常备注','操作'];
$('#order-head').innerHTML='<tr>'+headers.map((h,i)=>`<th class="${i>=7&&i<=18?'money':''}">${h}</th>`).join('')+'</tr>';
const badge=o=>`<span class="status ${o.status==='已退款'?'refunded':o.status==='退款撤销'?'revoked':''}">${o.status}</span>`;
function paginate(id,total,detail=false){const pageKey=detail?'detailPage':'page',sizeKey=detail?'detailSize':'size',pages=Math.max(1,Math.ceil(total/state[sizeKey]));state[pageKey]=Math.min(state[pageKey],pages);const page=state[pageKey],visible=[...new Set([1,page-1,page,page+1,pages])].filter(n=>n>0&&n<=pages).sort((a,b)=>a-b);let last=0;$('#'+id).innerHTML=`<span>共 ${total} 条</span><select aria-label="${detail?'明细':'列表'}每页条数">${[10,20,50].map(n=>`<option value="${n}" ${state[sizeKey]===n?'selected':''}>${n} 条/页</option>`).join('')}</select><button data-page="${page-1}" aria-label="上一页" ${page===1?'disabled':''}>‹</button>`+visible.map(n=>{const gap=last&&n-last>1?' <span>•••</span> ':'';last=n;return gap+`<button data-page="${n}" class="${n===page?'current':''}" ${n===page?'aria-current="page"':''}>${n}</button>`;}).join('')+`<button data-page="${page+1}" aria-label="下一页" ${page===pages?'disabled':''}>›</button><span>跳至</span><input type="number" min="1" max="${pages}" value="${page}" aria-label="跳转页码"><span>页</span><button class="jump">确定</button>`;const el=$('#'+id),render=detail?renderDetail:renderList;el.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state[pageKey]=Number(b.dataset.page);render();});el.querySelector('select').onchange=e=>{state[sizeKey]=Number(e.target.value);state[pageKey]=1;render();};const jump=()=>{const n=Number(el.querySelector('input').value);if(Number.isInteger(n)&&n>=1&&n<=pages){state[pageKey]=n;render();}else el.querySelector('input').reportValidity();};el.querySelector('.jump').onclick=jump;el.querySelector('input').onkeydown=e=>{if(e.key==='Enter')jump();};}
function renderList(){paginate('list-pagination',state.filtered.length);const rows=state.filtered.slice((state.page-1)*state.size,state.page*state.size);$('#order-body').innerHTML=rows.map(o=>{const b=FinanceModel.balances(o);const cells=[o.order,o.platform,o.product,`<span class="provider ${o.provider.toLowerCase()}"><i>${o.provider[0]}</i>${o.provider}</span>`,badge(o),allocationBadge(o,true),o.currency,... [o.price,o.userPaid??o.price+o.tax,o.tax,(o.userPaid??o.price+o.tax)-o.tax,o.commission,o.refund?(o.refundAmount??o.price+o.tax):0,o.refund?(o.refundTax??o.tax):0,FinanceModel.netRefund(o),FinanceModel.netIncome(o),b.revenue,b.liability,b.financialExpenses].map(v=>money(v)),o.country,o.account,o.discountType,allocationDate(o,true),allocationDate(o),time(o.paid),time(o.refund),FinanceModel.anomalyRemark(o)||'—',`<a class="order-action" href="#detail/${o.id}">分摊明细</a>`];return '<tr>'+cells.map((c,i)=>`<td ${i<3?`title="${String(c).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"`:''} class="${i>=7&&i<=18?'money':i<3?'order-id':''}">${c}</td>`).join('')+'</tr>';}).join('')||'<tr><td colspan="28" class="empty-cell">暂无符合条件的订单，请调整筛选条件或重置</td></tr>';}
$('#search-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),get=k=>String(f.get(k)||'').trim();for(const prefix of ['pay','refund'])if(get(prefix+'Start')&&get(prefix+'End')&&get(prefix+'Start')>get(prefix+'End')){$('#search-error').textContent=(prefix==='pay'?'支付':'退款')+'开始日期不能晚于结束日期';return;}$('#search-error').textContent='';const selected=id=>[...document.querySelectorAll('#'+id+' input:checked')].map(i=>i.value),uc=selected('user-country'),ac=selected('account-country');const inRange=(n,prefix)=>{const s=get(prefix+'Start'),end=get(prefix+'End');if(!s&&!end)return true;if(!n)return false;const date=FinanceModel.dateInZone(n,state.timezone);return (!s||date>=s)&&(!end||date<=end);};state.filtered=FinanceModel.orders.filter(o=>FinanceModel.eligible(o)&&(!get('allocationStatus')||FinanceModel.allocationStatus(o)===get('allocationStatus'))&&o.order.toLowerCase().includes(get('order').toLowerCase())&&o.platform.toLowerCase().includes(get('platform').toLowerCase())&&o.product.toLowerCase().includes(get('product').toLowerCase())&&(!get('status')||o.status===get('status'))&&(!get('provider')||o.provider===get('provider'))&&(!get('discountType')||o.discountType===get('discountType'))&&(!uc.length||uc.includes(o.country))&&(!ac.length||ac.includes(o.account))&&inRange(o.paid,'pay')&&inRange(o.refund,'refund'));state.page=1;renderList();};
function setDefaultPaymentDates(){
 const current=FinanceModel.dateInZone(Date.now(),state.timezone),[year,month]=current.split('-').map(Number),start=new Date(year,month-2,1);
 const dateValue=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 $('#search-form').elements.payStart.value=dateValue(start);
 $('#search-form').elements.payEnd.value=current;
 syncRangeLabels();
}
$('#search-form').onreset=()=>{setTimeout(()=>{$('#search-error').textContent='';state.filtered=[...FinanceModel.orders];state.page=1;document.querySelectorAll('.multi-select').forEach(b=>b.classList.remove('open'));document.querySelectorAll('.multi-select input').forEach(i=>i.dispatchEvent(new Event('change',{bubbles:true})));setDefaultPaymentDates();$('#search-form').requestSubmit();});};
function renderDetail(){const o=state.order;if(!o)return;const b=FinanceModel.allocationStatus(o)==='待分摊'?{receivable:0,liability:0,revenue:0}:FinanceModel.balances(o);const noAllocationActions=['免费试用','赠送'].includes(o.discountType);$('#ledger-add').hidden=noAllocationActions||FinanceModel.allocationStatus(o)!=='分摊异常';$('#ledger-complete').hidden=noAllocationActions;$('#ledger-complete').disabled=FinanceModel.allocationStatus(o)==='完成分摊';$('#detail-summary').innerHTML=`<h2>${o.order} ${allocationBadge(o)} ${badge(o)}</h2><div class="summary-grid">${[['平台订单ID',o.platform],['产品ID',o.product],['支付服务商',o.provider],['币种',o.currency],['支付时间',time(o.paid)],['净收入',money(FinanceModel.netIncome(o))],['平台应收账款',money(b.receivable)],['合同负债',money(b.liability)],['已确认收入',money(b.revenue)]].map(([t,v])=>`<div class="summary-item"><span>${t}${['平台应收账款','合同负债','已确认收入'].includes(t)?' <button type="button" class="info-icon" data-tooltip="每日执行分摊程序后更新。" aria-label="每日执行分摊程序后更新。">ⓘ</button>':''}</span><strong>${v}</strong></div>`).join('')}</div>`;let rows=FinanceModel.ledger(o).map((r,index)=>({...r,index}));if(state.tab==='monthly')rows=FinanceModel.monthly(rows);rows.sort((a,b)=>b.timestamp-a.timestamp);const filters=state.ledgerFilters[state.tab];rows=rows.filter(r=>{const local=FinanceModel.formatTime(r.timestamp,state.timezone).slice(0,10);return (!filters.start||local>=filters.start)&&(!filters.end||local<=filters.end)&&(!filters.account||r.account===filters.account)&&(!filters.direction||r.direction===filters.direction);});document.querySelectorAll('[data-ledger-filter]').forEach(button=>{const key=button.dataset.ledgerFilter;button.classList.toggle('filter-active',key==='date'?!!(filters.start||filters.end):!!filters[key]);});document.querySelectorAll('[data-tab]').forEach(t=>{t.classList.toggle('selected',t.dataset.tab===state.tab);t.setAttribute('aria-selected',String(t.dataset.tab===state.tab));});state.visibleLedger=rows;paginate('detail-pagination',rows.length,true);$('#ledger-body').innerHTML=rows.slice((state.detailPage-1)*state.detailSize,state.detailPage*state.detailSize).map((r,i)=>`<tr><td>${time(r.timestamp)}</td><td><span class="account-name">${r.account}</span>${state.tab==='daily'&&r.manual?' <span class="manual-tag">人工添加</span>':''}${r.event==='refund'?' <span class="refund-note">全额退款</span>':''}</td><td><span class="direction ${r.direction==='贷记'?'credit':''}">${r.direction}</span></td><td>${o.currency}</td><td class="money">${money(r.cents)}</td><td><button type="button" class="ledger-edit" data-ledger-edit="${(state.detailPage-1)*state.detailSize+i}">编辑</button> <button type="button" class="ledger-edit" ${r.manual?`data-ledger-delete="${r.id}"`:'disabled'}>删除</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty-cell">尚未生成分摊记录</td></tr>';}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.detailPage=1;renderDetail();});$('#back').onclick=()=>location.hash='income';
function renderPending(){
 const o=state.pendingOrder;if(!o)return;
 const income=FinanceModel.pendingIncome(o),refunds=FinanceModel.pendingRefunds(o);
 $('#pending-income-body').innerHTML=income.map(r=>`<tr><td>${r.order}</td><td>${r.platform}</td><td class="money">${money(r.cents)}${r.cents===null?'':' '+o.currency}</td><td>${time(r.timestamp)}</td></tr>`).join('')||'<tr><td colspan="4" class="pending-empty">暂无待分摊收入</td></tr>';
 $('#pending-refund-body').innerHTML=refunds.map(r=>`<tr><td>${r.order}</td><td>${r.platform}</td><td class="money">${money(r.cents)}${r.cents===null?'':' '+o.currency}</td><td><div class="refund-group-date">${r.date}（太平洋日期）</div>${r.timestamps.map(t=>`<div>${time(t)}</div>`).join('')}</td></tr>`).join('')||'<tr><td colspan="4" class="pending-empty">暂无待分摊退款</td></tr>';
}
$('#order-body').onclick=e=>{const edit=e.target.closest('[data-edit-id]');if(edit){openAmountEditor(Number(edit.dataset.editId));return;}const button=e.target.closest('[data-pending-id]');if(!button)return;const order=FinanceModel.orders.find(o=>o.id===Number(button.dataset.pendingId));if(!order||FinanceModel.allocationStatus(order)!=='待分摊')return;state.pendingOrder=order;renderPending();$('#pending-dialog').showModal();};
$('#pending-close').onclick=$('#pending-done').onclick=()=>$('#pending-dialog').close();
$('#pending-dialog').addEventListener('close',()=>{state.pendingOrder=null;});
$('#pending-dialog').onclick=e=>{if(e.target===$('#pending-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
function route(){
 const hash=location.hash.slice(1),detail=hash.startsWith('detail/'),bills=hash==='bills',payment=hash==='orders';
 $('#payment-view').hidden=!payment;$('#payment-site').hidden=!payment;$('.timezone-field').hidden=payment;$('#payment-nav').classList.toggle('active',payment);$('#payment-center-label').classList.toggle('payment-active',payment);if(payment)PaymentPage.render();

 if(detail){state.order=FinanceModel.orders.find(o=>o.id===Number(hash.split('/')[1]));if(!state.order){location.hash='income';return;}state.tab='daily';state.detailPage=1;renderDetail();}
 else state.order=null;
 $('.page-heading').hidden=!bills;$('#list-view').hidden=detail||bills||payment;$('#detail-view').hidden=!detail;$('#bills-view').hidden=!bills;
 const title=bills?'账单汇总':detail?'分摊明细':'收入明细';
 $('#page-title').textContent=title;$('#page-subtitle').textContent=bills?'订阅业务账单管理':detail?'查看订单对应的收入确认与借贷记录':'查询订阅订单收入，追踪每日与每月的分摊记录';
 $('#breadcrumb').innerHTML='财务中心 <b>›</b> '+(detail?'<a href="#income">收入明细</a> <b>›</b> '+title:title);
 if(payment)$('#breadcrumb').innerHTML='首页 <b>›</b> 支付中心 <b>›</b> 订单管理';
 document.querySelectorAll('#finance-nav a').forEach(a=>a.classList.toggle('active',!payment&&(bills?a.hash==='#bills':a.hash==='#income')));
}
window.addEventListener('hashchange',route);setDefaultPaymentDates();$('#search-form').requestSubmit();route();

// UTF-8 CSV files in a standards-compliant ZIP (stored entries, no dependencies).
function exportCsv(rows){return '\ufeff'+rows.map(row=>row.map(value=>{let text=String(value??'');if(/^[=+@\t\r]/.test(text)||(/^-/ .test(text)&&!/^-[\d,.]+$/.test(text)))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
function exportZip(files){
 const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
 const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
 for(const file of files){
  const name=encoder.encode(file.name),data=encoder.encode(file.text),crc=crc32(data);
  const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);
  const entry=new Uint8Array(46+name.length),c=new DataView(entry.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,33,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);entry.set(name,46);
  parts.push(local,data);central.push(entry);offset+=local.length+data.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,central.reduce((sum,p)=>sum+p.length,0),true);e.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
function incomeExportFiles(orders,start,end,zone){
 const amount=n=>n===null?'待匹配':String(Number((n/1000).toFixed(3))),stamp=n=>FinanceModel.formatTime(n,zone).slice(0,16),date=n=>n===null?'—':FinanceModel.formatTime(n,zone).slice(0,16);
 const orderRows=[headers.slice(0,-1)],daily=[['支付订单ID','平台订单ID','统计时间','计提项','资金方向','币种','金额']],monthly=[['支付订单ID','平台订单ID','统计时间','计提项','资金方向','币种','金额']];
 for(const o of orders){
  const rows=FinanceModel.ledger(o).filter(r=>r.date>=start&&r.date<=end);if(!rows.length)continue;
  const b=FinanceModel.balances(o);
  orderRows.push([o.order,o.platform,o.product,o.provider,o.status,FinanceModel.allocationStatus(o),o.currency,...[o.price,o.userPaid??o.price+o.tax,o.tax,(o.userPaid??o.price+o.tax)-o.tax,o.commission,o.refund?(o.refundAmount??o.price+o.tax):0,o.refund?(o.refundTax??o.tax):0,FinanceModel.netRefund(o),FinanceModel.netIncome(o),b.revenue,b.liability,b.financialExpenses].map(amount),o.country,o.account,o.discountType,date(FinanceModel.firstAllocationTimestamp(o)),date(FinanceModel.latestAllocationTimestamp(o)),stamp(o.paid),stamp(o.refund),FinanceModel.anomalyRemark(o)||'—']);
  const record=r=>[o.order,o.platform,stamp(r.timestamp),r.account,r.direction,o.currency,amount(r.cents)];
  daily.push(...rows.map(record));monthly.push(...FinanceModel.monthly(rows).map(record));
 }
 if(orderRows.length===1)return [];
 return [{name:'订单明细.csv',text:exportCsv(orderRows)},{name:'分摊明细/日明细.csv',text:exportCsv(daily)},{name:'分摊明细/月明细.csv',text:exportCsv(monthly)}];
}
$('#export-open').onclick=()=>{$('#export-error').textContent='';$('#export-dialog').showModal();};
for(const id of ['export-close','export-cancel'])$('#'+id).onclick=()=>$('#export-dialog').close();
$('#export-dialog').onclick=e=>{if(e.target===$('#export-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
$('#export-form').onsubmit=e=>{
 e.preventDefault();const form=e.target,start=form.elements.start.value,end=form.elements.end.value,error=$('#export-error');
 if(!start||!end){error.textContent='请选择导出时间范围';return;}
 if(start>end){error.textContent='开始日期不能晚于结束日期';return;}
 const files=incomeExportFiles(state.filtered,start,end,state.timezone);
 if(!files.length){error.textContent='所选时间范围内暂无可导出的分摊数据';return;}
 try{const url=URL.createObjectURL(exportZip(files)),a=document.createElement('a');a.href=url;a.download=`收入分摊_${start}_${end}.zip`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#export-dialog').close();}catch(err){error.textContent='导出失败，请重试';}
};

let amountOrder=null;
const editableAmountFields=o=>o.provider==='Google'?[['userPaid','用户支付金额'],['tax','税费'],['refundAmount','退款金额'],['refundTax','退款税费'],['netIncome','净收入']]:[['userPaid','用户支付金额'],['refundAmount','退款金额'],['netIncome','净收入'],['netRefund','净退款额']];
function openAmountEditor(id){
 const o=FinanceModel.orders.find(order=>order.id===id);if(!o)return;amountOrder=o;
 $('#amount-form').reset();$('#amount-error').textContent='';
 $('#amount-meta').innerHTML=[['支付订单ID',o.order],['平台订单ID',o.platform],['产品 ID',o.product],['产品价格',money(o.price)],['币种',o.currency],['收入分摊截止时间',time(FinanceModel.latestAllocationTimestamp(o))]].map(([name,value])=>`<div class="summary-item"><span>${name}</span><strong>${value}</strong></div>`).join('');
 const values={userPaid:o.userPaid??o.price+o.tax,tax:o.tax,refundAmount:o.refund?(o.refundAmount??o.price+o.tax):0,refundTax:o.refund?(o.refundTax??o.tax):0,netIncome:FinanceModel.netIncome(o),netRefund:FinanceModel.netRefund(o)};
 $('#amount-fields').innerHTML=editableAmountFields(o).map(([key,label])=>`<label>${label}<input name="${key}" inputmode="decimal" type="text" required value="${Number(((values[key]??0)/1000).toFixed(3))}" placeholder="请输入金额"></label>`).join('');
 $('#amount-apple-option').hidden=o.provider!=='Apple';$('#amount-form').elements.reportMatched.value=(o.reportMatched??!o.unmatchedOverThreeDays)?'yes':'no';syncAmountFields();const eligibility=FinanceModel.resetEligibility(o);$('#reset-eligibility').textContent=eligibility.allowed?'重置后原分摊记录将标记删除，已确认收入、合同负债、财务费用清零，等待重新分摊。':eligibility.reason;$('#amount-form').querySelector('[type=submit]').disabled=!eligibility.allowed;$('#amount-dialog').showModal();
}
for(const id of ['amount-close','amount-cancel'])$('#'+id).onclick=()=>$('#amount-dialog').close();
$('#amount-dialog').addEventListener('close',()=>{amountOrder=null;});
$('#amount-form').onsubmit=e=>{
 e.preventDefault();if(!amountOrder)return;const form=e.target,values={};
 for(const [key,label] of editableAmountFields(amountOrder).filter(([key])=>amountOrder.provider!=='Apple'||form.elements.reportMatched.value==='yes'||key==='netIncome')){
  const raw=form.elements[key].value.trim();
  const valid=key==='netIncome'?/^-?\d+(?:\.\d{1,3})?$/.test(raw):/^\d+(?:\.\d{1,3})?$/.test(raw);
  if(!valid){$('#amount-error').textContent=label+(key==='netIncome'?'请输入有效金额，最多保留 3 位小数':'请输入非负金额，最多保留 3 位小数');form.elements[key].focus();return;}
  values[key]=Math.round(Number(raw)*1000);
 }
 values.reportMatched=form.elements.reportMatched.value==='yes';
 if(amountOrder.provider==='Apple'&&values.reportMatched&&values.netRefund>values.refundAmount){$('#amount-error').textContent='净退款额不能大于退款金额';form.elements.netRefund.focus();return;}
 try{const result=FinanceModel.resetAllocation(amountOrder,values);$('#reset-result').textContent=`重置分摊完成：原 ${result.deletedCount} 条记录已标记删除，已确认收入、合同负债、财务费用已清零，等待重新分摊。`;$('#reset-result').hidden=false;}catch(error){$('#amount-error').textContent=error.message;return;}
 $('#amount-dialog').close();$('#search-form').requestSubmit();if(state.order)renderDetail();if(state.pendingOrder)renderPending();
};

function syncAmountFields(){
 const incomeOnly=amountOrder?.provider==='Apple'&&$('#amount-form').elements.reportMatched.value==='no';
 document.querySelectorAll('#amount-fields input').forEach(input=>{const hidden=incomeOnly&&input.name!=='netIncome';input.closest('label').hidden=hidden;input.disabled=hidden;});
 $('#amount-error').textContent='';
}
$('#amount-apple-option').onchange=syncAmountFields;

for(const button of document.querySelectorAll('[data-ledger-filter]'))button.addEventListener('click',()=>{
 const key=button.dataset.ledgerFilter,popup=$('#ledger-filter-'+key),form=popup.querySelector('form'),filters=state.ledgerFilters[state.tab],rect=button.getBoundingClientRect();
 for(const input of form.querySelectorAll('input,select')){input.value=filters[input.name]||'';input.dispatchEvent(new Event('change',{bubbles:true}));}
 const error=form.querySelector('.filter-error');if(error)error.textContent='';
 syncRangeLabels();
 popup.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-296))+'px';popup.style.top=Math.max(8,Math.min(rect.bottom+8,window.innerHeight-300))+'px';
});
for(const form of document.querySelectorAll('[data-filter-form]')){
 const key=form.dataset.filterForm;
 form.onsubmit=e=>{e.preventDefault();const data=new FormData(form),filters=state.ledgerFilters[state.tab];
  if(key==='date'){const start=String(data.get('start')||''),end=String(data.get('end')||'');if(start&&end&&start>end){form.querySelector('.filter-error').textContent='开始时间不能晚于结束时间';return;}filters.start=start;filters.end=end;}
  else filters[key]=String(data.get(key)||'');
  state.detailPage=1;form.parentElement.hidePopover();renderDetail();
 };
 form.querySelector('[data-filter-reset]').onclick=()=>{const filters=state.ledgerFilters[state.tab];if(key==='date'){delete filters.start;delete filters.end;}else delete filters[key];state.detailPage=1;form.parentElement.hidePopover();renderDetail();};
}

let editingLedger=null;
$('#ledger-body').onclick=e=>{
 const remove=e.target.closest('[data-ledger-delete]');if(remove){manualDeleteId=remove.dataset.ledgerDelete;const rows=FinanceModel.ledger(state.order),record=rows.find(r=>r.id===manualDeleteId&&r.manual);if(!record)return;const count=rows.filter(r=>r.manual&&(r.batchId??r.id)===(record.batchId??record.id)).length;$('#manual-delete-title').textContent=count>1?`确认删除同批次的 ${count} 条记录吗？`:'确认删除对应记录吗？';$('#manual-delete-dialog').showModal();return;}
 const button=e.target.closest('[data-ledger-edit]');if(!button)return;
 const record=state.visibleLedger[Number(button.dataset.ledgerEdit)];if(!record)return;
 editingLedger={order:state.order,selection:{tab:record.manual?'daily':state.tab,index:record.manual?FinanceModel.ledger(state.order).findIndex(r=>r.id===record.id):record.index,date:record.date,account:record.account}};
 $('#ledger-edit-meta').innerHTML=[['统计日期',time(record.timestamp)],['计提项',record.account],['币种',state.order.currency]].map(([label,value])=>`<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`).join('');
 const form=$('#ledger-edit-form');form.elements.direction.value=record.direction;form.elements.amount.value=Number((record.cents/1000).toFixed(3));$('#ledger-edit-error').textContent='';$('#ledger-edit-dialog').showModal();
};
for(const id of ['ledger-edit-close','ledger-edit-cancel'])$('#'+id).onclick=()=>$('#ledger-edit-dialog').close();
$('#ledger-edit-dialog').addEventListener('close',()=>{editingLedger=null;});
$('#ledger-edit-form').onsubmit=e=>{
 e.preventDefault();if(!editingLedger)return;const form=e.target,raw=form.elements.amount.value.trim();
 if(!/^\d+(?:\.\d{1,3})?$/.test(raw)){$('#ledger-edit-error').textContent='请输入非负金额，最多保留 3 位小数';return;}
 try{FinanceModel.editLedger(editingLedger.order,editingLedger.selection,form.elements.direction.value,Math.round(Number(raw)*1000));}catch(error){$('#ledger-edit-error').textContent=error.message;return;}
 $('#ledger-edit-dialog').close();renderDetail();$('#search-form').requestSubmit();
};

function syncRangeLabels(){
 document.querySelectorAll('.unified-range').forEach(box=>{const [start,end]=box.querySelectorAll('input[type=hidden]');box.querySelector('.range-trigger span').textContent=start.value&&end.value?start.value.slice(0,10)+' 至 '+end.value.slice(0,10):'开始日期 至 结束日期';});
}
let rangeDraft=null;
const rangeDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function drawRangeCalendar(){
 const draft=rangeDraft;
 $('#range-months').innerHTML=[0,1].map(offset=>{const month=new Date(draft.year,draft.month+offset,1,12),start=new Date(month);start.setDate(1-month.getDay());return `<section class="calendar-month"><h3>${month.getFullYear()} 年 ${month.getMonth()+1} 月</h3><div class="calendar-week">${['日','一','二','三','四','五','六'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-days">${Array.from({length:42},(_,i)=>{const day=new Date(start);day.setDate(start.getDate()+i);const date=rangeDate(day);return `<button type="button" data-range-date="${date}" aria-label="${date}" aria-pressed="${date===draft.start||date===draft.end}" class="${day.getMonth()!==month.getMonth()?'outside ':''}${draft.start&&draft.end&&date>draft.start&&date<draft.end?'in-range ':''}${date===draft.start||date===draft.end?'endpoint':''}">${day.getDate()}</button>`;}).join('')}</div></section>`;}).join('');
 $('#range-selection').textContent=draft.start?(draft.end?draft.start+' 至 '+draft.end:draft.start+' · 请选择结束日期'):'请选择开始日期';
 $('#range-apply').disabled=!draft.start||!draft.end;
}
function closeRangeCalendar(){if($('#range-calendar').matches(':popover-open'))$('#range-calendar').hidePopover();rangeDraft=null;}
for(const box of document.querySelectorAll('.unified-range'))box.querySelector('button').onclick=()=>{
 closeRangeCalendar();const [start,end]=box.querySelectorAll('input[type=hidden]'),today=FinanceModel.dateInZone(Date.now(),state.timezone),date=(start.value||today).slice(0,10).split('-').map(Number);
 rangeDraft={box,start:start.value.slice(0,10),end:end.value.slice(0,10),year:date[0],month:date[1]-1};
 const calendar=$('#range-calendar');(box.closest('[popover]')||document.body).append(calendar);
 drawRangeCalendar();calendar.showPopover();const r=box.getBoundingClientRect(),h=calendar.getBoundingClientRect().height;
 calendar.style.left=Math.max(8,Math.min(r.left,innerWidth-596))+'px';calendar.style.top=Math.max(8,r.bottom+h+8>innerHeight?r.top-h-8:r.bottom+8)+'px';
};
$('#range-months').onclick=e=>{const button=e.target.closest('[data-range-date]');if(!button||!rangeDraft)return;const date=button.dataset.rangeDate;if(!rangeDraft.start||rangeDraft.end){rangeDraft.start=date;rangeDraft.end='';}else{rangeDraft.end=date;if(date<rangeDraft.start)[rangeDraft.start,rangeDraft.end]=[date,rangeDraft.start];}drawRangeCalendar();};
for(const button of document.querySelectorAll('[data-month-shift]'))button.onclick=()=>{const date=new Date(rangeDraft.year,rangeDraft.month+Number(button.dataset.monthShift),1);rangeDraft.year=date.getFullYear();rangeDraft.month=date.getMonth();drawRangeCalendar();};
$('#range-cancel').onclick=closeRangeCalendar;
function applyRange(clear=false){
 if(!rangeDraft)return;const {box}=rangeDraft,[start,end]=box.querySelectorAll('input[type=hidden]'),stat=box.dataset.range==='stat';
 const a=clear?'':rangeDraft.start,b=clear?'':rangeDraft.end;
 if(!clear&&a>b){$('#range-selection').textContent='开始时间不能晚于结束时间';return;}
 start.value=a;end.value=b;closeRangeCalendar();syncRangeLabels();if(stat)box.closest('form').requestSubmit();
}
$('#range-clear').onclick=()=>applyRange(true);$('#range-apply').onclick=()=>applyRange();
document.addEventListener('mousedown',e=>{if(rangeDraft&&!$('#range-calendar').contains(e.target)&&!rangeDraft.box.contains(e.target))closeRangeCalendar();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&rangeDraft){closeRangeCalendar();e.preventDefault();}});
document.addEventListener('toggle',e=>{if(e.newState==='closed'&&rangeDraft&&e.target.contains(rangeDraft.box))closeRangeCalendar();},true);
syncRangeLabels();

let manualDeleteId=null;
const PACIFIC_ZONE='America/Los_Angeles';
const manualEntries=$('#manual-entries');
function updateManualEntryControls(){
 const rows=[...manualEntries.querySelectorAll('.manual-entry')];
 rows.forEach((row,index)=>{
  row.querySelector('.manual-entry-title').textContent=`计提项 ${index+1}`;
  row.querySelector('[data-remove-manual]').disabled=rows.length<2;
 });
}
function addManualEntry(){
 manualEntries.insertAdjacentHTML('beforeend',`<div class="manual-entry"><div class="manual-entry-header"><strong class="manual-entry-title"></strong><button type="button" data-remove-manual aria-label="删除此计提项">删除</button></div><label><span><b class="required" aria-hidden="true">*</b> 计提项</span><select name="account"><option value="">请选择计提项</option><option>平台应收账款</option><option>合同负债</option><option>主营业务收入</option><option>财务费用</option></select></label><label><span><b class="required" aria-hidden="true">*</b> 资金方向</span><select name="direction"><option value="">请选择资金方向</option><option>借记</option><option>贷记</option></select></label><label><span><b class="required" aria-hidden="true">*</b> 金额/天</span><div class="manual-amount"><input name="amount" inputmode="decimal" aria-label="金额/天" placeholder="请输入金额"><span>${state.order.currency}</span></div></label></div>`);
 updateManualEntryControls();
}
$('#manual-add-entry').onclick=addManualEntry;
manualEntries.onclick=e=>{
 const button=e.target.closest('[data-remove-manual]');
 if(!button||button.disabled)return;
 button.closest('.manual-entry').remove();updateManualEntryControls();
};
$('#ledger-add').onclick=()=>{
 const form=$('#ledger-add-form');form.reset();manualEntries.replaceChildren();addManualEntry();
 const cutoff=FinanceModel.incomeCutoffDate();
 const paidDate=FinanceModel.dateInZone(state.order.paid,PACIFIC_ZONE);
 form.elements.startDate.min=paidDate;form.elements.startDate.max=cutoff;
 form.elements.endDate.min=paidDate;form.elements.endDate.max=cutoff;
 form.elements.startDate.onchange=()=>{const start=form.elements.startDate.value;form.elements.endDate.min=start?new Date(Date.parse(start+'T00:00:00Z')+86400000).toISOString().slice(0,10):paidDate;if(form.elements.endDate.value&&form.elements.endDate.value<form.elements.endDate.min)form.elements.endDate.value='';};
 $('#manual-cutoff').textContent=`收入截止日期：${cutoff} 23:59:59（太平洋时间）`;
 $('#ledger-add-error').textContent=paidDate>cutoff?'支付成功时间晚于收入截止日期，暂无可新增的统计日期':'';
 form.querySelector('button[type=submit]').disabled=paidDate>cutoff;
 $('#ledger-add-dialog').showModal();
};
for(const id of ['ledger-add-cancel','ledger-add-close'])$('#'+id).onclick=()=>$('#ledger-add-dialog').close();
$('#ledger-add-form').onsubmit=e=>{
 e.preventDefault();const f=e.target,entries=[];$('#ledger-add-error').textContent='';
 if(!f.elements.startDate.value){$('#ledger-add-error').textContent='请选择统计开始时间';return;}
 for(const row of manualEntries.querySelectorAll('.manual-entry')){
  const account=row.querySelector('[name=account]').value,direction=row.querySelector('[name=direction]').value,raw=row.querySelector('[name=amount]').value.trim();
  if(!account){$('#ledger-add-error').textContent='请选择计提项';return;}
  if(!direction){$('#ledger-add-error').textContent='请选择资金方向';return;}
  if(!raw){$('#ledger-add-error').textContent='请输入金额';return;}
  if(!/^\d+(?:\.\d{1,3})?$/.test(raw)){$('#ledger-add-error').textContent='请输入非负金额，最多保留 3 位小数';return;}
  entries.push({account,direction,cents:Math.round(Number(raw)*1000)});
 }
 try{FinanceModel.addManualRecords(state.order,{startDate:f.elements.startDate.value,endDate:f.elements.endDate.value,entries});}catch(error){$('#ledger-add-error').textContent=error.message;return;}
 $('#ledger-add-dialog').close();renderDetail();renderList();
};
$('#manual-delete-cancel').onclick=()=>$('#manual-delete-dialog').close();
$('#manual-delete-confirm').onclick=()=>{FinanceModel.deleteManualRecord(state.order,manualDeleteId);$('#manual-delete-dialog').close();renderDetail();$('#search-form').requestSubmit();};

$('#ledger-complete').onclick=()=>{$('#ledger-complete-error').textContent='';$('#ledger-complete-dialog').showModal();};
$('#ledger-complete-cancel').onclick=()=>$('#ledger-complete-dialog').close();
$('#ledger-complete-confirm').onclick=()=>{
 try{FinanceModel.completeAllocation(state.order);}catch(error){$('#ledger-complete-error').textContent=error.message;return;}
 $('#ledger-complete-dialog').close();$('#complete-result').textContent='完成分摊成功';$('#complete-result').hidden=false;
 renderDetail();$('#search-form').requestSubmit();
};
