const $=s=>document.querySelector(s), money=n=>n===null?'<span class="pending-amount">待匹配</span>':'$'+(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
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
for(const id of ['user-country','account-country']){const box=$('#'+id);box.innerHTML=`<button type="button" class="multi-select-toggle" aria-expanded="false" aria-label="${id==='user-country'?'用户国家':'支付账号国家'}">请选择</button><div class="multi-select-menu">${FinanceModel.countries.map(c=>`<label class="multi-option"><input type="checkbox" value="${c}">${c}</label>`).join('')}</div>`;box.querySelector('button').onclick=()=>{const open=!box.classList.contains('open');document.querySelectorAll('.multi-select').forEach(b=>{b.classList.remove('open');b.querySelector('button').setAttribute('aria-expanded','false');});box.classList.toggle('open',open);box.querySelector('button').setAttribute('aria-expanded',String(open));};}
document.addEventListener('click',e=>{if(!e.target.closest('.multi-select'))document.querySelectorAll('.multi-select').forEach(b=>{b.classList.remove('open');b.querySelector('button').setAttribute('aria-expanded','false');});});
$('.finance').onclick=()=>{const hidden=!$('#finance-nav').hidden;$('#finance-nav').hidden=hidden;$('.finance').setAttribute('aria-expanded',String(!hidden));};
document.querySelector('select[name=allocationStatus]').innerHTML+=FinanceModel.allocationStatuses.map(s=>`<option>${s}</option>`).join('');
const allocationBadge=(o,interactive=false)=>{const label=FinanceModel.allocationStatus(o);if(interactive&&label==='待分摊')return `<button type="button" class="allocation-badge pending-state-link" data-pending-id="${o.id}" title="查看待分摊明细">待分摊</button>`;return `<span class="allocation-badge ${label?.includes('异常')?'error':label==='完成分摊'?'complete':''}">${label||'不参与分摊'}</span>`;};
const headers=['支付订单ID','平台订单ID','产品ID','支付服务商','订单状态','收入分摊状态','产品价格','用户支付金额','税费','不含税收入','渠道佣金','退款金额','退款税费','净退款额','净收入','已确认收入','财务费用','用户国家','支付账号国家','折扣类型','首次收入登记时间','收入分摊截止时间','支付时间','退款时间','分摊明细'];
$('#order-head').innerHTML='<tr>'+headers.map((h,i)=>`<th class="${i>=6&&i<=16?'money':''}">${h}</th>`).join('')+'</tr>';
const badge=o=>`<span class="status ${o.status==='已退款'?'refunded':o.status==='退款撤销'?'revoked':''}">${o.status}</span>`;
function paginate(id,total,detail=false){const pageKey=detail?'detailPage':'page',sizeKey=detail?'detailSize':'size',pages=Math.max(1,Math.ceil(total/state[sizeKey]));state[pageKey]=Math.min(state[pageKey],pages);const page=state[pageKey],visible=[...new Set([1,page-1,page,page+1,pages])].filter(n=>n>0&&n<=pages).sort((a,b)=>a-b);let last=0;$('#'+id).innerHTML=`<span>共 ${total} 条</span><select aria-label="${detail?'明细':'列表'}每页条数">${[10,20,50].map(n=>`<option value="${n}" ${state[sizeKey]===n?'selected':''}>${n} 条/页</option>`).join('')}</select><button data-page="${page-1}" aria-label="上一页" ${page===1?'disabled':''}>‹</button>`+visible.map(n=>{const gap=last&&n-last>1?' <span>•••</span> ':'';last=n;return gap+`<button data-page="${n}" class="${n===page?'current':''}" ${n===page?'aria-current="page"':''}>${n}</button>`;}).join('')+`<button data-page="${page+1}" aria-label="下一页" ${page===pages?'disabled':''}>›</button><span>跳至</span><input type="number" min="1" max="${pages}" value="${page}" aria-label="跳转页码"><span>页</span><button class="jump">确定</button>`;const el=$('#'+id),render=detail?renderDetail:renderList;el.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state[pageKey]=Number(b.dataset.page);render();});el.querySelector('select').onchange=e=>{state[sizeKey]=Number(e.target.value);state[pageKey]=1;render();};const jump=()=>{const n=Number(el.querySelector('input').value);if(Number.isInteger(n)&&n>=1&&n<=pages){state[pageKey]=n;render();}else el.querySelector('input').reportValidity();};el.querySelector('.jump').onclick=jump;el.querySelector('input').onkeydown=e=>{if(e.key==='Enter')jump();};}
function renderList(){paginate('list-pagination',state.filtered.length);const rows=state.filtered.slice((state.page-1)*state.size,state.page*state.size);$('#order-body').innerHTML=rows.map(o=>{const b=FinanceModel.balances(o);const cells=[o.order,o.platform,o.product,`<span class="provider ${o.provider.toLowerCase()}"><i>${o.provider[0]}</i>${o.provider}</span>`,badge(o),allocationBadge(o,true),... [o.price,o.price+o.tax,o.tax,o.price,o.commission,o.refund?(o.refundAmount??o.price+o.tax):0,o.refund?(o.refundTax??o.tax):0,FinanceModel.netRefund(o),FinanceModel.netIncome(o),b.revenue,b.financialExpenses].map(v=>money(v)),o.country,o.account,o.discountType,allocationDate(o,true),allocationDate(o),time(o.paid),time(o.refund),`<a href="#detail/${o.id}">分摊明细</a>`];return '<tr>'+cells.map((c,i)=>`<td class="${i>=6&&i<=16?'money':i<3?'order-id':''}">${c}</td>`).join('')+'</tr>';}).join('')||'<tr><td colspan="25" class="empty-cell">暂无符合条件的订单，请调整筛选条件或重置</td></tr>';}
$('#search-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),get=k=>String(f.get(k)||'').trim();for(const prefix of ['pay','refund'])if(get(prefix+'Start')&&get(prefix+'End')&&get(prefix+'Start')>get(prefix+'End')){$('#search-error').textContent=(prefix==='pay'?'支付':'退款')+'开始日期不能晚于结束日期';return;}$('#search-error').textContent='';const selected=id=>[...document.querySelectorAll('#'+id+' input:checked')].map(i=>i.value),uc=selected('user-country'),ac=selected('account-country');const inRange=(n,prefix)=>{const s=get(prefix+'Start'),end=get(prefix+'End');if(!s&&!end)return true;if(!n)return false;const date=FinanceModel.dateInZone(n,state.timezone);return (!s||date>=s)&&(!end||date<=end);};state.filtered=FinanceModel.orders.filter(o=>FinanceModel.eligible(o)&&(!get('allocationStatus')||FinanceModel.allocationStatus(o)===get('allocationStatus'))&&o.order.toLowerCase().includes(get('order').toLowerCase())&&o.platform.toLowerCase().includes(get('platform').toLowerCase())&&o.product.toLowerCase().includes(get('product').toLowerCase())&&(!get('status')||o.status===get('status'))&&(!get('provider')||o.provider===get('provider'))&&(!get('discountType')||o.discountType===get('discountType'))&&(!uc.length||uc.includes(o.country))&&(!ac.length||ac.includes(o.account))&&inRange(o.paid,'pay')&&inRange(o.refund,'refund'));state.page=1;renderList();};
function setDefaultPaymentDates(){
 const current=FinanceModel.dateInZone(Date.now(),state.timezone),[year,month]=current.split('-').map(Number),start=new Date(year,month-2,1);
 const dateValue=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 $('#search-form').elements.payStart.value=dateValue(start);
 $('#search-form').elements.payEnd.value=current;
}
$('#search-form').onreset=()=>{setTimeout(()=>{$('#search-error').textContent='';state.filtered=[...FinanceModel.orders];state.page=1;document.querySelectorAll('.multi-select').forEach(b=>b.classList.remove('open'));document.querySelectorAll('.multi-select input').forEach(i=>i.dispatchEvent(new Event('change',{bubbles:true})));setDefaultPaymentDates();$('#search-form').requestSubmit();});};
function renderDetail(){const o=state.order;if(!o)return;const b=FinanceModel.balances(o);$('#detail-summary').innerHTML=`<h2>${o.order} ${badge(o)} ${allocationBadge(o)}</h2><div class="summary-grid">${[['平台订单ID',o.platform],['产品ID',o.product],['支付服务商',o.provider],['支付时间',time(o.paid)],['不含税收入',money(o.price)],['平台应收账款',money(b.receivable)],['合同负债',money(b.liability)],['已确认收入',money(b.revenue)]].map(([t,v])=>`<div class="summary-item"><span>${t}</span><strong>${v}</strong></div>`).join('')}</div>`;renderAllocationInfo(o);let rows=FinanceModel.ledger(o);if(state.tab==='monthly')rows=FinanceModel.monthly(rows);$('#date-heading').textContent=state.tab==='daily'?'统计日期':'统计月份';document.querySelectorAll('[data-tab]').forEach(t=>{t.classList.toggle('selected',t.dataset.tab===state.tab);t.setAttribute('aria-selected',String(t.dataset.tab===state.tab));});paginate('detail-pagination',rows.length,true);$('#ledger-body').innerHTML=rows.slice((state.detailPage-1)*state.detailSize,state.detailPage*state.detailSize).map(r=>`<tr><td>${r.date}</td><td><span class="account-name">${r.account}</span>${r.event==='refund'?' <span class="refund-note">全额退款</span>':''}</td><td><span class="direction ${r.direction==='贷记'?'credit':''}">${r.direction}</span></td><td class="money">${money(r.cents)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty-cell">尚未生成分摊记录</td></tr>';}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.detailPage=1;renderDetail();});$('#back').onclick=()=>location.hash='income';
function renderPending(){
 const o=state.pendingOrder;if(!o)return;
 const income=FinanceModel.pendingIncome(o),refunds=FinanceModel.pendingRefunds(o);
 $('#pending-income-body').innerHTML=income.map(r=>`<tr><td>${r.order}</td><td>${r.platform}</td><td class="money">${money(r.cents)}${r.cents===null?'':' USD'}</td><td>${time(r.timestamp)}</td></tr>`).join('')||'<tr><td colspan="4" class="pending-empty">暂无待分摊收入</td></tr>';
 $('#pending-refund-body').innerHTML=refunds.map(r=>`<tr><td>${r.order}</td><td>${r.platform}</td><td class="money">${money(r.cents)}${r.cents===null?'':' USD'}</td><td><div class="refund-group-date">${r.date}（太平洋日期）</div>${r.timestamps.map(t=>`<div>${time(t)}</div>`).join('')}</td></tr>`).join('')||'<tr><td colspan="4" class="pending-empty">暂无待分摊退款</td></tr>';
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

function renderAllocationInfo(o){
 const status=FinanceModel.allocationStatus(o),check=FinanceModel.reconciliation(o);
 const messages={
 '待获取净收入数据':'已存在支付时间，已纳入收入分摊；等待获取或匹配净收入数据。',
 '已匹配收入':'净收入数据已匹配，下一步进入待分摊队列。',
 '待分摊':'已进入分摊队列，等待每日 00:00 分摊任务执行。',
 '分摊中':'已生成每日分摊记录，后续每日 00:00 继续执行，直至完成分摊。',
 '完成分摊':'合同负债为 0，已确认收入等于净收入，分录净额校验通过；停止后续分摊。',
 '完成分摊（金额异常）':'余额已满足完成条件，但平台应收账款与主营业务收入分录净额不一致；停止常规分摊，待核查差异。',
 '分摊异常':'分摊任务失败，保留已完成记录；重试补齐失败日期，避免重复入账。'
 };
 let html=`<div class="allocation-info-title"><strong>收入分摊状态</strong>${allocationBadge(o)}</div><p>${messages[status]||'无支付时间，不参与收入分摊。'}</p>`;
 if(status?.startsWith('完成分摊'))html+=`<div class="reconciliation">平台应收账款（借记 − 贷记）：${money(check.receivable)}　主营业务收入（贷记 − 借记）：${money(check.revenue)}　差额：${money(check.receivable-check.revenue)}</div>`;
 if(o.failure){const f=o.failure;html+=`<div class="failure-info">失败日期：${f.date}　失败步骤：${f.step}<br>异常原因：${f.reason}　已重试 ${f.attempts} 次<br>${f.persistent?'持续异常，已触发预警，请处理失败步骤后重试。':'已进行当日自动重试，仍未成功，可立即重试补齐。'}</div><button type="button" id="retry-allocation" class="primary">立即重试</button>`;}
 if(o.lastRetry)html+=`<p class="retry-success" role="status">重试成功，已补齐 ${o.lastRetry.date} 及后续应分摊日期，无重复记录。</p>`;
 $('#allocation-info').innerHTML=html;
 if($('#retry-allocation'))$('#retry-allocation').onclick=()=>{FinanceModel.retry(o);renderDetail();$('#search-form').requestSubmit();};
}
