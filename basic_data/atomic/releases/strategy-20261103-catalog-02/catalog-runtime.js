(() => {
  'use strict';
  const config=window.__TY_PORTAL__, B=window.BasicData;
  const accepted=new Map((window.ATOMIC_RELEASE?.strategies||[]).map(x=>[x.strategyId,x]));
  const promises=new Map(), rows=new Map(B.state.summary.strategies.map(x=>[x.统一策略ID,x]));
  async function record(id){
    const route=config.routes[id];if(!route)throw Error('未登记的策略');
    if(!promises.has(route.key))promises.set(route.key,B.loadScript(route.path));
    await promises.get(route.key);
    const value=window.__TY_CATALOG_CHUNKS__?.[route.key]?.[id];
    if(!value||value.metadata.统一策略ID!==id)throw Error('策略版本不一致');
    return value;
  }
  function facts(id,rec){
    const b=accepted.get(id), blocked=config.blocked[id], row=rows.get(id);
    const points=blocked||!row.允许展示业绩?[]:b?b.points.map(p=>[p[0],p[1],p[2]]):rec.curve.map(p=>[p[0],p[4]===1&&!p[5]?p[1]:null,p[4]===1&&!p[5]?p[2]:null]);
    const holdings=blocked||!row.允许展示持仓?[]:b?b.holdings.map(h=>({code:h.code,name:h.name,weight:h.weightPct,exact:true})):rec.holdings.map(h=>({code:h[1],name:h[2],weight:h[3],exact:h[4]===1}));
    return {id,row,accepted:!!b,blocked:!!blocked,points,holdings,events:row.允许展示调仓?rec.events:[],metadata:rec.metadata};
  }
  function freshness(){
    const channels=new Map();
    for(const row of rows.values()){
      const key=row.渠道ID, name=({gfsec_fima:'广发证券 · FIMA',gfsec_robot:'广发证券 · 机器人'})[key]||row.渠道;
      const x=channels.get(key)||{name,total:0,accepted:0,conflict:0,performance:new Map(),holding:new Map()};
      x.total++;x.accepted+=row.本轮金融验收?1:0;x.conflict+=row.金融冲突?1:0;
      for(const [name,field] of [['performance','最新业绩日期'],['holding','最新持仓日']]){const d=row[field]||'未取得';x[name].set(d,(x[name].get(d)||0)+1);}
      channels.set(key,x);
    }
    const dates=m=>[...m].sort((a,b)=>b[0].localeCompare(a[0])).map(([d,n])=>`${d}：${n}`).join('；');
    return `<details class="panel catalog-freshness"><summary>各渠道数据日期与更新状态 · ${channels.size} 个采集来源</summary><p class="desc">更新失败或没有新数据时保留原策略及原日期。采集日期、数据日期和发布时间分别记录；日期较旧不等于策略已结束。同一销售渠道的不同采集来源分别管理新鲜度。</p><div class="table-wrap"><table><thead><tr><th>渠道 / 来源</th><th>全部策略</th><th>已验版本</th><th>冲突待核</th><th>业绩日期分布</th><th>持仓日期分布</th></tr></thead><tbody>${[...channels].map(([,x])=>`<tr><td>${B.esc(x.name)}</td><td>${x.total}</td><td>${x.accepted}</td><td>${x.conflict}</td><td>${B.esc(dates(x.performance))}</td><td>${B.esc(dates(x.holding))}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
  function note(){return `<section class="panel catalog-status"><strong>全部 ${config.count.toLocaleString('zh-CN')} 个策略持续保留</strong><p>已验收版本 ${config.acceptedCount} 个；其余展示已采集存量数据与实际日期，待本轮复核。已知冲突仍保留策略入口，相关金融值不参与展示比较。历史净值、累计收益百分点和客户实际收益不混用。</p><a class="link" href="./strategies.html">查看全部策略 →</a></section>`;}
  window.TianyanCatalog={record,facts,rows,accepted,config,freshness,note};
})();
