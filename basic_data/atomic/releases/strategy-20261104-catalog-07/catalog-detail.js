(async()=>{
  'use strict';
  const B=window.BasicData,C=window.TianyanCatalog,root=document.querySelector('main');
  const q=new URLSearchParams(location.search);
  const number=v=>v===null||v===undefined||v===''?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:4});
  const pct=v=>v===null||v===undefined?'—':`${Number(v)>0?'+':''}${Number(v).toFixed(4)}%`;
  const tone=v=>v===null||v===undefined||v===0?'':v>0?'ret-pos':'ret-neg';
  function chart(points){
    const finite=points.flatMap(x=>[x[1],x[2]]).filter(Number.isFinite);if(finite.length<2)return '<div class="empty">尚无可连续展示的业绩曲线；缺失不按零处理。</div>';
    const w=1000,h=260,pad=40,lo=Math.min(...finite),hi=Math.max(...finite);
    const start=Date.parse(points[0][0]),end=Date.parse(points.at(-1)[0]);
    function pathFor(index){let path='',move=true;points.forEach(p=>{if(!Number.isFinite(p[index])){move=true;return;}const x=pad+(Date.parse(p[0])-start)/(end-start||1)*(w-2*pad),y=h-pad-(p[index]-lo)/(hi-lo||1)*(h-2*pad);path+=`${move?'M':'L'}${x.toFixed(2)},${y.toFixed(2)} `;move=false;});return path;}
    return `<p class="desc">深蓝：策略披露累计收益；灰色虚线：同源披露基准（有数据时显示）。</p><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="披露累计收益走势，单位百分比"><line x1="40" x2="960" y1="220" y2="220" stroke="#DCE2E7"/><path d="${pathFor(1)}" fill="none" stroke="#17324D" stroke-width="2"/><path d="${pathFor(2)}" fill="none" stroke="#7F8C99" stroke-width="1.6" stroke-dasharray="5 4"/><text x="40" y="250">${B.esc(points[0][0])}</text><text x="960" y="250" text-anchor="end">${B.esc(points.at(-1)[0])}</text><text x="42" y="22">${number(hi)}%</text></svg>`;
  }

  async function render(id){
    const row=C.rows.get(id);if(!row)throw Error('未找到策略，请从策略列表选择。');
    const rec=await C.record(id), f=C.facts(id,rec),m=f.metadata;
    const known=f.holdings.filter(h=>h.weight!==null&&h.weight!==undefined).reduce((s,h)=>s+Number(h.weight),0);
    document.body.dataset.selectedStrategy=id;
    root.innerHTML=`<section class="panel strategy-overview"><a class="link" href="./strategies.html">← 返回策略列表</a><div class="strategy-title-line"><h1 id="catalog-strategy-name">${B.esc(row.策略名称)}</h1><span class="pill">${B.esc(row.数据更新状态)}</span></div><p>销售渠道 ${B.esc(row.渠道)} ｜ 投顾管理人 ${B.esc(row.投顾机构)} ｜ 策略代码 ${B.esc(row.策略代码||'未披露')}</p><p id="catalog-scope-note" class="desc">${B.esc(row.数据核验说明)}</p><div class="catalog-facts">${[['业绩截至',row.最新业绩日期],['持仓截至',row.最新持仓日],['最近入库',row.最近入库时间],['原始运作状态',row.运作状态]].map(([k,v])=>`<div><span>${k}</span><strong>${B.esc(v||'未取得')}</strong></div>`).join('')}</div></section>
    <nav class="catalog-tabs"><a href="#catalog-performance">业绩走势</a><a href="#catalog-holdings">当前持仓</a><a href="#catalog-events">调仓记录</a><a href="#catalog-profile">产品信息</a></nav>
    <section class="panel" id="catalog-performance"><h2>已披露业绩走势</h2><p id="catalog-curve-label">截至 ${B.esc(row.最新业绩日期||'未取得')} · 累计收益百分点 · ${f.accepted?'沿用独立验收版本':'已采集存量数据，待本轮原件复核'}</p><p class="desc">按各策略原披露起点展示，不转换为单位净值，不混入费后模拟或全市场排名。缺失或隔离点保留断开。</p><div class="catalog-range">${[['all','全部历史'],['365','近一年'],['92','近三月'],['31','近一月']].map(([v,t])=>`<button data-catalog-range="${v}">${t}</button>`).join('')}</div><div id="catalog-curve">${f.blocked?'<div class="empty">该策略存在来源冲突，保留身份和日期，待解决后恢复金融数据。</div>':chart(f.points)}</div></section>
    <section class="panel" id="catalog-holdings"><h2>当前持仓</h2><p id="catalog-holding-label">持仓截至 ${B.esc(row.最新持仓日||'未取得')} · 已知权重合计 ${f.holdings.length?number(known)+'%':'—'} · ${f.holdings.length} 条披露记录</p><p class="desc">同一快照按原基金名称和代码保留，不跨份额合并，不将未知权重补零或归一化；基金配置不等于底层经济暴露。</p><div class="table-wrap"><table><thead><tr><th>基金代码</th><th>基金名称</th><th>披露权重</th><th>权重说明</th></tr></thead><tbody id="catalog-holding-rows">${f.holdings.map(h=>`<tr><td>${B.esc(h.code||'未识别')}</td><td>${B.esc(h.name)}</td><td>${h.weight===null?'—':number(h.weight)+'%'}</td><td>${h.exact?'精确披露':'非精确/待核'}</td></tr>`).join('')}</tbody></table>${f.holdings.length?'':'<p class="empty">当前范围暂无可展示持仓，不代表零持仓。</p>'}</div></section>
    <section class="panel" id="catalog-events"><h2>已采集调仓记录</h2><p class="desc">${f.events.length} 条存量记录；未声明完整历史验收，不据此计算调仓贡献；无可展示记录不代表实际从未调仓。</p><details><summary>展开历史记录</summary><div class="table-wrap"><table><thead><tr><th>日期</th><th>标题</th><th>说明</th></tr></thead><tbody>${f.events.map(x=>`<tr><td>${B.esc(x[1])}</td><td>${B.esc(x[2]||'未披露')}</td><td>${B.esc(x[3]||'未披露')}</td></tr>`).join('')}</tbody></table></div></details></section>
    <section class="panel" id="catalog-profile"><h2>产品信息与来源口径</h2><div class="value-list">${['成立日期','风险等级','建议持有时长','业绩基准','策略描述'].map(k=>`<div class="value-row"><strong>${k}</strong><span>${B.esc((k==='成立日期'?row[k]:m[k])??'未披露')}</span></div>`).join('')}</div><p class="desc">来源：${B.esc(row.渠道)}既有采集记录。页面版本 ${B.esc(C.config.buildId)}；数据业务日期独立显示，页面刷新不改变数据日期。</p></section>`;
    root.querySelectorAll('[data-catalog-range]').forEach(btn=>btn.addEventListener('click',()=>{const days=btn.dataset.catalogRange;const end=f.points.at(-1)?.[0];const start=end&&days!=='all'?Date.parse(end)-Number(days)*86400000:-Infinity;B.byId('catalog-curve').innerHTML=chart(f.points.filter(x=>Date.parse(x[0])>=start));}));
    return {id,holdingCount:f.holdings.length,points:f.points.length,performanceAsOf:row.最新业绩日期,holdingsAsOf:row.最新持仓日};
  }
  window.TianyanCatalog.renderDetail=render;
  try{
    if(root.id==='catalogPendingPage'){
      root.innerHTML=`<section class="panel"><h1>${B.esc(document.title.split(' · ')[0])}</h1><p>原功能入口保留。该模块需要独立的历史调仓或底层来源验收，当前版本不以存量数据推断缺失结果。</p><a class="link" href="./strategies.html">查看全部策略及已采集数据 →</a></section>`;
    }else if(root.id==='catalogComparePage'){
      const ids=(q.get('compare')||'').split(',').filter(Boolean).slice(0,5);const values=ids.map(id=>C.rows.get(id)).filter(Boolean);
      const fields=['策略名称','渠道','投顾机构','数据更新状态','最新业绩日期','最新持仓日','累计收益率','风险等级','业绩基准说明'];
      root.innerHTML=`<section class="panel"><h1>策略对比</h1><p>保留各策略实际日期。累计收益起点不同，不作为同期间排名；空白不按零处理。</p><div class="table-wrap"><table><tbody>${fields.map(k=>`<tr><th>${k}</th>${values.map(v=>`<td class="${k==='累计收益率'?tone(v[k]):''}">${B.esc(k==='累计收益率'?pct(v[k]):v[k]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><a href="./strategies.html">返回策略列表</a></section>`;
    }else await render(q.get('id'));
  }catch(e){root.innerHTML=`<section class="panel"><h1>数据暂未就绪</h1><p>${B.esc(e.message)}</p><a href="./strategies.html">返回策略列表</a></section>`;throw e;}
  B.hidePageLoading();
})();
