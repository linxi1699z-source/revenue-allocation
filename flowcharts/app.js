(() => {
  'use strict';
  const dataset = window.REVENUE_FLOWS;
  const pages = dataset.pages;
  const $ = id => document.getElementById(id);
  const canvas = $('canvas');
  const scene = $('scene');
  const panel = $('details-panel');
  let current = null;
  let scale = .75;
  let drag = null;
  let dragged = false;
  let selected = null;
  let viewMode = 'reading';
  const workspace = document.querySelector('.workspace');
  const viewStates = new Map();
  const groups = [[0, '起始与准备'], [2, '收入与退款分摊'], [6, '完成与校验']];
  const escaped = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  $('flow-menu').innerHTML = pages.map((page, i) => {
    const group = groups.find(([index]) => index === i);
    return (group ? `<div class="menu-group-label">${group[1]}</div>` : '') + `<a class="flow-menu-item" href="#${page.id}" data-page="${page.id}"><span class="menu-number">${String(i+1).padStart(2,'0')}</span><span class="menu-name">${escaped(page.title)}</span></a>`;
  }).join('');
  function syncZoom() {
    scale = Math.max(.01, Math.min(2, scale));
    scene.style.width = `${current.width * scale}px`;
    scene.style.height = `${current.height * scale}px`;
    const margin = innerWidth <= 760 ? 20 : 30;
    scene.style.marginLeft = `${Math.max(margin,(canvas.clientWidth-current.width*scale)/2)}px`;
    scene.style.marginTop = `${margin}px`;
    const svg = scene.querySelector('svg');
    svg.style.transform = 'none';
    svg.style.width = `${current.width * scale}px`;
    svg.style.height = `${current.height * scale}px`;
    $('zoom-value').textContent = `${Math.round(scale*100)}%`;
    $('zoom-out').disabled = scale <= .01;
    $('zoom-in').disabled = scale >= 2;
  }
  function zoom(next, x = canvas.clientWidth/2, y = canvas.clientHeight/2) {
    const old = scale;
    const px = (canvas.scrollLeft + x - scene.offsetLeft) / old;
    const py = (canvas.scrollTop + y - scene.offsetTop) / old;
    viewMode = 'reading';
    scale = next;
    syncZoom();
    canvas.scrollLeft = px * scale - x + scene.offsetLeft;
    canvas.scrollTop = py * scale - y + scene.offsetTop;
  }
  function fit(mode='all') {
    const padding = innerWidth <= 760 ? 40 : 60;
    viewMode = mode;
    scale = (canvas.clientWidth-padding)/current.width;
    if(mode==='all')scale=Math.min(scale,(canvas.clientHeight-padding)/current.height);
    syncZoom();canvas.scrollTo(0,0);
  }
  function reset() {
    viewMode = 'reading';
    scale = Math.min(.85, Math.max(.5, (canvas.clientWidth-60)/1550));
    syncZoom();
    canvas.scrollTo(0,0);
  }
  function setPanel(show) {
    panel.hidden = !show;
    $('rules-toggle').setAttribute('aria-expanded', String(show));
  }
  function rules() {
    selected = null;
    scene.querySelectorAll('.selected').forEach(node=>node.classList.remove('selected'));
    $('details-title').textContent = '规则与备注';
    $('details-content').innerHTML = current.rules.map((text,i)=>`<article class="rule-card"><div class="rule-number">规则 ${String(i+1).padStart(2,'0')}</div><p>${escaped(text)}</p></article>`).join('');
    setPanel(true);
  }
  function nodeDetail(id) {
    const node = current.nodes.find(node=>node.id===id);
    if (!node) return;
    selected = id;
    scene.querySelectorAll('.selected').forEach(node=>node.classList.remove('selected'));
    scene.querySelector(`[data-node="${id}"]`).classList.add('selected');
    $('details-title').textContent = '步骤详情';
    const kinds = {decision:'条件判断',terminal:node.text==='结束'?'流程结束':'流程入口',warning:'异常预警',process:'处理步骤'};
    $('details-content').innerHTML = `<div class="detail-kind">${kinds[node.kind]}</div><div class="node-detail">${node.html}</div><button class="back-to-rules" id="back-to-rules">查看本流程规则与备注 →</button>`;
    $('back-to-rules').addEventListener('click',rules);
    setPanel(true);
  }
  function render() {
    const id = location.hash.slice(1);
    const page = pages.find(page=>page.id===id) || pages[0];
    if (current?.id===page.id) return;
    if (current) viewStates.set(current.id,{scale,mode:viewMode,left:canvas.scrollLeft,top:canvas.scrollTop});
    current = page;
    selected = null;
    document.title = `${page.title} · 收入分摊业务流程`;
    $('flow-title').textContent = page.title;
    $('flow-description').textContent = page.description;
    $('flow-eyebrow').textContent = `收入分摊 / 流程${'一二三四五六七'[page.number-1]}`;
    $('current-number').textContent = String(page.number).padStart(2,'0');
    $('node-count').textContent = `${page.nodes.length} 个节点 · ${page.decisions} 个判断`;
    $('flow-source').textContent = `依据：${page.source}`;
    $('previous-flow').disabled = page.number===1;
    $('next-flow').disabled = page.number===pages.length;
    document.querySelectorAll('[data-page]').forEach(link=>{
      const active = link.dataset.page===page.id;
      link.classList.toggle('active',active);
      if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    scene.innerHTML = page.svg;
    const state = viewStates.get(page.id);
    if (state) {
      viewMode=state.mode||'reading';
      if(viewMode==='reading'){scale = state.scale;syncZoom();canvas.scrollTo(state.left,state.top);}
      else fit(viewMode);
    } else reset();
    $('canvas-loading').hidden = true;
    rules();
    $('sidebar').classList.remove('open');
    $('mobile-menu').setAttribute('aria-expanded','false');
    $('live-message').textContent = `已切换到流程${page.number}：${page.title}`;
  }

  $('zoom-out').addEventListener('click',()=>zoom(scale-.15));
  $('zoom-in').addEventListener('click',()=>zoom(scale+.15));
  $('fit-width').addEventListener('click',()=>fit('width'));
  $('fit-all').addEventListener('click',()=>fit('all'));
  function fullscreenState() {
    const expanded=Boolean(document.fullscreenElement===workspace || workspace.classList.contains('expanded'));
    $('fullscreen').textContent=expanded?'退出全屏':'全屏查看';
    $('fullscreen').setAttribute('aria-pressed',String(expanded));
    requestAnimationFrame(()=>fit('all'));
  }
  $('fullscreen').addEventListener('click',async()=>{
    if(document.fullscreenElement===workspace){await document.exitFullscreen();return;}
    if(workspace.classList.contains('expanded')){workspace.classList.remove('expanded');fullscreenState();return;}
    if(workspace.requestFullscreen){try{await workspace.requestFullscreen();return;}catch{/* Use the page overlay when native full screen is unavailable. */}}
    workspace.classList.add('expanded');fullscreenState();
  });
  document.addEventListener('fullscreenchange',fullscreenState);
  $('reset-view').addEventListener('click',reset);
  $('rules-toggle').addEventListener('click',()=>{if(panel.hidden || selected)rules();else setPanel(false);});
  $('details-close').addEventListener('click',()=>setPanel(false));
  $('previous-flow').addEventListener('click',()=>{if(current.number>1)location.hash=pages[current.number-2].id;});
  $('next-flow').addEventListener('click',()=>{if(current.number<pages.length)location.hash=pages[current.number].id;});
  $('mobile-menu').addEventListener('click',()=>{
    const open=$('sidebar').classList.toggle('open');
    $('mobile-menu').setAttribute('aria-expanded',String(open));
  });
  canvas.addEventListener('wheel',event=>{
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect=canvas.getBoundingClientRect();
    zoom(scale*(event.deltaY>0?.9:1.1),event.clientX-rect.left,event.clientY-rect.top);
  },{passive:false});
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0 || event.pointerType==='touch')return;
    drag={x:event.clientX,y:event.clientY,left:canvas.scrollLeft,top:canvas.scrollTop};dragged=false;
  });
  window.addEventListener('pointermove',event=>{
    if(!drag)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.hypot(dx,dy)>5) {dragged=true;canvas.classList.add('dragging');}
    if(dragged){event.preventDefault();canvas.scrollLeft=drag.left-dx;canvas.scrollTop=drag.top-dy;}
  });
  window.addEventListener('pointerup',()=>{drag=null;canvas.classList.remove('dragging');});
  scene.addEventListener('click',event=>{
    if(dragged){dragged=false;return;}
    const node=event.target.closest('[data-node]');
    if(node)nodeDetail(node.dataset.node);
  });
  scene.addEventListener('keydown',event=>{
    if(!['Enter',' '].includes(event.key))return;
    const node=event.target.closest('[data-node]');
    if(node){event.preventDefault();nodeDetail(node.dataset.node);}
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){setPanel(false);$('sidebar').classList.remove('open');$('mobile-menu').setAttribute('aria-expanded','false');if(workspace.classList.contains('expanded')){workspace.classList.remove('expanded');fullscreenState();}}
  });
  window.addEventListener('hashchange',render);
  render();
  let resizeFrame;
  new ResizeObserver(()=>{
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{if(!current)return;if(viewMode==='reading')syncZoom();else fit(viewMode);});
  }).observe(canvas);
})();
