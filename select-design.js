(() => {
  'use strict';
  let source=null,popup=null,active=-1,items=[];
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function close(){
    if(source){source.setAttribute('aria-expanded','false');source.removeAttribute('aria-activedescendant');source.removeAttribute('aria-controls');}
    popup?.remove();popup=null;source=null;
  }
  function options(el){
    if(el.tagName==='SELECT')return [...el.options].map(o=>({value:o.value,label:o.textContent,disabled:o.disabled||o.parentElement.disabled,selected:o.selected}));
    const list=document.getElementById(el.dataset.designList||el.getAttribute('list'));
    return [...(list?.options||[])].filter(o=>o.value.toLowerCase().startsWith(el.value.toLowerCase())).map(o=>({value:o.value,label:o.label||o.value,selected:o.value===el.value}));
  }
  function position(){if(!source?.isConnected||!source.getClientRects().length){close();return;}const r=source.getBoundingClientRect();popup.style.width=Math.max(r.width,100)+'px';popup.style.left=Math.max(4,Math.min(r.left,innerWidth-popup.offsetWidth-4))+'px';popup.style.top=(r.bottom+4+popup.offsetHeight>innerHeight&&r.top>popup.offsetHeight?r.top-popup.offsetHeight-4:r.bottom+4)+'px';}
  function mark(){if(!popup)return;[...popup.children].forEach((el,i)=>el.classList.toggle('is-active',i===active));if(active>=0){source.setAttribute('aria-activedescendant',`design-option-${active}`);popup.children[active]?.scrollIntoView({block:'nearest'});}}
  function draw(){items=options(source);popup.innerHTML=items.length?items.map((o,i)=>`<div id="design-option-${i}" class="select-design-option" role="option" data-index="${i}" aria-selected="${!!o.selected}" aria-disabled="${!!o.disabled}">${escape(o.label)}</div>`).join(''):'<div class="select-design-empty">暂无数据</div>';active=items.findIndex(o=>o.selected&&!o.disabled);position();mark();}
  function choose(i){const item=items[i];if(!item||item.disabled)return;const el=source;el.value=item.value;close();el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));if(el.isConnected)el.focus();}
  function open(el){
    close();source=el;source.setAttribute('aria-expanded','true');source.setAttribute('aria-controls','design-select-popup');source.setAttribute('aria-haspopup','listbox');
    popup=document.createElement('div');popup.id='design-select-popup';popup.className='select-design-popup';popup.role='listbox';popup.setAttribute('aria-label',el.getAttribute('aria-label')||'选择选项');document.body.append(popup);
    popup.onmousedown=e=>{e.preventDefault();const option=e.target.closest('[data-index]');if(option)choose(Number(option.dataset.index));};draw();
  }
  function enhance(){
    document.querySelectorAll('input[list]').forEach(el=>{el.dataset.designList=el.getAttribute('list');el.removeAttribute('list');el.setAttribute('role','combobox');el.setAttribute('aria-autocomplete','list');});
    document.querySelectorAll('.multi-select').forEach(box=>{
      const button=box.querySelector('.multi-select-toggle');if(!button)return;
      const checked=[...box.querySelectorAll('.multi-select-menu input:checked')];
      const html=checked.length?checked.map(input=>`<span class="select-design-tag">${escape(input.parentElement.textContent.trim())}<span class="select-design-remove" role="button" tabindex="0" aria-label="移除 ${escape(input.value)}" data-select-remove="${escape(input.value)}">×</span></span>`).join(''):'请选择';
      if(button.innerHTML!==html)button.innerHTML=html;
    });
  }
  document.addEventListener('mousedown',e=>{
    const el=e.target.closest('select');if(el&&!el.disabled&&!el.multiple){e.preventDefault();el.focus();source===el?close():open(el);return;}
    if(popup&&!popup.contains(e.target)&&e.target!==source)close();
  });
  document.addEventListener('click',e=>{
    const remove=e.target.closest('[data-select-remove]');if(remove){e.preventDefault();e.stopImmediatePropagation();const box=remove.closest('.multi-select'),input=[...box.querySelectorAll('input')].find(i=>i.value===remove.dataset.selectRemove);if(input){input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));enhance();}return;}
    if(e.target.matches('input[data-design-list]'))open(e.target);
  },true);
  document.addEventListener('input',e=>{if(e.target.matches('input[data-design-list]')){if(source===e.target)draw();else open(e.target);}});
  document.addEventListener('keydown',e=>{
    const el=e.target;
    if(el.matches('[data-select-remove]')&&['Enter',' '].includes(e.key)){e.preventDefault();el.click();return;}
    if(el.closest('.multi-select')&&e.key==='Escape'){el.closest('.multi-select').classList.remove('open');el.closest('.multi-select').querySelector('button').setAttribute('aria-expanded','false');return;}
    if(!el.matches('select,input[data-design-list]')||el.disabled)return;
    if(e.key==='Escape'||e.key==='Tab'){close();return;}
    if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)&&!(el.tagName==='INPUT'&&e.key===' ')){
      e.preventDefault();if(!popup||source!==el){open(el);return;}
      if(e.key==='Enter'||e.key===' '){choose(active);return;}
      const step=e.key==='ArrowDown'?1:-1;for(let n=0;n<items.length;n++){active=(active+step+items.length)%items.length;if(!items[active].disabled)break;}mark();
    }
  },true);
  document.addEventListener('focusout',e=>{if(e.target===source)close();});
  window.addEventListener('resize',()=>popup&&position());
  document.addEventListener('scroll',e=>{if(popup&&!popup.contains(e.target))position();},true);
  let pending=false;new MutationObserver(records=>{if(records.every(r=>r.target===popup||popup?.contains(r.target)))return;if(!pending){pending=true;queueMicrotask(()=>{pending=false;enhance();if(popup&&!source.isConnected)close();});}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','selected','checked']});
  enhance();document.addEventListener('change',()=>queueMicrotask(enhance));
})();
