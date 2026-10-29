const $=s=>document.querySelector(s), money=n=>n===null?'<span class="pending-amount">待匹配</span>':(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const state={filtered:[...FinanceModel.orders],page:1,size:10,detailPage:1,detailSize:10,tab:'daily',order:null,timezone:'America/Los_Angeles',pendingOrder:null};
const time=n=>n===null||n===undefined?'—':`<span class="timezone-value">${FinanceModel.formatTime(n,state.timezone)}</span>`;
const allocationDate=(o,first=false)=>{const timestamp=first?FinanceModel.firstAllocationTimestamp(o):FinanceModel.latestAllocationTimestamp(o);return timestamp===null?'—':`<span class="timezone-value">${FinanceModel.dateInZone(timestamp,state.timezone)}</span>`;};
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
const headers=['支付订单ID','平台订单ID','产品ID','支付服务商','订单状态','收入分摊状态','币种','产品价格','用户支付金额','税费','不含税收入','渠道佣金','退款金额','退款税费','净退款额','净收入','已确认收入','合同负债','财务费用','用户国家','应用商店账号国家','折扣类型','首次收入登记时间','收入分摊截止时间','支付时间','退款时间','异常备注','分摊明细'];
$('#order-head').innerHTML='<tr>'+headers.map((h,i)=>`<th class="${i>=7&&i<=18?'money':''}">${h}</th>`).join('')+'</tr>';
const badge=o=>`<span class="status ${o.status==='已退款'?'refunded':o.status==='退款撤销'?'revoked':''}">${o.status}</span>`;
function paginate(id,total,detail=false){const pageKey=detail?'detailPage':'page',sizeKey=detail?'detailSize':'size',pages=Math.max(1,Math.ceil(total/state[sizeKey]));state[pageKey]=Math.min(state[pageKey],pages);const page=state[pageKey],visible=[...new Set([1,page-1,page,page+1,pages])].filter(n=>n>0&&n<=pages).sort((a,b)=>a-b);let last=0;$('#'+id).innerHTML=`<span>共 ${total} 条</span><select aria-label="${detail?'明细':'列表'}每页条数">${[10,20,50].map(n=>`<option value="${n}" ${state[sizeKey]===n?'selected':''}>${n} 条/页</option>`).join('')}</select><button data-page="${page-1}" aria-label="上一页" ${page===1?'disabled':''}>‹</button>`+visible.map(n=>{const gap=last&&n-last>1?' <span>•••</span> ':'';last=n;return gap+`<button data-page="${n}" class="${n===page?'current':''}" ${n===page?'aria-current="page"':''}>${n}</button>`;}).join('')+`<button data-page="${page+1}" aria-label="下一页" ${page===pages?'disabled':''}>›</button><span>跳至</span><input type="number" min="1" max="${pages}" value="${page}" aria-label="跳转页码"><span>页</span><button class="jump">确定</button>`;const el=$('#'+id),render=detail?renderDetail:renderList;el.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state[pageKey]=Number(b.dataset.page);render();});el.querySelector('select').onchange=e=>{state[sizeKey]=Number(e.target.value);state[pageKey]=1;render();};const jump=()=>{const n=Number(el.querySelector('input').value);if(Number.isInteger(n)&&n>=1&&n<=pages){state[pageKey]=n;render();}else el.querySelector('input').reportValidity();};el.querySelector('.jump').onclick=jump;el.querySelector('input').onkeydown=e=>{if(e.key==='Enter')jump();};}
function renderList(){paginate('list-pagination',state.filtered.length);const rows=state.filtered.slice((state.page-1)*state.size,state.page*state.size);$('#order-body').innerHTML=rows.map(o=>{const b=FinanceModel.balances(o);const cells=[o.order,o.platform,o.product,`<span class="provider ${o.provider.toLowerCase()}"><i>${o.provider[0]}</i>${o.provider}</span>`,badge(o),allocationBadge(o,true),o.currency,... [o.price,o.price+o.tax,o.tax,o.price,o.commission,o.refund?(o.refundAmount??o.price+o.tax):0,o.refund?(o.refundTax??o.tax):0,FinanceModel.netRefund(o),FinanceModel.netIncome(o),b.revenue,b.liability,b.financialExpenses].map(v=>money(v)),o.country,o.account,o.discountType,allocationDate(o,true),allocationDate(o),time(o.paid),time(o.refund),FinanceModel.anomalyRemark(o)||'—',`<a href="#detail/${o.id}">分摊明细</a>`];return '<tr>'+cells.map((c,i)=>`<td class="${i>=7&&i<=18?'money':i<3?'order-id':''}">${c}</td>`).join('')+'</tr>';}).join('')||'<tr><td colspan="28" class="empty-cell">暂无符合条件的订单，请调整筛选条件或重置</td></tr>';}
$('#search-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),get=k=>String(f.get(k)||'').trim();for(const prefix of ['pay','refund'])if(get(prefix+'Start')&&get(prefix+'End')&&get(prefix+'Start')>get(prefix+'End')){$('#search-error').textContent=(prefix==='pay'?'支付':'退款')+'开始日期不能晚于结束日期';return;}$('#search-error').textContent='';const selected=id=>[...document.querySelectorAll('#'+id+' input:checked')].map(i=>i.value),uc=selected('user-country'),ac=selected('account-country');const inRange=(n,prefix)=>{const s=get(prefix+'Start'),end=get(prefix+'End');if(!s&&!end)return true;if(!n)return false;const date=FinanceModel.dateInZone(n,state.timezone);return (!s||date>=s)&&(!end||date<=end);};state.filtered=FinanceModel.orders.filter(o=>FinanceModel.eligible(o)&&(!get('allocationStatus')||FinanceModel.allocationStatus(o)===get('allocationStatus'))&&o.order.toLowerCase().includes(get('order').toLowerCase())&&o.platform.toLowerCase().includes(get('platform').toLowerCase())&&o.product.toLowerCase().includes(get('product').toLowerCase())&&(!get('status')||o.status===get('status'))&&(!get('provider')||o.provider===get('provider'))&&(!get('discountType')||o.discountType===get('discountType'))&&(!uc.length||uc.includes(o.country))&&(!ac.length||ac.includes(o.account))&&inRange(o.paid,'pay')&&inRange(o.refund,'refund'));state.page=1;renderList();};
function setDefaultPaymentDates(){
 const current=FinanceModel.dateInZone(Date.now(),state.timezone),[year,month]=current.split('-').map(Number),start=new Date(year,month-2,1);
 const dateValue=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 $('#search-form').elements.payStart.value=dateValue(start);
 $('#search-form').elements.payEnd.value=current;
}
$('#search-form').onreset=()=>{setTimeout(()=>{$('#search-error').textContent='';state.filtered=[...FinanceModel.orders];state.page=1;document.querySelectorAll('.multi-select').forEach(b=>b.classList.remove('open'));document.querySelectorAll('.multi-select input').forEach(i=>i.dispatchEvent(new Event('change',{bubbles:true})));setDefaultPaymentDates();$('#search-form').requestSubmit();});};
function renderDetail(){const o=state.order;if(!o)return;const b=FinanceModel.allocationStatus(o)==='待分摊'?{receivable:0,liability:0,revenue:0}:FinanceModel.balances(o);$('#detail-summary').innerHTML=`<h2>${o.order} ${allocationBadge(o)} ${badge(o)}</h2><div class="summary-grid">${[['平台订单ID',o.platform],['产品ID',o.product],['支付服务商',o.provider],['币种',o.currency],['支付时间',time(o.paid)],['不含税收入',money(o.price)],['平台应收账款',money(b.receivable)],['合同负债',money(b.liability)],['已确认收入',money(b.revenue)]].map(([t,v])=>`<div class="summary-item"><span>${t}</span><strong>${v}</strong></div>`).join('')}</div>`;let rows=FinanceModel.ledger(o);if(state.tab==='monthly')rows=FinanceModel.monthly(rows);$('#date-heading').textContent=state.tab==='daily'?'统计日期':'统计月份';document.querySelectorAll('[data-tab]').forEach(t=>{t.classList.toggle('selected',t.dataset.tab===state.tab);t.setAttribute('aria-selected',String(t.dataset.tab===state.tab));});paginate('detail-pagination',rows.length,true);$('#ledger-body').innerHTML=rows.slice((state.detailPage-1)*state.detailSize,state.detailPage*state.detailSize).map(r=>`<tr><td>${r.date}</td><td><span class="account-name">${r.account}</span>${r.event==='refund'?' <span class="refund-note">全额退款</span>':''}</td><td><span class="direction ${r.direction==='贷记'?'credit':''}">${r.direction}</span></td><td>${o.currency}</td><td class="money">${money(r.cents)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty-cell">尚未生成分摊记录</td></tr>';}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.detailPage=1;renderDetail();});$('#back').onclick=()=>location.hash='income';
function renderPending(){
 const o=state.pendingOrder;if(!o)return;
 const income=FinanceModel.pendingIncome(o),refunds=FinanceModel.pendingRefunds(o);
 $('#pending-income-body').innerHTML=income.map(r=>`<tr><td>${r.order}</td><td>${r.platform}</td><td class="money">${money(r.cents)}${r.cents===null?'':' '+o.currency}</td><td>${time(r.timestamp)}</td></tr>`).join('')||'<tr><td colspan="4" class="pending-empty">暂无待分摊收入</td></tr>';
 $('#pending-refund-body').innerHTML=refunds.map(r=>`<tr><td>${r.order}</td><td>${r.platform}</td><td class="money">${money(r.cents)}${r.cents===null?'':' '+o.currency}</td><td><div class="refund-group-date">${r.date}（太平洋日期）</div>${r.timestamps.map(t=>`<div>${time(t)}</div>`).join('')}</td></tr>`).join('')||'<tr><td colspan="4" class="pending-empty">暂无待分摊退款</td></tr>';
}
$('#order-body').onclick=e=>{const button=e.target.closest('[data-pending-id]');if(!button)return;const order=FinanceModel.orders.find(o=>o.id===Number(button.dataset.pendingId));if(!order||FinanceModel.allocationStatus(order)!=='待分摊')return;state.pendingOrder=order;renderPending();$('#pending-dialog').showModal();};
$('#pending-close').onclick=$('#pending-done').onclick=()=>$('#pending-dialog').close();
$('#pending-dialog').addEventListener('close',()=>{state.pendingOrder=null;});
$('#pending-dialog').onclick=e=>{if(e.target===$('#pending-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
function route(){
 const hash=location.hash.slice(1),detail=hash.startsWith('detail/'),bills=hash==='bills',payment=hash==='orders';
 $('#payment-view').hidden=!payment;$('#payment-site').hidden=!payment;$('.timezone-field').hidden=payment;$('#payment-nav').classList.toggle('active',payment);$('#payment-center-label').classList.toggle('payment-active',payment);if(payment)PaymentPage.render();$('footer').textContent='RingConn 管理后台 · '+(payment?'支付中心':'财务中心');

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
 const amount=n=>n===null?'待匹配':(n/100).toFixed(2),stamp=n=>FinanceModel.formatTime(n,zone),date=n=>n===null?'—':FinanceModel.dateInZone(n,zone);
 const orderRows=[headers.slice(0,-1)],daily=[['支付订单ID','平台订单ID','统计日期','计提项','资金方向','币种','金额']],monthly=[['支付订单ID','平台订单ID','统计月份','计提项','资金方向','币种','金额']];
 for(const o of orders){
  const rows=FinanceModel.ledger(o).filter(r=>r.date>=start&&r.date<=end);if(!rows.length)continue;
  const b=FinanceModel.balances(o);
  orderRows.push([o.order,o.platform,o.product,o.provider,o.status,FinanceModel.allocationStatus(o),o.currency,...[o.price,o.price+o.tax,o.tax,o.price,o.commission,o.refund?(o.refundAmount??o.price+o.tax):0,o.refund?(o.refundTax??o.tax):0,FinanceModel.netRefund(o),FinanceModel.netIncome(o),b.revenue,b.liability,b.financialExpenses].map(amount),o.country,o.account,o.discountType,date(FinanceModel.firstAllocationTimestamp(o)),date(FinanceModel.latestAllocationTimestamp(o)),stamp(o.paid),stamp(o.refund),FinanceModel.anomalyRemark(o)||'—']);
  const record=r=>[o.order,o.platform,r.date,r.account,r.direction,o.currency,amount(r.cents)];
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
