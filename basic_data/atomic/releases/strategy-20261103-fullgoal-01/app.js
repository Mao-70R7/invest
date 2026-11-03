'use strict';
(() => {
 const data=window.ATOMIC_RELEASE, manifest=data.manifest, rows=data.strategies;
 const el=id=>document.getElementById(id), text=(id,v)=>{el(id).textContent=v??'—';};
 if (manifest.buildId!==el('build-id').textContent || rows.length!==manifest.strategies.length) throw new Error('版本数据不一致');
 const dates=k=>[...new Set(rows.map(x=>x[k]))].sort().join(' / ');
 text('channels',Object.keys(manifest.channelStrategyCounts).length);text('strategies',rows.length);
 text('performance-date',dates('performanceAsOf'));text('holdings-date',dates('holdingsAsOf'));
 text('channel-summary',Object.entries(manifest.channelStrategyCounts).map(([c,n])=>`${rows.find(x=>x.channelId===c).institution}：${n}个已验收策略`).join('；'));
 rows.forEach((r,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=r.institution+' · '+r.name;el('strategy-select').appendChild(o);});
 function valueSpan(v){const s=document.createElement('span');s.className=v==null||v===0?'neutral':v>0?'pos':'neg';s.textContent=v==null?'—':`${v>0?'+':''}${v.toFixed(2)}%`;return s;}
 function show(index){
  const r=rows[index];text('strategy-name',r.name);text('description',r.description);
  text('terms',`成立：${r.launchDate} · 起投：${r.minimumCny.toLocaleString('zh-CN')}元 · 投顾费率：${r.feePctPerYear}%/年 · 建议持有：${r.suggestedHoldingPeriod} · 官方风险标签：${r.riskLabel}`);
  const p=r.points, first=p[0],last=p[p.length-1];text('curve-label',`${first[0]} 至 ${last[0]} · ${p.length}个官方交易日 · 基准：${r.benchmarkText}`);
  const svg=el('curve');svg.replaceChildren();const vals=p.flatMap(x=>x.slice(1).filter(v=>v!==null)),lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||1;
  const start=Date.parse(first[0]),end=Date.parse(last[0]);
  for(let col=1;col<=2;col++){
   let d='',connected=false;for(const row of p){if(row[col]===null){connected=false;continue;}const x=20+(Date.parse(row[0])-start)/(end-start||1)*760,y=220-(row[col]-lo)/span*200;d+=(connected?'L':'M')+x.toFixed(2)+','+y.toFixed(2);connected=true;}
   const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',d);line.setAttribute('fill','none');line.setAttribute('stroke',col===1?'#17324D':'#758CA0');line.setAttribute('stroke-width','2');svg.appendChild(line);
  }
  el('endpoints').replaceChildren(document.createTextNode('期末累计收益：组合 '),valueSpan(last[1]),document.createTextNode('；官方基准 '),valueSpan(last[2]));
  text('holding-label',`持仓日期：${r.holdingsAsOf} · ${r.holdings.length}只基金 · 已知权重合计${r.holdings.reduce((s,x)=>s+x.weightPct,0).toFixed(4)}% · 按准确基金代码核对，无重复合并或缺失补零。`);
  el('holdings').replaceChildren();r.holdings.forEach(h=>{const tr=document.createElement('tr');[h.code,h.name,h.weightPct.toFixed(4)+'%'].forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i===2)td.className='num';tr.appendChild(td);});el('holdings').appendChild(tr);});
  text('source',`来源：富国基金官方公开接口；采集时间 ${r.capturedAt}。业绩与持仓日期分别披露，采集日期不替代业务日期。`);
  document.body.dataset.selectedStrategy=r.strategyId;
 }
 el('strategy-select').addEventListener('change',e=>show(Number(e.target.value)));show(0);document.body.dataset.buildId=manifest.buildId;
})();
