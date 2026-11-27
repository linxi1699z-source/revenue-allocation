const $=s=>document.querySelector(s);
const amountText=(n,currency,grouping=true)=>{
 if(n===null||n===undefined)return '待匹配';
 const yen=currency==='JPY',unit=yen?1000:10,places=yen?0:2;
 const rounded=Math.sign(n)*Math.round(Math.abs(n)/unit)/(yen?1:100);
 return rounded.toLocaleString('en-US',{minimumFractionDigits:places,maximumFractionDigits:places,useGrouping:grouping});
};
const money=(n,currency)=>n===null||n===undefined?'<span class="pending-amount">待匹配</span>':amountText(n,currency);
const amountPattern=(currency,negative=false)=>new RegExp(`^${negative?'-?':''}\\d+${currency==='JPY'?'':'(?:\\.\\d{1,2})?'}$`);
const amountRule=currency=>currency==='JPY'?'日元金额只能输入整数':'金额最多保留 2 位小数';
const savedSite=sessionStorage.getItem('revenue-prototype-v2-site');
const state={filtered:[],site:FinanceModel.sites.includes(savedSite)?savedSite:'美区',page:1,size:10,detailPage:1,detailSize:10,tab:'daily',order:null,timezone:'America/Los_Angeles',pendingOrder:null,ledgerFilters:{daily:{},monthly:{}}};
$('#data-site').value=state.site;
PaymentPage.setSite(state.site);
$('#allocation-cutoff').textContent=`收入分摊截止时间：${FinanceModel.incomeCutoffDate()} 23:59:59（太平洋时间）`;
const time=n=>n===null||n===undefined?'—':`<span class="timezone-value">${FinanceModel.formatTime(n,state.timezone).slice(0,16)}</span>`;
const allocationDate=(o,first=false)=>{const timestamp=first?FinanceModel.firstAllocationTimestamp(o):FinanceModel.latestAllocationTimestamp(o);return timestamp===null?'—':`<span class="timezone-value">${FinanceModel.formatTime(timestamp,state.timezone).slice(0,16)}</span>`;};
let timezoneFeedbackTimer;
$('#timezone').onchange=e=>{
 if(location.hash==='#cost-details')return;
 if(state.timezone===e.target.value)return;
 state.timezone=e.target.value;
 $('#search-form').requestSubmit();if(state.pendingOrder)renderPending();if(state.order)renderDetail();
 clearTimeout(timezoneFeedbackTimer);
 const notice=$('#timezone-notice');notice.textContent='已切换至 '+e.target.selectedOptions[0].text+'，时间已更新';notice.hidden=false;
 document.body.classList.remove('timezone-updated');
 void notice.offsetWidth;
 document.body.classList.add('timezone-updated');
 timezoneFeedbackTimer=setTimeout(()=>{document.body.classList.remove('timezone-updated');notice.hidden=true;},3200);
};
$('#data-site').onchange=e=>{
 if(state.site===e.target.value)return;
 state.site=e.target.value;
 sessionStorage.setItem('revenue-prototype-v2-site',state.site);
 state.page=state.detailPage=1;
 $('#export-history').hidden=true;
 if($('#pending-dialog').open)$('#pending-dialog').close();
 PaymentPage.setSite(state.site);
 if(location.hash==='#cost-details')CostPages.changeSite();
 $('#search-form').requestSubmit();
 if(location.hash.startsWith('#detail/'))location.hash='income';
};
function closeMultiSelects(){
 document.querySelectorAll('.multi-select.open').forEach(box=>{
  box.classList.remove('open');
  box.querySelector('button').setAttribute('aria-expanded','false');
 });
}
function initMultiSelect(id,label,options,name=''){
 const box=document.getElementById(id);
 const menuId=id+'-options';
 box.innerHTML=`<button type="button" class="multi-select-toggle" aria-expanded="false" aria-controls="${menuId}" aria-label="${label}">请选择</button>
  <div class="multi-select-menu" id="${menuId}">${options.map(value=>`<label class="multi-option"><input type="checkbox" ${name?`name="${name}"`:''} value="${value}">${value}</label>`).join('')}</div>`;
 const button=box.querySelector('button');
 button.onclick=()=>{
  const open=!box.classList.contains('open');
  closeMultiSelects();
  box.classList.toggle('open',open);
  button.setAttribute('aria-expanded',open);
 };
}
initMultiSelect('user-country','用户国家',FinanceModel.countries);
initMultiSelect('account-country','应用商店账号国家',FinanceModel.countries);
document.addEventListener('click',event=>{
 if(!event.target.closest('.multi-select'))closeMultiSelects();
});
$('.finance').onclick=()=>{const hidden=!$('#finance-nav').hidden;$('#finance-nav').hidden=hidden;$('.finance').setAttribute('aria-expanded',String(!hidden));};
document.querySelector('select[name=allocationStatus]').innerHTML+=FinanceModel.allocationStatuses.map(s=>`<option>${s}</option>`).join('');
const allocationBadge=(o,interactive=false)=>{const label=FinanceModel.allocationStatus(o);if(interactive&&label==='待分摊')return `<button type="button" class="allocation-badge pending-state-link" data-pending-id="${o.id}" title="查看待分摊明细">待分摊</button>`;return `<span class="allocation-badge ${label?.includes('异常')?'error':label==='完成分摊'?'complete':''}">${label||'不参与分摊'}</span>`;};
const headers=['支付订单ID','平台订单ID','产品ID','支付服务商','订单状态','收入分摊状态','币种','产品价格','用户支付金额','税费','不含税收入','渠道佣金','退款金额','退款税费','净退款额','净利润','已确认收入','合同负债','销售费用','用户国家','应用商店账号国家','折扣类型','首次收入登记时间','收入分摊截止时间','支付时间','退款时间','异常备注','操作'];
$('#order-head').innerHTML='<tr>'+headers.map((h,i)=>`<th class="${i>=7&&i<=18?'money':''}">${h}</th>`).join('')+'</tr>';
const badge=o=>`<span class="status ${o.status==='已退款'?'refunded':o.status==='退款撤销'?'revoked':''}">${o.status}</span>`;
function paginate(id,total,detail=false){
 const pageKey=detail?'detailPage':'page',sizeKey=detail?'detailSize':'size';
 renderPagination(id,total,state,pageKey,sizeKey,detail?renderDetail:renderList);
}
function renderPagination(id,total,state,pageKey,sizeKey,render){const pages=Math.max(1,Math.ceil(total/state[sizeKey]));state[pageKey]=Math.min(state[pageKey],pages);const page=state[pageKey],visible=[...new Set([1,page-1,page,page+1,pages])].filter(n=>n>0&&n<=pages).sort((a,b)=>a-b);let last=0;$('#'+id).innerHTML=`<span>共 ${total} 条</span><select aria-label="每页条数">${[10,20,50].map(n=>`<option value="${n}" ${state[sizeKey]===n?'selected':''}>${n} 条/页</option>`).join('')}</select><button data-page="${page-1}" aria-label="上一页" ${page===1?'disabled':''}>‹</button>`+visible.map(n=>{const gap=last&&n-last>1?' <span>•••</span> ':'';last=n;return gap+`<button data-page="${n}" class="${n===page?'current':''}" ${n===page?'aria-current="page"':''}>${n}</button>`;}).join('')+`<button data-page="${page+1}" aria-label="下一页" ${page===pages?'disabled':''}>›</button><span>跳至</span><input type="number" min="1" max="${pages}" value="${page}" aria-label="跳转页码"><span>页</span><button class="jump">确定</button>`;const el=$('#'+id);el.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{state[pageKey]=Number(b.dataset.page);render();});el.querySelector('select').onchange=e=>{state[sizeKey]=Number(e.target.value);state[pageKey]=1;render();};const jump=()=>{const n=Number(el.querySelector('input').value);if(Number.isInteger(n)&&n>=1&&n<=pages){state[pageKey]=n;render();}else el.querySelector('input').reportValidity();};el.querySelector('.jump').onclick=jump;el.querySelector('input').onkeydown=e=>{if(e.key==='Enter')jump();};}
function renderList(){paginate('list-pagination',state.filtered.length);const rows=state.filtered.slice((state.page-1)*state.size,state.page*state.size);$('#order-body').innerHTML=rows.map(o=>{const b=FinanceModel.balances(o);const cells=[o.order,o.platform,o.product,`<span class="provider ${o.provider.toLowerCase()}"><i>${o.provider[0]}</i>${o.provider}</span>`,badge(o),allocationBadge(o,true),o.currency,... [o.price,o.userPaid??o.price+o.tax,o.tax,(o.userPaid??o.price+o.tax)-o.tax,o.commission,o.refund?(o.refundAmount??o.price+o.tax):0,o.refund?(o.refundTax??o.tax):0,FinanceModel.netRefund(o),FinanceModel.netIncome(o),b.revenue,b.liability,b.financialExpenses].map(v=>money(v,o.currency)),o.country,o.account,o.discountType,allocationDate(o,true),allocationDate(o),time(o.paid),time(o.refund),FinanceModel.anomalyRemark(o)||'—',`<a class="order-action" href="#detail/${o.id}">分摊明细</a>`];return '<tr>'+cells.map((c,i)=>`<td ${i<3?`title="${String(c).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"`:''} class="${i>=7&&i<=18?'money':i<3?'order-id':''}">${c}</td>`).join('')+'</tr>';}).join('')||`<tr><td colspan="28" class="empty-cell">${state.site==='中国大陆'?'当前站点暂无数据':'暂无符合条件的订单，请调整筛选条件或重置'}</td></tr>`;}
$('#search-form').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),get=k=>String(f.get(k)||'').trim();for(const prefix of ['pay','refund'])if(get(prefix+'Start')&&get(prefix+'End')&&get(prefix+'Start')>get(prefix+'End')){$('#search-error').textContent=(prefix==='pay'?'支付':'退款')+'开始日期不能晚于结束日期';return;}$('#search-error').textContent='';const selected=id=>[...document.querySelectorAll('#'+id+' input:checked')].map(i=>i.value),uc=selected('user-country'),ac=selected('account-country');const inRange=(n,prefix)=>{const s=get(prefix+'Start'),end=get(prefix+'End');if(!s&&!end)return true;if(!n)return false;const date=FinanceModel.dateInZone(n,state.timezone);return (!s||date>=s)&&(!end||date<=end);};state.filtered=FinanceModel.orders.filter(o=>o.site===state.site&&FinanceModel.eligible(o)&&(!get('allocationStatus')||FinanceModel.allocationStatus(o)===get('allocationStatus'))&&o.order.toLowerCase().includes(get('order').toLowerCase())&&o.platform.toLowerCase().includes(get('platform').toLowerCase())&&o.product.toLowerCase().includes(get('product').toLowerCase())&&(!get('status')||o.status===get('status'))&&(!get('provider')||o.provider===get('provider'))&&(!get('discountType')||o.discountType===get('discountType'))&&(!uc.length||uc.includes(o.country))&&(!ac.length||ac.includes(o.account))&&inRange(o.paid,'pay')&&inRange(o.refund,'refund'));state.page=1;renderList();};
function setDefaultPaymentDates(){
 const current=FinanceModel.dateInZone(Date.now(),state.timezone),[year,month]=current.split('-').map(Number),start=new Date(year,month-2,1);
 const dateValue=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 $('#search-form').elements.payStart.value=dateValue(start);
 $('#search-form').elements.payEnd.value=current;
 syncRangeLabels();
}
$('#search-form').onreset=()=>{setTimeout(()=>{$('#search-error').textContent='';state.filtered=FinanceModel.orders.filter(o=>o.site===state.site);state.page=1;document.querySelectorAll('.multi-select').forEach(b=>b.classList.remove('open'));document.querySelectorAll('.multi-select input').forEach(i=>i.dispatchEvent(new Event('change',{bubbles:true})));setDefaultPaymentDates();$('#search-form').requestSubmit();});};
function renderDetail(){const o=state.order;if(!o)return;const b=FinanceModel.allocationStatus(o)==='待分摊'?{receivable:0,liability:0,revenue:0}:FinanceModel.balances(o);const noAllocationActions=['免费试用','赠送'].includes(o.discountType);$('#ledger-add').hidden=!FinanceModel.canAddManualRecords(o);$('#ledger-complete').hidden=noAllocationActions;$('#ledger-complete').disabled=FinanceModel.allocationStatus(o)==='完成分摊';$('#detail-summary').innerHTML=`<h2>${o.order} ${allocationBadge(o)} ${badge(o)}</h2><div class="summary-grid">${[['平台订单ID',o.platform],['产品ID',o.product],['支付服务商',o.provider],['币种',o.currency],['支付时间',time(o.paid)],['净利润',money(FinanceModel.netIncome(o),o.currency)],['平台应收账款',money(b.receivable,o.currency)],['合同负债',money(b.liability,o.currency)],['已确认收入',money(b.revenue,o.currency)]].map(([t,v])=>`<div class="summary-item"><span>${t}${['平台应收账款','合同负债','已确认收入'].includes(t)?' <button type="button" class="info-icon" data-tooltip="每日执行分摊程序后更新。" aria-label="每日执行分摊程序后更新。">ⓘ</button>':''}</span><strong>${v}</strong></div>`).join('')}</div>`;let rows=FinanceModel.ledger(o).map((r,index)=>({...r,index}));if(state.tab==='monthly')rows=FinanceModel.monthly(rows);rows.sort((a,b)=>b.timestamp-a.timestamp);const filters=state.ledgerFilters[state.tab];rows=rows.filter(r=>{const local=FinanceModel.formatTime(r.timestamp,state.timezone).slice(0,10);return (!filters.start||local>=filters.start)&&(!filters.end||local<=filters.end)&&(!filters.account||r.account===filters.account)&&(!filters.direction||r.direction===filters.direction);});document.querySelectorAll('[data-ledger-filter]').forEach(button=>{const key=button.dataset.ledgerFilter;button.classList.toggle('filter-active',key==='date'?!!(filters.start||filters.end):!!filters[key]);});document.querySelectorAll('[data-tab]').forEach(t=>{t.classList.toggle('selected',t.dataset.tab===state.tab);t.setAttribute('aria-selected',String(t.dataset.tab===state.tab));});state.visibleLedger=rows;paginate('detail-pagination',rows.length,true);$('#ledger-body').innerHTML=rows.slice((state.detailPage-1)*state.detailSize,state.detailPage*state.detailSize).map((r,i)=>`<tr><td>${time(r.timestamp)}</td><td><span class="account-name">${r.account}</span>${state.tab==='daily'&&r.manual?' <span class="manual-tag">人工添加</span>':''}${r.event==='refund'?' <span class="refund-note">全额退款</span>':''}</td><td><span class="direction ${r.direction==='贷记'?'credit':''}">${r.direction}</span></td><td>${o.currency}</td><td class="money">${money(r.cents,o.currency)}</td><td><button type="button" class="ledger-edit" data-ledger-edit="${(state.detailPage-1)*state.detailSize+i}" ${r.superseded||r.event==="edit-reversal"?"disabled":""}>编辑</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty-cell">尚未生成分摊记录</td></tr>';}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;state.detailPage=1;renderDetail();});$('#back').onclick=()=>location.hash='income';
function renderPending(){
 const o=state.pendingOrder;if(!o)return;
 const income=FinanceModel.pendingIncome(o),refunds=FinanceModel.pendingRefunds(o);
 $('#pending-income-body').innerHTML=income.map(r=>`<tr><td>${r.order}</td><td>${r.platform}</td><td class="money">${money(r.cents,o.currency)}${r.cents===null?'':' '+o.currency}</td><td>${time(r.timestamp)}</td></tr>`).join('')||'<tr><td colspan="4" class="pending-empty">暂无待分摊收入</td></tr>';
 $('#pending-refund-body').innerHTML=refunds.map(r=>`<tr><td>${r.order}</td><td>${r.platform}</td><td class="money">${money(r.cents,o.currency)}${r.cents===null?'':' '+o.currency}</td><td><div class="refund-group-date">${r.date}（太平洋日期）</div>${r.timestamps.map(t=>`<div>${time(t)}</div>`).join('')}</td></tr>`).join('')||'<tr><td colspan="4" class="pending-empty">暂无待分摊退款</td></tr>';
}
$('#order-body').onclick=e=>{const edit=e.target.closest('[data-edit-id]');if(edit){openAmountEditor(Number(edit.dataset.editId));return;}const button=e.target.closest('[data-pending-id]');if(!button)return;const order=FinanceModel.orders.find(o=>o.id===Number(button.dataset.pendingId)&&o.site===state.site);if(!order||FinanceModel.allocationStatus(order)!=='待分摊')return;state.pendingOrder=order;renderPending();$('#pending-dialog').showModal();};
$('#pending-close').onclick=$('#pending-done').onclick=()=>$('#pending-dialog').close();
$('#pending-dialog').addEventListener('close',()=>{state.pendingOrder=null;});
$('#pending-dialog').onclick=e=>{if(e.target===$('#pending-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
const CostPages=(()=>{
 const sites={
  '中国大陆':{currency:'CNY',timezone:'Asia/Shanghai'},
  美区:{currency:'USD',timezone:'UTC'},
  英区:{currency:'USD',timezone:'UTC'}
 };
 const ruleSites=['中国大陆','英区','美区'];
 const modelFeeType='模型Token消耗';
 const otherRule={id:0,name:'其他',sites:ruleSites,effective:'—',feeType:modelFeeType,updated:'—',operator:'系统'};
 const sitesForLegacyEnvironment=environments=>ruleSites.filter(site=>
  site==='中国大陆'?environments.includes('国内'):environments.some(value=>value==='海外'||value==='国外')
 );
 const siteZone=()=>sites[state.site].timezone;
 const products=['RingConn Partner+ (Monthly)','RingConn Partner+(Monthly)','RingConn Partner+ (Annual)','RingConn Partner+(Annual)','免费额度'];
 const usageTypes=['免费使用','付费使用'];
 const billEnvironments=['测试','生产'];
 const webSearchSource='Web Search查询/数据处理';
 const retrievalSource='知识库相关数据检索';
 const feeSources=[modelFeeType,webSearchSource,retrievalSource];
 const sampleFeeSources=[modelFeeType,modelFeeType,modelFeeType,webSearchSource,retrievalSource,retrievalSource];
 const costAmountScale=100000000;
 initMultiSelect('cost-products','产品名称',products,'product');
 initMultiSelect('cost-usage-types','使用类型',usageTypes,'usageType');
 initMultiSelect('cost-bill-environments','环境',billEnvironments,'billEnvironment');
 const allFeeSources='全部来源';
 initMultiSelect('cost-fee-sources','费用来源',[allFeeSources,...feeSources],'feeSource');
 const feeSourceInputs=[...$('#cost-fee-sources').querySelectorAll('input')];
 const [allFeeSourcesInput,...specificFeeSourceInputs]=feeSourceInputs;
 allFeeSourcesInput.defaultChecked=true;
 $('#cost-fee-sources').onchange=event=>{
  if(event.target===allFeeSourcesInput&&allFeeSourcesInput.checked){
   specificFeeSourceInputs.forEach(input=>{input.checked=false;});
  }
  allFeeSourcesInput.checked=!specificFeeSourceInputs.some(input=>input.checked);
 };
 const samples=[
  ['Qwen Plus','国内',['qwen-plus','qwen_plus']],
  ['Qwen Turbo','国内',['qwen-turbo','qwen_turbo']],
  ['Qwen Max','国内',['qwen-max','qwen_max']],
  ['Qwen Long','国内',['qwen-long','qwen_long']],
  ['Qwen Flash','国内',['qwen-flash','qwen_flash']],
  ['DeepSeek V3','国内',['deepseek-v3','deepseek_v3']],
  ['Claude Haiku 4.5','海外',['claude-haiku-4-5','claude_haiku_4_5']],
  ['Claude Sonnet 4.5','海外',['claude-sonnet-4-5','claude_sonnet_4_5']],
  ['Claude Opus 4.5','海外',['claude-opus-4-5','claude_opus_4_5']],
  ['Nova Micro','海外',['nova-micro','nova_micro']],
  ['Nova Lite','海外',['nova-lite','nova_lite']],
  ['Nova Pro','海外',['nova-pro','nova_pro']]
 ];
 const storageKey='revenue-cost-config-v1';
 const seed=samples.map(([name,environment,fragments],index)=>({
  id:index+1,name,sites:sitesForLegacyEnvironment([environment]),feeType:modelFeeType,rules:[{logic:'any',fragments}],
  effective:'2025-11-01',updated:'2025-11-01 10:00',operator:'finance.admin'
 }));
 const stored=localStorage.getItem(storageKey);
 let data=stored?JSON.parse(stored):{nextId:seed.length+1,configs:seed};
 data.configs=data.configs.filter(config=>config.name.trim()!==otherRule.name).map(config=>{
  const {environment,environments,...rule}=config;
  const selected=rule.sites??sitesForLegacyEnvironment(environments??[environment]);
  const rules=rule.rules.every(value=>typeof value==='string')?[{logic:'any',fragments:rule.rules}]:rule.rules;
  return {...rule,sites:ruleSites.filter(site=>selected.includes(site)),feeType:modelFeeType,rules};
 });
 const importedKey='revenue-prototype-v2-cost-bills';
 const savedImports=JSON.parse(localStorage.getItem(importedKey)||'[]');
 let imports=Array.isArray(savedImports)?{bills:savedImports,awsUsage:[]}:savedImports;
 const records=['中国大陆','美区'].flatMap((site,siteIndex)=>{
  const models=seed.filter(config=>config.sites.includes(site));
  const days=[...Array.from({length:18},(_,i)=>Date.UTC(2026,10,24-i, i%2?3:17)),
   ...Array.from({length:11},(_,i)=>Date.UTC(2026,9-i,20,16))];
  return days.flatMap((timestamp,day)=>models.map((model,index)=>{
   const aliases=model.rules[0].fragments;
   const alias=aliases[day%aliases.length];
   const rawName=site==='中国大陆'?alias+'-2026':'us.'+(index<3?'anthropic.':'amazon.')+alias+'-v1:0';
   const tokens=187350+(day*27839+index*42137+siteIndex*60259)%765000;
   const product=products[(day+index+siteIndex)%products.length];
   const usageType=product==='免费额度'?usageTypes[0]:usageTypes[1];
   const billEnvironment=billEnvironments[(day+index+siteIndex)%3===0?0:1];
   const feeSource=sampleFeeSources[(day+index+siteIndex)%sampleFeeSources.length];
   const tokenUsage=feeSource===modelFeeType;
   return {site,timestamp,rawName,product,usageType,billEnvironment,feeSource,
    tokens:tokenUsage?tokens:null,actual:tokenUsage?tokens-Math.round(tokens*0.065):null,
    cents:Math.round(tokens*(0.00092+index*0.00031))};
  }));
 });
 const search=$('#cost-search'),form=$('#cost-config-form'),dialog=$('#cost-config-dialog');
 const deleteDialog=$('#cost-delete-dialog'),ruleList=$('#cost-rule-list');
 const summaryBody=$('#cost-summary-body'),configBody=$('#cost-config-body');
 const textTooltip=$('#cost-text-tooltip');
 const tokenTip=$('#cost-token-tip');
 let tooltipSource=null;
 let tokenTipSource=null;
 const zoneSelect=$('#timezone');
 let grain='day',editingId=null,deletingId=null,statusTimer;
 const summary={page:1,size:10},configPage={page:1,size:10};
 const expanded=new Set();
 function setRecentDateRange(){
  const end=FinanceModel.dateInZone(Date.now(),siteZone());
  const startDate=new Date(end+'T00:00:00Z');
  startDate.setUTCDate(startDate.getUTCDate()-29);
  const start=startDate.toISOString().slice(0,10);
  search.elements.start.value=start;
  search.elements.end.value=end;
  return {start,end};
 }
 let filters={model:'',...setRecentDateRange(),products:[],usageTypes:[],billEnvironments:[],feeSources:[]};
 const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const normalize=value=>value.trim().toLowerCase();
 const today=()=>FinanceModel.dateInZone(Date.now(),'Asia/Shanghai');
 const number=new Intl.NumberFormat('en-US');
 const dateFormats=new Map();
 function dateInZone(timestamp){
  const timezone=siteZone();
  if(!dateFormats.has(timezone))dateFormats.set(timezone,new Intl.DateTimeFormat('en-CA',{
   timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'
  }));
  const parts=Object.fromEntries(dateFormats.get(timezone).formatToParts(timestamp).map(({type,value})=>[type,value]));
  return [parts.year,parts.month,parts.day].join('-');
 }
 function save(next){
  localStorage.setItem(storageKey,JSON.stringify(next));
  data=next;
 }
 function notify(message){
  const status=$('#cost-status');
  clearTimeout(statusTimer);
  status.textContent=message;
  status.hidden=false;
  statusTimer=setTimeout(()=>{status.hidden=true;},2600);
 }
 function rulesFor(site){
  return data.configs.filter(config=>config.sites.includes(site))
   .sort((a,b)=>b.effective.localeCompare(a.effective)||a.id-b.id);
 }
 function matchModel(rawName,billingDate,configs){
  const alias=normalize(rawName);
  let model=otherRule.name,longest=0;
  for(const config of configs){
   if(config.effective>billingDate)continue;
   for(const rule of config.rules){
    const fragments=rule.fragments.map(normalize);
    const matched=fragments.filter(fragment=>fragment&&alias.includes(fragment));
    if(!matched.length||(rule.logic==='all'&&matched.length!==fragments.length))continue;
    const matchLength=Math.max(...matched.map(fragment=>fragment.length));
    if(matchLength>longest){
     model=config.name;
     longest=matchLength;
    }
   }
  }
  return model;
 }
 const sampleUsdRates=[0.1389,0.1391,0.1388,0.1392,0.1390,0.1393,0.1389];
 function usdAmount(amountUnits,currency,date){
  if(currency==='USD')return amountUnits;
  // Prototype rate lookup by bill date. Replace this source when the service is specified.
  const dayIndex=Math.floor(Date.parse(date+'T00:00:00Z')/86400000);
  const rate=sampleUsdRates[((dayIndex%7)+7)%7];
  return Math.sign(amountUnits)*Math.round(Math.abs(amountUnits)*rate);
 }
 function mappedRecords(){
  const site=state.site,currency=sites[site].currency,configs=rulesFor(site);
  return [...records,...imports.bills].filter(record=>record.site===site).map(record=>{
   const date=dateInZone(record.timestamp);
   const model=record.model??matchModel(record.rawName,date,configs);
   const amountUnits=record.amountUnits??record.cents*(costAmountScale/100);
   const feeSource=record.feeSource??(model===otherRule.name?null:modelFeeType);
   return {...record,model,date,feeSource,amountUnits,usdUnits:usdAmount(amountUnits,currency,date)};
  });
 }
 function syncModels(rows){
  const names=[...new Set(rows.map(row=>row.model))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
  const select=search.elements.model;
  const selected=select.value;
  select.replaceChildren(new Option('全部模型',''),...names.map(name=>new Option(name,name)));
  select.value=names.includes(selected)?selected:'';
  if(!names.includes(filters.model))filters.model='';
 }
 function addMetrics(target,source){
  if(source.tokens!=null)target.tokens=(target.tokens??0)+source.tokens;
  if(source.actual!=null)target.actual=(target.actual??0)+source.actual;
  target.amountUnits+=source.amountUnits;
  target.usdUnits+=source.usdUnits;
  if(source.feeSource===modelFeeType){
   target.tokenUnits=(target.tokenUnits??0)+source.amountUnits;
   target.tokenUsdUnits=(target.tokenUsdUnits??0)+source.usdUnits;
  }
  if(source.feeSource===webSearchSource||source.feeSource===retrievalSource){
   target.queryStorageUnits=(target.queryStorageUnits??0)+source.amountUnits;
  }
 }
 function sum(target,source){
  addMetrics(target,source);
  target.products.add(source.product);
  target.usageTypes.add(source.usageType);
  target.billEnvironments.add(source.billEnvironment);
  target.feeSources.add(source.feeSource);
 }
 const metrics=()=>({tokens:null,actual:null,amountUnits:0,usdUnits:0,tokenUnits:null,tokenUsdUnits:null,queryStorageUnits:null});
 const totals=()=>({...metrics(),products:new Set(),usageTypes:new Set(),billEnvironments:new Set(),feeSources:new Set()});
 const dimensionValues=({products:matchedProducts,usageTypes:matchedTypes})=>[
  products.filter(product=>matchedProducts.has(product)),
  usageTypes.filter(type=>matchedTypes.has(type))
 ];
 const listedFeeSources=group=>feeSources.filter(source=>group.feeSources.has(source));
 const listedBillEnvironments=group=>billEnvironments.filter(value=>group.billEnvironments.has(value));
 const modelEntries=group=>[...group.models].sort(([a],[b])=>a.localeCompare(b,'zh-CN'));
 const periodFor=(date,dimension)=>dimension==='month'?date.slice(0,7):date;
 function matchingRows(rows,selection){
  return rows.filter(row=>
   (!selection.model||row.model===selection.model)&&
   (!selection.products.length||selection.products.includes(row.product))&&
   (!selection.usageTypes.length||selection.usageTypes.includes(row.usageType))&&
   (!selection.billEnvironments.length||selection.billEnvironments.includes(row.billEnvironment))&&
   (!selection.feeSources.length||selection.feeSources.includes(row.feeSource))&&
   (!selection.start||row.date>=selection.start)&&
   (!selection.end||row.date<=selection.end)
  );
 }
 function groupsFor(rows,dimension){
  const groups=new Map();
  for(const row of rows){
   const date=periodFor(row.date,dimension);
   if(!groups.has(date))groups.set(date,{date,...totals(),models:new Map()});
   const group=groups.get(date);
   if(!group.models.has(row.model))group.models.set(row.model,totals());
   sum(group.models.get(row.model),row);
   sum(group,row);
  }
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
 }
 function exportDetailsFor(rows,dimension){
  const details=new Map();
  for(const row of rows){
   const date=periodFor(row.date,dimension);
   const {model,product,usageType,billEnvironment='',feeSource}=row;
   const key=JSON.stringify([date,model,product,usageType,billEnvironment,feeSource]);
   if(!details.has(key))details.set(key,{date,model,product,usageType,billEnvironment,feeSource,...metrics()});
   addMetrics(details.get(key),row);
  }
  return [...details.values()].sort((a,b)=>
   b.date.localeCompare(a.date)||a.model.localeCompare(b.model,'zh-CN')||
   products.indexOf(a.product)-products.indexOf(b.product)||
   usageTypes.indexOf(a.usageType)-usageTypes.indexOf(b.usageType)||
   billEnvironments.indexOf(a.billEnvironment)-billEnvironments.indexOf(b.billEnvironment)||
   feeSources.indexOf(a.feeSource)-feeSources.indexOf(b.feeSource)
  );
 }
 function renderSummary(rows=mappedRecords()){
  hideTextTooltip();
  const groups=groupsFor(matchingRows(rows,filters),grain);
  const currency=sites[state.site].currency;
  const moneyOptions={style:'currency',currencyDisplay:'narrowSymbol',minimumFractionDigits:2,maximumFractionDigits:8};
  const money=new Intl.NumberFormat('en-US',{...moneyOptions,currency});
  const usd=new Intl.NumberFormat('en-US',{...moneyOptions,currency:'USD'});
  const count=value=>value==null?'—':number.format(value);
  const moneyCell=(value,formatter=money)=>`<td class="money">${value==null?'—':formatter.format(value/costAmountScale)}</td>`;
  const tokenCells=({tokens,actual})=>`<td class="money">${count(tokens)}</td><td class="money">${count(actual)}</td>`;
  const summaryCells=group=>tokenCells(group)+moneyCell(group.queryStorageUnits)+moneyCell(group.tokenUnits)+
   moneyCell(group.amountUnits)+moneyCell(group.usdUnits,usd);
  const detailCells=total=>tokenCells(total)+moneyCell(total.tokenUnits)+moneyCell(total.tokenUsdUnits,usd);
  const dimensions=group=>{
   const [names,types]=dimensionValues(group);
   const environments=listedBillEnvironments(group);
   return `<td class="cost-dimension"><span class="cost-ellipsis-text" tabindex="0">${escape(names.join(', ')||'—')}</span></td>
    <td class="cost-dimension">${types.map(value=>`<span>${escape(value)}</span>`).join(', <wbr>')||'—'}</td>
    <td class="cost-bill-environment">${environments.join(', ')||'—'}</td>
    <td class="cost-fee-source"><span class="cost-ellipsis-text" tabindex="0">${escape(listedFeeSources(group).join(', ')||'—')}</span></td>`;
  };
  renderPagination('cost-summary-pages',groups.length,summary,'page','size',()=>renderSummary());
  summaryBody.innerHTML=groups.slice((summary.page-1)*summary.size,summary.page*summary.size).map(group=>{
   const open=expanded.has(group.date),rowId='cost-models-'+group.date;
   const models=modelEntries(group).filter(([,total])=>total.tokens!==0||total.actual!==0);
   const toggle=models.length?`<button type="button" class="cost-expand" data-cost-expand="${group.date}" aria-expanded="${open}" aria-controls="${rowId}" aria-label="${open?'收起':'展开'} ${group.date} 的模型明细">${open?'−':'+'}</button>`:'';
   const summaryRow=`<tr class="cost-summary-row"><td class="cost-expand-cell">${toggle}</td><th scope="row">${group.date}</th>${dimensions(group)}${summaryCells(group)}</tr>`;
   if(!models.length)return summaryRow;
   return `${summaryRow}
   <tr id="${rowId}" class="cost-expanded-row" ${open?'':'hidden'}><td colspan="12"><table class="cost-model-table" aria-label="${group.date} 模型费用明细">
    <thead><tr><th scope="col">模型名称</th><th scope="col" class="money">消耗 Token</th><th scope="col" class="money">实际消耗 Token</th><th scope="col" class="money">Token费用</th><th scope="col" class="money">Token费用(USD)</th></tr></thead>
    <tbody>${models.map(([name,total])=>`<tr><th scope="row">${escape(name)}</th>${detailCells(total)}</tr>`).join('')}</tbody>
   </table></td></tr>`;
  }).join('')||'<tr><td colspan="12" class="cost-empty">暂无符合条件的成本数据</td></tr>';
 }
 function hideTextTooltip(){
  if(!tooltipSource)return;
  tooltipSource=null;
  textTooltip.hidePopover();
 }
 function showTextTooltip(source){
  if(source===tooltipSource)return;
  hideTextTooltip();
  if(source.scrollWidth<=source.clientWidth)return;
  tooltipSource=source;
  textTooltip.textContent=source.textContent;
  textTooltip.showPopover();
  positionCostTip(textTooltip,source);
 }
 function positionCostTip(popover,source){
  const anchor=source.getBoundingClientRect(),tip=popover.getBoundingClientRect();
  const above=anchor.top>=tip.height+8;
  const center=anchor.left+anchor.width/2;
  const left=Math.max(8,Math.min(center-tip.width/2,innerWidth-tip.width-8));
  popover.style.left=left+'px';
  popover.style.top=(above?anchor.top-tip.height-8:anchor.bottom+8)+'px';
  popover.style.setProperty('--cost-tip-arrow',Math.max(12,Math.min(center-left,tip.width-12))+'px');
  popover.classList.toggle('below',!above);
 }
 function hideTokenTip(){
  if(tokenTip.matches(':popover-open'))tokenTip.hidePopover();
 }
 tokenTip.addEventListener('beforetoggle',event=>{
  if(event.newState!=='closed'||!tokenTipSource)return;
  tokenTipSource.setAttribute('aria-expanded','false');
  tokenTipSource=null;
 });
 for(const button of document.querySelectorAll('[data-cost-token-help]'))button.onclick=event=>{
  event.preventDefault();
  const alreadyOpen=tokenTipSource===button;
  hideTokenTip();
  if(alreadyOpen)return;
  tokenTipSource=button;
  button.setAttribute('aria-expanded','true');
  tokenTip.showPopover({source:button});
  positionCostTip(tokenTip,button);
 };
 for(const eventName of ['pointerover','focusin'])summaryBody.addEventListener(eventName,event=>{
  const source=event.target.closest('.cost-ellipsis-text');
  if(source)showTextTooltip(source);
 });
 for(const eventName of ['pointerout','focusout'])summaryBody.addEventListener(eventName,event=>{
  if(event.target===tooltipSource)hideTextTooltip();
 });
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hideTextTooltip();});
 window.addEventListener('scroll',hideTextTooltip,true);
 window.addEventListener('resize',hideTextTooltip);
 window.addEventListener('scroll',hideTokenTip,true);
 window.addEventListener('resize',hideTokenTip);
 function resetSummary(){
  summary.page=1;
  expanded.clear();
 }
 search.onsubmit=event=>{
  event.preventDefault();
  const values=new FormData(search);
  filters={model:values.get('model'),start:values.get('start'),end:values.get('end'),
   products:values.getAll('product'),usageTypes:values.getAll('usageType'),billEnvironments:values.getAll('billEnvironment'),
   feeSources:values.getAll('feeSource').filter(value=>value!==allFeeSources)};
  resetSummary();
  renderSummary();
 };
 search.onreset=()=>{
  queueMicrotask(()=>{
   setRecentDateRange();
   closeMultiSelects();
   search.dispatchEvent(new Event('change',{bubbles:true}));
   syncRangeLabels();
   search.requestSubmit();
  });
 };
 document.querySelectorAll('[data-cost-grain]').forEach(button=>button.onclick=()=>{
  if(grain===button.dataset.costGrain)return;
  grain=button.dataset.costGrain;
  document.querySelectorAll('[data-cost-grain]').forEach(tab=>{
   const selected=tab===button;
   tab.classList.toggle('selected',selected);
   tab.setAttribute('aria-pressed',selected);
  });
  resetSummary();
  renderSummary();
 });
 summaryBody.onclick=event=>{
  const button=event.target.closest('[data-cost-expand]');
  if(button){
   const date=button.dataset.costExpand;
   const open=!expanded.has(date);
   if(open)expanded.add(date);else expanded.delete(date);
   button.textContent=open?'−':'+';
   button.setAttribute('aria-expanded',open);
   button.setAttribute('aria-label',`${open?'收起':'展开'} ${date} 的模型明细`);
   document.getElementById(button.getAttribute('aria-controls')).hidden=!open;
  }
 };
 const exportDatabase='ringconn-cost-export';
 const exportDialog=$('#cost-export-dialog'),exportForm=$('#cost-export-form');
 const exportError=$('#cost-export-error'),exportHistory=$('#cost-export-history');
 const exportRecords=$('#cost-export-records'),exportHistoryList=$('#cost-export-history-list');
 let costJobs=[];
 function renderCostExports(){
  const jobs=costJobs.filter(job=>job.site===state.site).sort((a,b)=>b.createdAt-a.createdAt).slice(0,3);
  exportHistoryList.innerHTML=jobs.map(job=>{
   const control=job.blob
    ?`<button type="button" data-cost-download="${job.id}">下载</button>`
    :`<span class="muted">${job.failed?'生成失败':'生成中'}</span>`;
   return `<div class="export-history-row"><div><strong title="${escape(job.name)}">${escape(job.name)}</strong>
    <small>${exportDateTime(job.createdAt)}</small></div>${control}</div>`;
  }).join('')||'<p class="export-history-empty">暂无导出记录</p>';
 }
 function showCostExports(open){
  exportHistory.hidden=!open;
  exportRecords.setAttribute('aria-expanded',open);
  if(open)renderCostExports();
 }
 exportRecords.onclick=()=>showCostExports(exportHistory.hidden);
 document.addEventListener('click',event=>{
  if(!event.target.closest('.cost-export-control'))showCostExports(false);
 });
 exportHistoryList.onclick=event=>{
  const button=event.target.closest('[data-cost-download]');
  if(!button)return;
  const job=costJobs.find(item=>item.id===button.dataset.costDownload&&item.site===state.site);
  if(job?.blob)downloadExportJob(job);
 };
 readExportJobs(exportDatabase).then(saved=>{
  costJobs.push(...saved.filter(job=>!costJobs.some(current=>current.id===job.id)));
  if(!exportHistory.hidden)renderCostExports();
 });
 function syncExportRange(){
  const month=exportForm.elements.grain.value==='month';
  $('#cost-export-day-range').hidden=month;
  $('#cost-export-month-range').hidden=!month;
  exportError.textContent='';
 }
 $('#cost-export-open').onclick=()=>{
  showCostExports(false);
  exportForm.reset();
  exportForm.elements.grain.value=grain;
  exportForm.elements.dayStart.value=filters.start;
  exportForm.elements.dayEnd.value=filters.end;
  exportForm.elements.monthStart.value=filters.start.slice(0,7);
  exportForm.elements.monthEnd.value=filters.end.slice(0,7);
  const zone=siteZone()==='UTC'?'UTC/GMT':siteZone();
  $('#cost-export-scope').textContent=`按当前站点（${state.site}）、时区（${zone}）和已应用的筛选条件导出全部分页。生成后可在「导出记录」下载 Excel。`;
  syncExportRange();
  exportDialog.showModal();
 };
 exportForm.onchange=syncExportRange;
 exportForm.onsubmit=async event=>{
  event.preventDefault();
  const {elements}=exportForm,dimension=elements.grain.value;
  const monthly=dimension==='month',unit=monthly?'月份':'日期';
  const start=elements[dimension+'Start'].value.trim(),end=elements[dimension+'End'].value.trim();
  const format=monthly?/^\d{4}-(0[1-9]|1[0-2])$/:/^\d{4}-\d{2}-\d{2}$/;
  if(!format.test(start)||!format.test(end)){exportError.textContent='请选择有效的'+unit+'范围';return;}
  if(start>end){exportError.textContent='开始'+unit+'不能晚于结束'+unit;return;}
  const monthEnd=month=>{
   const lastDay=new Date(month+'-01T00:00:00Z');
   lastDay.setUTCMonth(lastDay.getUTCMonth()+1,0);
   return lastDay.toISOString().slice(0,10);
  };
  const selection={...filters,start:monthly?start+'-01':start,end:monthly?monthEnd(end):end};
  const site=state.site,currency=sites[site].currency,rows=mappedRecords();
  const name=`成本明细_${site}_${monthly?'月':'日'}_${start}_${end}.xlsx`;
  const job={id:crypto.randomUUID(),site,name,createdAt:Date.now()};
  costJobs.unshift(job);
  exportDialog.close();
  showCostExports(true);
  showExportToast('已提交成本导出任务，报表生成中');
  try{
   await new Promise(resolve=>setTimeout(resolve,900));
   const matched=matchingRows(rows,selection);
   if(!matched.length)throw Error('所选范围内暂无可导出的成本数据');
   const dimensions=['产品名称','使用类型','环境','费用来源'];
   const tokenHeadings=['消耗 Token','实际消耗 Token'];
   const counts=({tokens,actual})=>[tokens??'',actual??''];
   const amount=units=>units==null?'':units/costAmountScale;
   const summaries=groupsFor(matched,dimension).map(group=>[
    group.date,...dimensionValues(group).map(items=>items.join(', ')),listedBillEnvironments(group).join(', '),
    listedFeeSources(group).join(', '),...counts(group),
    amount(group.queryStorageUnits),amount(group.tokenUnits),amount(group.amountUnits),amount(group.usdUnits)
   ]);
   const details=exportDetailsFor(matched,dimension).map(detail=>[
    detail.date,detail.model,detail.product,detail.usageType,detail.billEnvironment,detail.feeSource??'',
    ...counts(detail),amount(detail.tokenUnits),amount(detail.tokenUsdUnits)
   ]);
   job.blob=costExportWorkbook([
    {name:'汇总数据',rows:[['统计时间',...dimensions,...tokenHeadings,'查询/存储费用','Token费用','费用总金额','费用总金额(USD)'],...summaries]},
    {name:'明细数据',rows:[['统计时间','模型名称',...dimensions,...tokenHeadings,'Token费用','Token费用(USD)'],...details]}
   ],currency);
   await saveExportJob(job,exportDatabase);
   if(location.hash==='#cost-details'&&state.site===site)showExportToast('成本报表已生成，可在导出记录中下载');
  }catch(error){
   job.failed=true;
   if(location.hash==='#cost-details'&&state.site===site)showExportToast(error.message||'成本报表生成失败，请重试');
  }finally{
   if(!exportHistory.hidden)renderCostExports();
  }
 };
 function renderConfigs(){
  const rows=[otherRule,...[...data.configs].sort((a,b)=>b.id-a.id)];
  renderPagination('cost-config-pages',rows.length,configPage,'page','size',renderConfigs);
  configBody.innerHTML=rows.slice((configPage.page-1)*configPage.size,configPage.page*configPage.size).map(config=>`<tr>
   <td>${config.id}</td><th scope="row">${escape(config.name)}</th><td>${config.sites.join(', ')}</td>
   <td>${config.effective}</td><td>${config.feeType}</td><td>${config.updated}</td><td>${escape(config.operator)}</td>
   <td>${config===otherRule?'—':`<div class="cost-row-actions"><button type="button" class="cost-link" data-cost-edit="${config.id}">编辑</button><button type="button" class="cost-link cost-danger" data-cost-delete="${config.id}">删除</button></div>`}</td>
   </tr>`).join('');
 }
 function syncRules(){
  const cards=[...ruleList.children];
  cards.forEach((card,index)=>{
   const label='规则 '+(index+1);
   card.querySelector('h3').textContent=label;
   const removeCard=card.querySelector('[data-remove-rule]');
   removeCard.setAttribute('aria-label','删除'+label);
   removeCard.hidden=cards.length<2;
   const rows=[...card.querySelectorAll('.cost-rule-row')];
   rows.forEach((row,fragmentIndex)=>{
    const fragmentLabel=`${label}的模型字符 ${fragmentIndex+1}`;
    row.querySelector('input').setAttribute('aria-label',fragmentLabel);
    row.querySelector('button').setAttribute('aria-label','删除'+fragmentLabel);
    row.querySelector('button').hidden=rows.length<2;
   });
  });
 }
 function addFragment(list,value=''){
  const row=document.createElement('div');
  row.className='cost-rule-row';
  row.innerHTML='<input required placeholder="请输入账单模型名称中的字符" maxlength="120"><button type="button" class="cost-link cost-danger">删除</button>';
  const input=row.querySelector('input');
  input.value=value;
  row.querySelector('button').onclick=()=>{
   if(list.children.length<2)return;
   const focusRow=row.nextElementSibling??row.previousElementSibling;
   row.remove();
   syncRules();
   focusRow.querySelector('input').focus();
  };
  list.append(row);
  return input;
 }
 function addRule({logic='all',fragments=['']}={}){
  const card=document.createElement('div');
  card.className='cost-rule-card';
  card.innerHTML=`<div class="cost-rule-card-head"><h3></h3>
   <button type="button" class="cost-link cost-danger" data-remove-rule>删除规则</button></div>
   <label>生效逻辑<select required><option value="all">必须同时满足</option><option value="any">满足其中一个即可</option></select></label>
   <div class="field"><span>模型字符</span><div class="cost-rule-fragments"></div></div>
   <button type="button" class="cost-link cost-fragment-add">＋ 新增模型字符</button>`;
  card.querySelector('select').value=logic;
  const list=card.querySelector('.cost-rule-fragments');
  fragments.forEach(value=>addFragment(list,value));
  card.querySelector('.cost-fragment-add').onclick=()=>{
   const input=addFragment(list);
   syncRules();
   input.focus();
  };
  card.querySelector('[data-remove-rule]').onclick=()=>{
   if(ruleList.children.length<2)return;
   const focusCard=card.nextElementSibling??card.previousElementSibling;
   card.remove();
   syncRules();
   focusCard.querySelector('select').focus();
  };
  ruleList.append(card);
  syncRules();
  return card;
 }
 function showConfig(config){
  editingId=config?.id??null;
  form.reset();
  $('#cost-config-title').textContent=config?'编辑配置':'新增配置';
  $('#cost-config-error').textContent='';
  form.elements.modelName.value=config?.name??'';
  for(const input of form.elements.site)input.checked=config?.sites.includes(input.value)??false;
  form.elements.effective.value=config?.effective??today();
  form.elements.feeType.value=modelFeeType;
  ruleList.replaceChildren();
  (config?.rules??[{}]).forEach(addRule);
  dialog.showModal();
 }
 $('#cost-config-add').onclick=()=>showConfig();
 const configTabs=[...$('#cost-rule-tabs').querySelectorAll('[role="tab"]')];
 function selectConfigTab(tab){
  for(const candidate of configTabs){
   const selected=candidate===tab;
   candidate.classList.toggle('selected',selected);
   candidate.setAttribute('aria-selected',selected);
   candidate.tabIndex=selected?0:-1;
   document.getElementById(candidate.getAttribute('aria-controls')).hidden=!selected;
  }
  $('#cost-config-add').hidden=tab.id!=='cost-rule-model-tab';
 }
 for(const tab of configTabs){
  tab.onclick=()=>selectConfigTab(tab);
  tab.onkeydown=event=>{
   const next=event.key==='Home'?configTabs[0]:event.key==='End'?configTabs.at(-1):
    ['ArrowLeft','ArrowRight'].includes(event.key)?configTabs.find(candidate=>candidate!==tab):null;
   if(!next)return;
   event.preventDefault();
   selectConfigTab(next);
   next.focus();
  };
 }
 $('#cost-rule-add').onclick=()=>addRule().querySelector('select').focus();
 document.querySelectorAll('[data-close-cost]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
 form.onsubmit=event=>{
  event.preventDefault();
  const values=new FormData(form),name=values.get('modelName').trim();
  const selectedSites=values.getAll('site'),effective=values.get('effective');
  const rules=[...ruleList.children].map(card=>({
   logic:card.querySelector('select').value,
   fragments:[...card.querySelectorAll('input')].map(input=>input.value.trim())
  }));
  const error=$('#cost-config-error');
  if(!name){error.textContent='请输入模型名称';return;}
  if(name===otherRule.name||data.configs.some(config=>config.id!==editingId&&normalize(config.name)===normalize(name))){
   error.textContent='模型名称已存在';return;
  }
  if(!selectedSites.length){error.textContent='请选择站点';return;}
  for(const [index,{fragments}] of rules.entries()){
   if(fragments.some(fragment=>!fragment)){error.textContent=`规则 ${index+1}：请输入模型字符`;return;}
   if(new Set(fragments.map(normalize)).size!==fragments.length){error.textContent=`规则 ${index+1}：模型字符不能重复`;return;}
  }
  const adding=editingId===null;
  const config={id:adding?data.nextId:editingId,name,sites:selectedSites,effective,feeType:modelFeeType,rules,
   updated:FinanceModel.formatTime(Date.now(),'Asia/Shanghai').slice(0,16),operator:'finance.admin'};
  const configs=adding?[...data.configs,config]:data.configs.map(old=>old.id===config.id?config:old);
  save({nextId:data.nextId+Number(adding),configs});
  dialog.close();
  if(adding)configPage.page=1;
  renderConfigs();
  notify(adding?'配置已新增':'配置已更新');
 };
 configBody.onclick=event=>{
  const button=event.target.closest('[data-cost-edit],[data-cost-delete]');
  if(!button)return;
  const config=data.configs.find(item=>item.id===Number(button.dataset.costEdit??button.dataset.costDelete));
  if(!config)return;
  if(button.hasAttribute('data-cost-edit')){showConfig(config);return;}
  deletingId=config.id;
  $('#cost-delete-message').textContent=`确定删除「${config.name}」的成本配置吗？`;
  deleteDialog.showModal();
 };
 $('#cost-delete-confirm').onclick=()=>{
  save({...data,configs:data.configs.filter(config=>config.id!==deletingId)});
  deleteDialog.close();
  renderConfigs();
  notify('配置已删除');
 };
 const importDialog=$('#cost-import-dialog'),importForm=$('#cost-import-form');
 const importError=$('#cost-import-error'),importProgress=$('#cost-import-progress');
 const mainlandBill={
  name:'aliyun_bill_details.csv',
  columns:['BillingDate','ProductName','ProductCode','ProductDetail','CommodityCode','BillingItem','InstanceID','Item','SubscriptionType','Currency',
   'PretaxAmount','PretaxGrossAmount','AfterDiscountAmount','Usage','UsageUnit','ModelName'],
  amount:'AfterDiscountAmount',
  currency:'Currency',
  model:'ModelName'
 };
 const overseasBill={
  name:'cost_details.csv',
  columns:['start_utc','end_utc','service','usage_type','model_id','category','cost_metric','amount','currency','estimated','time_basis'],
  amount:'amount',
  currency:'currency',
  model:'model_id'
 };
 const awsFiles=[['modelUsage','model_usage.csv'],['featureUsage','feature_usage.csv'],['costDetails',overseasBill.name]];
 const billTemplateFor=site=>site==='中国大陆'?mainlandBill:overseasBill;
 let importSite=null,importBusy=false;
 $('#cost-import-open').onclick=()=>{
  importSite=state.site;
  importForm.reset();
  importError.textContent='';
  importProgress.textContent='';
  const mainland=importSite==='中国大陆';
  $('#cost-import-mainland').hidden=!mainland;
  $('#cost-import-aws').hidden=mainland;
  $('#cost-import-scope').textContent=mainland
   ?`当前站点：${importSite}。请选择一份 CSV 账单。`
   :`当前站点：${importSite}。请选择三份 CSV 文件。`;
  importDialog.showModal();
 };
 function parseBillCsv(text){
  const source=text.replace(/^\uFEFF/,'');
  const rows=[];
  let row=[],field='',quoted=false,closedQuote=false;
  for(let i=0;i<source.length;i++){
   const char=source[i];
   if(quoted){
    if(char==='"'&&source[i+1]==='"'){field+='"';i++;}
    else if(char==='"'){quoted=false;closedQuote=true;}
    else field+=char;
    continue;
   }
   if(char===','||char==='\r'||char==='\n'){
    row.push(field.trim());
    field='';
    closedQuote=false;
    if(char===',')continue;
    if(char==='\r'&&source[i+1]==='\n')i++;
    if(row.some(Boolean))rows.push(row);
    row=[];
   }else if(char==='"'&&!field&&!closedQuote){
    quoted=true;
   }else{
    if(closedQuote||char==='"')throw Error('CSV 引号格式不正确');
    field+=char;
   }
  }
  if(quoted)throw Error('CSV 引号未闭合');
  row.push(field.trim());
  if(row.some(Boolean))rows.push(row);
  return rows;
 }
 function readBillRows(text,site){
  const [header,...rows]=parseBillCsv(text);
  const template=billTemplateFor(site),currency=sites[site].currency;
  if(!header||template.columns.some(column=>!header.includes(column))){
   throw Error(`账单 CSV 表头与 ${template.name} 的字段不匹配`);
  }
  if(!rows.length)throw Error('CSV 中没有账单数据');
  const positions=new Map(header.map((name,index)=>[name,index]));
  const configs=rulesFor(site);
  return rows.map((row,index)=>{
   const cell=name=>row[positions.get(name)]??'';
   const mainland=template===mainlandBill;
   const start=cell(mainland?'BillingDate':'start_utc');
   const date=start.slice(0,10);
   const timestamp=Date.parse(mainland?start+'T12:00:00Z':start);
   const dateFormat=mainland?/^\d{4}-\d{2}-\d{2}$/:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/i;
   if(!dateFormat.test(start)||!Number.isFinite(timestamp)||new Date(timestamp).toISOString().slice(0,10)!==date){
    throw Error(`第 ${index+2} 行的账单起始日期格式不正确`);
   }
   if(cell(template.currency).toUpperCase()!==currency)throw Error(`第 ${index+2} 行的币种须为 ${currency}`);
   const fee=cell(template.amount);
   const amountUnits=Math.round(Number(fee)*costAmountScale);
   if(!/^-?\d+(?:\.\d{1,8})?$/.test(fee)||!Number.isSafeInteger(amountUnits)){
    throw Error(`第 ${index+2} 行的 ${template.amount} 金额格式不正确`);
   }
   let actual=null;
   if(mainland&&/^tokens?$/i.test(cell('UsageUnit'))&&cell('Usage')!==''){
    actual=Number(cell('Usage'));
    if(!Number.isSafeInteger(actual)||actual<0)throw Error(`第 ${index+2} 行的 Token 用量须为非负整数`);
   }
   return {site,timestamp,model:matchModel(cell(template.model),date,configs),tokens:null,actual,amountUnits,
    product:'',usageType:'',billEnvironment:''};
  });
 }
 function readAwsUsage(text,name){
  let rows;
  try{rows=parseBillCsv(text);}catch(error){throw Error(`${name}：${error.message}`);}
  const [header,...dataRows]=rows;
  if(!header||header.some(value=>!value)||new Set(header).size!==header.length||
   dataRows.some(row=>row.length!==header.length)){
   throw Error(`${name} 的表头或行格式不正确`);
  }
  return {name,header,rows:dataRows};
 }
 function selectedImportFiles(site){
  if(site==='中国大陆'){
   const file=importForm.elements.bill.files[0];
   if(!file||file.name.toLowerCase()!==mainlandBill.name)throw Error('请选择 '+mainlandBill.name+' 文件');
   return [file];
  }
  return awsFiles.map(([inputName,filename])=>{
   const file=importForm.elements[inputName].files[0];
   if(!file)throw Error('请上传 '+filename);
   if(file.name.toLowerCase()!==filename)throw Error('请选择 '+filename+' 文件');
   return file;
  });
 }
 function setImportBusy(busy){
  importBusy=busy;
  for(const control of importForm.querySelectorAll('input,button'))control.disabled=busy;
  importForm.setAttribute('aria-busy',busy);
 }
 importDialog.addEventListener('cancel',event=>{if(importBusy)event.preventDefault();});
 importForm.onsubmit=async event=>{
  event.preventDefault();
  if(importBusy)return;
  const site=importSite;
  importError.textContent='';
  try{
   const files=selectedImportFiles(site);
   setImportBusy(true);
   importProgress.textContent='正在读取账单…';
   const contents=await Promise.all(files.map(file=>file.text()));
   const bills=readBillRows(contents.at(-1),site);
   const batch=site==='中国大陆'?null:{
    site,modelUsage:readAwsUsage(contents[0],awsFiles[0][1]),featureUsage:readAwsUsage(contents[1],awsFiles[1][1])
   };
   importProgress.textContent='正在匹配模型和收入…';
   await new Promise(resolve=>setTimeout(resolve,450));
   const next={bills:[...imports.bills,...bills],awsUsage:batch?[...imports.awsUsage,batch]:imports.awsUsage};
   localStorage.setItem(importedKey,JSON.stringify(next));
   imports=next;
   importDialog.close();
   if(state.site===site&&location.hash==='#cost-details'){
    resetSummary();
    refreshSummary();
   }
   notify('账单导入成本');
  }catch(error){
   importError.textContent='账单导入失败：'+error.message;
  }finally{
   setImportBusy(false);
   importProgress.textContent='';
  }
 };
 function refreshSummary(){
  const rows=mappedRecords();
  syncModels(rows);
  renderSummary(rows);
 }
 return {
  route(details,config){
   hideTextTooltip();
   hideTokenTip();
   $('#cost-details-view').hidden=!details;
   $('#cost-config-view').hidden=!config;
   zoneSelect.value=details?siteZone():state.timezone;
   zoneSelect.disabled=details;
   if(details)refreshSummary();
   else showCostExports(false);
   if(config)renderConfigs();
  },
  changeSite(){
   zoneSelect.value=siteZone();
   showCostExports(false);
   search.elements.model.value='';
   filters.model='';
   resetSummary();
   refreshSummary();
  },
  zone:siteZone
 };
})();

function route(){
 const hash=location.hash.slice(1),costDetails=hash==='cost-details',costConfig=hash==='cost-config',cost=costDetails||costConfig,detail=hash.startsWith('detail/'),bills=hash==='bills',payment=hash==='orders';
 $('#payment-view').hidden=!payment;$('.timezone-field').hidden=payment||costConfig;$('.site-field').hidden=costConfig;$('#payment-nav').classList.toggle('active',payment);$('#payment-center-label').classList.toggle('payment-active',payment);if(payment)PaymentPage.render();

 if(detail){state.order=FinanceModel.orders.find(o=>o.id===Number(hash.split('/')[1])&&o.site===state.site);if(!state.order){location.hash='income';return;}state.tab='daily';state.detailPage=1;renderDetail();}
 else state.order=null;
 CostPages.route(costDetails,costConfig);
 $('.page-heading').hidden=!bills;$('#list-view').hidden=detail||bills||payment||cost;$('#detail-view').hidden=!detail;$('#bills-view').hidden=!bills;
 const title=costDetails?'成本明细':costConfig?'模型匹配规则':bills?'账单汇总':detail?'分摊明细':'收入明细';
 $('#page-title').textContent=title;$('#page-subtitle').textContent=bills?'订阅业务账单管理':detail?'查看订单对应的收入确认与借贷记录':'查询订阅订单收入，追踪每日与每月的分摊记录';
 $('#breadcrumb').innerHTML='财务中心 <b>›</b> '+(detail?'<a href="#income">收入明细</a> <b>›</b> '+title:title);
 if(payment)$('#breadcrumb').innerHTML='首页 <b>›</b> 支付中心 <b>›</b> 订单管理';
 document.querySelectorAll('#finance-nav a').forEach(a=>a.classList.toggle('active',!payment&&a.hash===(cost?'#'+hash:bills?'#bills':'#income')));
}
window.addEventListener('hashchange',route);setDefaultPaymentDates();$('#search-form').requestSubmit();route();

// UTF-8 CSV files in a standards-compliant ZIP (stored entries, no dependencies).
function exportCsv(rows){return '\ufeff'+rows.map(row=>row.map(value=>{let text=String(value??'');if(/^[=+@\t\r]/.test(text)||(/^-/ .test(text)&&!/^-[\d,.]+$/.test(text)))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
function exportZip(files,type='application/zip'){
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
 return new Blob([...parts,...central,end],{type});
}
function costExportWorkbook(sheets,currency){
 const spreadsheet='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const office='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
 const packageRels='http://schemas.openxmlformats.org/package/2006/relationships';
 const part=(name,xml)=>({name,text:'<?xml version="1.0" encoding="UTF-8"?>'+xml});
 const sheetParts=sheets.map((sheet,i)=>({sheet,id:i+1,path:`worksheets/sheet${i+1}.xml`}));
 const contentType=(path,type)=>`<Override PartName="/xl/${path}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${type}+xml"/>`;
 const relationship=(id,type,target)=>`<Relationship Id="${id}" Type="${office}/${type}" Target="${target}"/>`;
 const relationships=entries=>`<Relationships xmlns="${packageRels}">${entries.join('')}</Relationships>`;
 const styles=`<styleSheet xmlns="${spreadsheet}">
  <numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;${currency==='CNY'?'¥':'$'}&quot;#,##0.00######"/>
   <numFmt numFmtId="165" formatCode="&quot;$&quot;#,##0.00######"/></numFmts>
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
   <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
   <xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
   <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
   <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
 </styleSheet>`;
 const worksheet=({rows})=>{
  const headings=rows[0];
  const columnWidths=headings.map(heading=>({'统计时间':16,'模型名称':34,'产品名称':76,'使用类型':24,'费用来源':74,'实际消耗 Token':23}[heading]??20));
  const rowXml=rows.map((row,i)=>`<row r="${i+1}">${row.map((value,j)=>{
   const reference=String.fromCharCode(65+j)+(i+1);
   if(typeof value==='number'){
    const heading=headings[j];
    const style=heading.endsWith('(USD)')?4:['查询/存储费用','Token费用','费用总金额'].includes(heading)?3:2;
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
   }
   const safeText=escapeHtml(String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,''));
   return `<c r="${reference}" s="${i===0?1:0}" t="inlineStr"><is><t xml:space="preserve">${safeText}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<worksheet xmlns="${spreadsheet}"><cols>${columnWidths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rowXml}</sheetData></worksheet>`;
 };
 return exportZip([
  part('[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${contentType('workbook.xml','sheet.main')}${contentType('styles.xml','styles')}${sheetParts.map(({path})=>contentType(path,'worksheet')).join('')}</Types>`),
  part('_rels/.rels',relationships([relationship('rId1','officeDocument','xl/workbook.xml')])),
  part('xl/workbook.xml',`<workbook xmlns="${spreadsheet}" xmlns:r="${office}"><sheets>${sheetParts.map(({sheet,id})=>`<sheet name="${escapeHtml(sheet.name)}" sheetId="${id}" r:id="rId${id}"/>`).join('')}</sheets></workbook>`),
  part('xl/_rels/workbook.xml.rels',relationships([...sheetParts.map(({id,path})=>relationship('rId'+id,'worksheet',path)),relationship('rIdStyles','styles','styles.xml')])),
  part('xl/styles.xml',styles),
  ...sheetParts.map(({sheet,path})=>part('xl/'+path,worksheet(sheet)))
 ],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
function downloadExportJob(job){
 const url=URL.createObjectURL(job.blob),link=document.createElement('a');
 link.href=url;
 link.download=job.name;
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function incomeExportFiles(orders,start,end,zone){
 const stamp=n=>FinanceModel.formatTime(n,zone).slice(0,16),date=n=>n===null?'—':FinanceModel.formatTime(n,zone).slice(0,16);
 const orderRows=[headers.slice(0,-1)],daily=[['支付订单ID','平台订单ID','统计时间','会计科目','借贷方向','币种','金额']],monthly=[['支付订单ID','平台订单ID','统计时间','会计科目','借贷方向','币种','金额']];
 for(const o of orders){
  const rows=FinanceModel.ledger(o).filter(r=>r.date>=start&&r.date<=end);if(!rows.length)continue;
  const b=FinanceModel.balances(o);
  orderRows.push([o.order,o.platform,o.product,o.provider,o.status,FinanceModel.allocationStatus(o),o.currency,...[o.price,o.userPaid??o.price+o.tax,o.tax,(o.userPaid??o.price+o.tax)-o.tax,o.commission,o.refund?(o.refundAmount??o.price+o.tax):0,o.refund?(o.refundTax??o.tax):0,FinanceModel.netRefund(o),FinanceModel.netIncome(o),b.revenue,b.liability,b.financialExpenses].map(n=>amountText(n,o.currency,false)),o.country,o.account,o.discountType,date(FinanceModel.firstAllocationTimestamp(o)),date(FinanceModel.latestAllocationTimestamp(o)),stamp(o.paid),stamp(o.refund),FinanceModel.anomalyRemark(o)||'—']);
  const record=r=>[o.order,o.platform,stamp(r.timestamp),r.account,r.direction,o.currency,amountText(r.cents,o.currency,false)];
  daily.push(...rows.map(record));monthly.push(...FinanceModel.monthly(rows).map(record));
 }
 if(orderRows.length===1)return [];
 return [{name:'订单明细.csv',text:exportCsv(orderRows)},{name:'分摊明细/日明细.csv',text:exportCsv(daily)},{name:'分摊明细/月明细.csv',text:exportCsv(monthly)}];
}
const EXPORT_RECENT_COUNT=3;
let exportJobs=[],exportBusy=false,exportToastTimer;
const exportIcon=kind=>kind==='loading'?'<svg class="export-spin" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const exportDateTime=timestamp=>new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(timestamp);
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function openExportDb(name='ringconn-prototype-v2-income-export'){return new Promise((resolve,reject)=>{const request=indexedDB.open(name,1);request.onupgradeneeded=()=>request.result.createObjectStore('jobs',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function readExportJobs(database){try{const db=await openExportDb(database);return await new Promise((resolve,reject)=>{const tx=db.transaction('jobs','readonly'),request=tx.objectStore('jobs').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close();});}catch{return [];}}
async function saveExportJob(job,database){try{const db=await openExportDb(database);await new Promise((resolve,reject)=>{const tx=db.transaction('jobs','readwrite');tx.objectStore('jobs').put(job);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch{/* Keep the result available for this page session. */}}
function recentExportJobs(){
 return exportJobs.filter(job=>(job.site||'中国大陆')===state.site).sort((a,b)=>b.createdAt-a.createdAt).slice(0,EXPORT_RECENT_COUNT);
}
function renderExportHistory(){
 const jobs=recentExportJobs(),button=$('#export-open');
 button.disabled=exportBusy;button.innerHTML=(exportBusy?exportIcon('loading'):jobs.length?exportIcon('download'):'')+'<span>导出</span>';
 button.setAttribute('aria-label',exportBusy?'正在生成导出数据':jobs.length?'查看导出记录':'导出');
 $('#export-history-list').innerHTML=jobs.map(job=>`<div class="export-history-row"><div><strong title="${escapeHtml(job.name)}">${escapeHtml(job.name)}</strong><small>${exportDateTime(job.createdAt)}</small></div><button type="button" data-export-id="${escapeHtml(job.id)}" aria-label="下载 ${escapeHtml(job.name)}" title="下载">${exportIcon('download')}</button></div>`).join('')||'<p class="export-history-empty">暂无导出文件</p>';
}
function showExportToast(message){const toast=$('#export-toast');toast.textContent=message;toast.hidden=false;clearTimeout(exportToastTimer);exportToastTimer=setTimeout(()=>toast.hidden=true,4000);}
function openExportDialog(){$('#export-history').hidden=true;$('#export-error').textContent='';$('#export-dialog').showModal();}
$('#export-open').onclick=e=>{e.stopPropagation();if(exportBusy)return;if(recentExportJobs().length){$('#export-history').hidden=!$('#export-history').hidden;renderExportHistory();}else openExportDialog();};
$('#export-new').onclick=openExportDialog;
$('#export-history-list').onclick=e=>{const button=e.target.closest('[data-export-id]');if(!button)return;const job=recentExportJobs().find(item=>item.id===button.dataset.exportId);if(!job)return;downloadExportJob(job);$('#export-history').hidden=true;};
document.addEventListener('click',e=>{if(!e.target.closest('#export-open,#export-history'))$('#export-history').hidden=true;});
readExportJobs().then(jobs=>{exportJobs=[...jobs,...exportJobs.filter(job=>!jobs.some(saved=>saved.id===job.id))];renderExportHistory();});
for(const id of ['export-close','export-cancel'])$('#'+id).onclick=()=>$('#export-dialog').close();
$('#export-dialog').onclick=e=>{if(e.target===$('#export-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
$('#export-form').onsubmit=async e=>{
 e.preventDefault();const form=e.target,start=form.elements.start.value,end=form.elements.end.value,error=$('#export-error');
 if(!start||!end){error.textContent='请选择导出时间范围';return;}
 if(start>end){error.textContent='开始日期不能晚于结束日期';return;}
 if((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000>365){error.textContent='最大时间段为 1 年。';return;}
 const orders=[...state.filtered],zone=state.timezone,site=state.site;
 $('#export-dialog').close();exportBusy=true;renderExportHistory();showExportToast('正在生成数据，请稍后查看导出结果并下载');
 try{
  await new Promise(resolve=>setTimeout(resolve,900));
  const files=incomeExportFiles(orders,start,end,zone);
  if(!files.length)throw Error('所选时间范围内暂无可导出的分摊数据');
  const job={id:crypto.randomUUID(),site,name:`收入分摊_${site}_${start}_${end}.zip`,createdAt:Date.now(),blob:exportZip(files)};
  exportJobs.unshift(job);await saveExportJob(job);showExportToast('数据已生成，可点击导出按钮下载');
 }catch(err){showExportToast(err.message||'导出失败，请重试');}
 finally{exportBusy=false;renderExportHistory();}
};

let amountOrder=null;
const editableAmountFields=o=>o.provider==='Google'?[['userPaid','用户支付金额'],['tax','税费'],['refundAmount','退款金额'],['refundTax','退款税费'],['netIncome','净利润']]:[['userPaid','用户支付金额'],['refundAmount','退款金额'],['netIncome','净利润'],['netRefund','净退款额']];
function openAmountEditor(id){
 const o=FinanceModel.orders.find(order=>order.id===id);if(!o)return;amountOrder=o;
 $('#amount-form').reset();$('#amount-error').textContent='';
 $('#amount-meta').innerHTML=[['支付订单ID',o.order],['平台订单ID',o.platform],['产品 ID',o.product],['产品价格',money(o.price,o.currency)],['币种',o.currency],['收入分摊截止时间',time(FinanceModel.latestAllocationTimestamp(o))]].map(([name,value])=>`<div class="summary-item"><span>${name}</span><strong>${value}</strong></div>`).join('');
 const values={userPaid:o.userPaid??o.price+o.tax,tax:o.tax,refundAmount:o.refund?(o.refundAmount??o.price+o.tax):0,refundTax:o.refund?(o.refundTax??o.tax):0,netIncome:FinanceModel.netIncome(o),netRefund:FinanceModel.netRefund(o)};
 $('#amount-fields').innerHTML=editableAmountFields(o).map(([key,label])=>`<label>${label}<input name="${key}" inputmode="${o.currency==='JPY'?'numeric':'decimal'}" type="text" required value="${amountText(values[key]??0,o.currency,false)}" placeholder="请输入金额"></label>`).join('');
 $('#amount-apple-option').hidden=o.provider!=='Apple';$('#amount-form').elements.reportMatched.value=(o.reportMatched??!o.unmatchedOverThreeDays)?'yes':'no';syncAmountFields();const eligibility=FinanceModel.resetEligibility(o);$('#reset-eligibility').textContent=eligibility.allowed?'重置后原分摊记录将标记删除，已确认收入、合同负债、销售费用清零，等待重新分摊。':eligibility.reason;$('#amount-form').querySelector('[type=submit]').disabled=!eligibility.allowed;$('#amount-dialog').showModal();
}
for(const id of ['amount-close','amount-cancel'])$('#'+id).onclick=()=>$('#amount-dialog').close();
$('#amount-dialog').addEventListener('close',()=>{amountOrder=null;});
$('#amount-form').onsubmit=e=>{
 e.preventDefault();if(!amountOrder)return;const form=e.target,values={};
 for(const [key,label] of editableAmountFields(amountOrder).filter(([key])=>amountOrder.provider!=='Apple'||form.elements.reportMatched.value==='yes'||key==='netIncome')){
  const raw=form.elements[key].value.trim();
  const valid=amountPattern(amountOrder.currency,key==='netIncome').test(raw);
  if(!valid){$('#amount-error').textContent=label+'：'+amountRule(amountOrder.currency);form.elements[key].focus();return;}
  values[key]=Math.round(Number(raw)*1000);
 }
 values.reportMatched=form.elements.reportMatched.value==='yes';
 if(amountOrder.provider==='Apple'&&values.reportMatched&&values.netRefund>values.refundAmount){$('#amount-error').textContent='净退款额不能大于退款金额';form.elements.netRefund.focus();return;}
 try{const result=FinanceModel.resetAllocation(amountOrder,values);$('#reset-result').textContent=`重置分摊完成：原 ${result.deletedCount} 条记录已标记删除，已确认收入、合同负债、销售费用已清零，等待重新分摊。`;$('#reset-result').hidden=false;}catch(error){$('#amount-error').textContent=error.message;return;}
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
 const button=e.target.closest('[data-ledger-edit]');if(!button)return;
 const record=state.visibleLedger[Number(button.dataset.ledgerEdit)];if(!record)return;
 const daily=FinanceModel.ledger(state.order).map((r,index)=>({...r,index}));
 const all=state.tab==='monthly'?FinanceModel.monthly(daily):daily;
 const group=all.filter(r=>r.timestamp===record.timestamp);
 editingLedger={order:state.order,rows:group.map(r=>({selection:{tab:state.tab,index:r.index,date:r.date,account:r.account,timestamp:r.timestamp},readonly:!!(r.superseded||r.event==='edit-reversal')}))};
 $('#ledger-edit-meta').innerHTML=[['统计时间',time(record.timestamp)],['币种',state.order.currency]].map(([label,value])=>`<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`).join('');
 $('#ledger-edit-rows').innerHTML=group.map((r,index)=>{const readonly=editingLedger.rows[index].readonly;return `<div class="ledger-edit-row${readonly?' readonly':''}" data-edit-row="${index}"><span>${r.account}${readonly?' <small>已冲回</small>':''}</span><select name="direction" aria-label="第 ${index+1} 条借贷方向" ${readonly?'disabled':''}><option ${r.direction==='借记'?'selected':''}>借记</option><option ${r.direction==='贷记'?'selected':''}>贷记</option></select><input name="amount" aria-label="第 ${index+1} 条金额" inputmode="${state.order.currency==='JPY'?'numeric':'decimal'}" value="${amountText(r.cents,state.order.currency,false)}" ${readonly?'disabled':''}></div>`;}).join('');
 $('#ledger-edit-error').textContent='';$('#ledger-edit-dialog').showModal();
};
for(const id of ['ledger-edit-close','ledger-edit-cancel'])$('#'+id).onclick=()=>$('#ledger-edit-dialog').close();
$('#ledger-edit-dialog').addEventListener('close',()=>{editingLedger=null;});
$('#ledger-edit-form').onsubmit=e=>{
 e.preventDefault();if(!editingLedger)return;const edits=[];
 for(const [index,record] of editingLedger.rows.entries()){
  if(record.readonly)continue;
  const row=$(`#ledger-edit-rows [data-edit-row="${index}"]`),raw=row.querySelector('[name=amount]').value.trim();
  if(!amountPattern(state.order.currency).test(raw)){$('#ledger-edit-error').textContent=amountRule(state.order.currency);return;}
  edits.push({selection:record.selection,direction:row.querySelector('[name=direction]').value,cents:Math.round(Number(raw)*1000)});
 }
 try{FinanceModel.editLedgerGroup(editingLedger.order,edits);}catch(error){$('#ledger-edit-error').textContent=error.message;return;}
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
 closeRangeCalendar();const [start,end]=box.querySelectorAll('input[type=hidden]'),today=FinanceModel.dateInZone(Date.now(),box.dataset.range==='cost'?CostPages.zone():state.timezone),date=(start.value||today).slice(0,10).split('-').map(Number);
 const firstMonth=box.dataset.range==='export'&&!start.value?date[1]-2:date[1]-1;
 rangeDraft={box,start:start.value.slice(0,10),end:end.value.slice(0,10),year:date[0],month:firstMonth};
 const calendar=$('#range-calendar');(box.closest('dialog')||box.closest('[popover]')||document.body).append(calendar);
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
 start.value=a;end.value=b;closeRangeCalendar();syncRangeLabels();if(stat)box.closest('form').requestSubmit();if(box.dataset.range==='export')$('#export-error').textContent='';
}
$('#range-clear').onclick=()=>applyRange(true);$('#range-apply').onclick=()=>applyRange();
document.addEventListener('mousedown',e=>{if(rangeDraft&&!$('#range-calendar').contains(e.target)&&!rangeDraft.box.contains(e.target))closeRangeCalendar();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&rangeDraft){closeRangeCalendar();e.preventDefault();}});
document.addEventListener('toggle',e=>{if(e.newState==='closed'&&rangeDraft&&e.target.contains(rangeDraft.box))closeRangeCalendar();},true);
$('#export-dialog').addEventListener('close',closeRangeCalendar);
syncRangeLabels();

const PACIFIC_ZONE='America/Los_Angeles';
const manualEntries=$('#manual-entries');
function updateManualEntryControls(){
 const rows=[...manualEntries.querySelectorAll('.manual-entry')];
 rows.forEach((row,index)=>{
  row.querySelector('.manual-entry-title').textContent=`会计科目 ${index+1}`;
  row.querySelector('[data-remove-manual]').disabled=rows.length<2;
 });
}
function addManualEntry(){
 manualEntries.insertAdjacentHTML('beforeend',`<div class="manual-entry"><div class="manual-entry-header"><strong class="manual-entry-title"></strong><button type="button" data-remove-manual aria-label="删除此会计科目">删除</button></div><label><span><b class="required" aria-hidden="true">*</b> 会计科目</span><select name="account"><option value="">请选择会计科目</option><option>平台应收账款</option><option>合同负债</option><option>主营业务收入</option><option>销售费用</option></select></label><label><span><b class="required" aria-hidden="true">*</b> 借贷方向</span><select name="direction"><option value="">请选择借贷方向</option><option>借记</option><option>贷记</option></select></label><label><span><b class="required" aria-hidden="true">*</b> 金额/天</span><div class="manual-amount"><input name="amount" inputmode="${state.order.currency==='JPY'?'numeric':'decimal'}" aria-label="金额/天" placeholder="请输入金额"><span>${state.order.currency}</span></div></label></div>`);
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
  if(!account){$('#ledger-add-error').textContent='请选择会计科目';return;}
  if(!direction){$('#ledger-add-error').textContent='请选择借贷方向';return;}
  if(!raw){$('#ledger-add-error').textContent='请输入金额';return;}
  if(!amountPattern(state.order.currency).test(raw)){$('#ledger-add-error').textContent=amountRule(state.order.currency);return;}
  entries.push({account,direction,cents:Math.round(Number(raw)*1000)});
 }
 try{FinanceModel.addManualRecords(state.order,{startDate:f.elements.startDate.value,endDate:f.elements.endDate.value,entries});}catch(error){$('#ledger-add-error').textContent=error.message;return;}
 $('#ledger-add-dialog').close();renderDetail();renderList();
};
$('#ledger-complete').onclick=()=>{$('#ledger-complete-error').textContent='';$('#ledger-complete-dialog').showModal();};
$('#ledger-complete-cancel').onclick=()=>$('#ledger-complete-dialog').close();
$('#ledger-complete-confirm').onclick=()=>{
 try{FinanceModel.completeAllocation(state.order);}catch(error){$('#ledger-complete-error').textContent=error.message;return;}
 $('#ledger-complete-dialog').close();$('#complete-result').textContent='完成分摊成功';$('#complete-result').hidden=false;
 renderDetail();$('#search-form').requestSubmit();
};
