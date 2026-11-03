(() => {
  'use strict';
  const config=window.__TY_PORTAL__, B=window.BasicData;
  const accepted=new Map((window.ATOMIC_RELEASE?.strategies||[]).map(x=>[x.strategyId,x]));
  const promises=new Map(), rows=new Map(B.state.summary.strategies.map(x=>[x.统一策略ID,x]));
  // A detached/incomplete script request must not leave every later retry
  // waiting on the same unresolved promise. Only transport is retried; decoded
  // bytes and strategy identities still pass the independent SHA checks below.
  async function loadCatalogScript(src){
    const url=new URL(src,location.href);
    if(url.origin!==location.origin)throw Error('策略资源必须来自当前站点');
    for(let attempt=1;attempt<=2;attempt++){
      try{
        await new Promise((resolve,reject)=>{
          const script=document.createElement('script');let settled=false;
          const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);script.onload=null;script.onerror=null;script.remove();error?reject(error):resolve();};
          const timer=setTimeout(()=>finish(Error('策略资源加载超时')),20000);
          script.src=url.href;script.onload=()=>finish();script.onerror=()=>finish(Error('策略资源网络加载失败'));
          document.head.appendChild(script);
        });
        return;
      }catch(error){if(attempt===2)throw error;}
    }
  }
  async function record(id){
    const route=config.routes[id];if(!route)throw Error('未登记的策略');
    if(!promises.has(route.key))promises.set(route.key,loadCatalogScript(route.path));
    try{await promises.get(route.key);}catch(error){promises.delete(route.key);throw error;}
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
  const detailLoads=new Map(), detailGroups=new Map(), detailRecent=new Map();
  function remember(id,value){
    detailRecent.delete(id);detailRecent.set(id,value);B.state.details[id]=value;
    while(detailRecent.size>12){const old=detailRecent.keys().next().value;detailRecent.delete(old);delete B.state.details[old];}
    return value;
  }
  async function loadDetail(id){
    if(B.state.details[id])return remember(id,B.state.details[id]);
    const route=config.detailRoutes?.[id];if(!route)throw Error('缺少完整策略详情索引');
    if(detailGroups.has(route.key))return remember(id,detailGroups.get(route.key)[id]);
    if(!detailLoads.has(route.key))detailLoads.set(route.key,(async()=>{
      if(!window.__TY_DETAIL_GZIP__?.[route.key])await loadCatalogScript(route.path);
      const encoded=window.__TY_DETAIL_GZIP__?.[route.key];if(!encoded)throw Error('完整策略详情未返回');
      const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const raw=await new Response(stream).arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==route.key)throw Error('完整策略详情校验失败');
      const details=JSON.parse(new TextDecoder().decode(raw));
      for(const [sid,value] of Object.entries(details)){
        if(value.id!==sid||config.detailRoutes[sid]?.key!==route.key)throw Error('策略详情身份不一致');
      }
      detailGroups.set(route.key,details);
      while(detailGroups.size>1)detailGroups.delete(detailGroups.keys().next().value);
      return details;
    })());
    let values;
    try{values=await detailLoads.get(route.key);}finally{detailLoads.delete(route.key);}
    if(!values[id])throw Error('对应策略详情缺失');
    return remember(id,values[id]);
  }
  let comparisonLoad;
  function loadComparison(){
    if(!comparisonLoad)comparisonLoad=(async()=>{
      const ref=config.comparisonPack;if(!ref)throw Error('缺少历史配置版本');
      if(!window.__TY_COMPARE_GZIP__?.[ref.key])await loadCatalogScript('./'+ref.path.replace(/^basic_data\//,''));
      const encoded=window.__TY_COMPARE_GZIP__?.[ref.key];if(!encoded)throw Error('历史配置未返回');
      const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      const raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');
      if(hash!==ref.key)throw Error('历史配置版本校验失败');
      window.__BASIC_HOLDING_SNAPSHOT_PACK__=JSON.parse(new TextDecoder().decode(raw));
      delete window.__TY_COMPARE_GZIP__[ref.key];
    })().catch(error=>{comparisonLoad=null;throw error;});
    return comparisonLoad;
  }
  window.TianyanCatalog={record,facts,rows,accepted,config,freshness,note,loadDetail,loadComparison};
})();
