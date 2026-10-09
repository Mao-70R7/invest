/* Versioned, bounded hidden query protocol. No eval, HTML or arbitrary fetch. */
(() => {
  'use strict';
  const isPrivate=location.pathname.startsWith('/private_fund/');
  let legacyProductId=null;
  const incoming=new URL(location.href),legacySource=incoming.searchParams.get('source');
  if(isPrivate&&!incoming.searchParams.has('bf')&&!incoming.searchParams.has('result')&&/^[a-z][a-z0-9_]{1,50}:[^\s:]{1,100}$/.test(legacySource||'')){
    legacyProductId=legacySource;
    // Historical source=source:product links confused source with product.
    // Pin the exact product, then remove the conflicting keyword restriction.
    incoming.searchParams.set('source',legacySource.split(':',1)[0]);incoming.searchParams.delete('q');incoming.searchParams.set('product',legacyProductId);
    history.replaceState(null,'',incoming);
  }
  const blocked=new Set(['__proto__','prototype','constructor']);
  const get=(row,path)=>path.split('.').reduce((v,k)=>blocked.has(k)?undefined:(v&&Object.prototype.hasOwnProperty.call(v,k)?v[k]:undefined),row);
  const text=v=>String(v??'');
  function matches(row,f){
    const v=get(row,f.field);if(f.op==='exists')return v!==undefined&&v!==null&&v!=='';
    if(v===undefined||v===null||v==='')return false;
    if(f.op==='eq')return text(v)===text(f.value);
    if(f.op==='in')return f.value.map(text).includes(text(v));
    if(f.op==='contains')return text(v).toLocaleLowerCase().includes(text(f.value).toLocaleLowerCase());
    const a=Number(v),b=Number(f.value);if(!Number.isFinite(a)||!Number.isFinite(b))return false;
    return {gte:a>=b,gt:a>b,lte:a<=b,lt:a<b}[f.op]===true;
  }
  async function read(){
    const query=new URLSearchParams(location.search),code=query.get('bf'),reference=query.get('result'),product=query.get('product');
    if(['bf','result','product'].some(key=>query.getAll(key).length>1))throw Error('结果名单参数重复');
    if([code,reference,product].filter(Boolean).length>1)throw Error('不能同时使用多种结果名单链接');
    if(product){
      if(!isPrivate||!/^[a-z][a-z0-9_]{1,50}:[^\s:]{1,100}$/.test(product))throw Error('产品完整标识与页面不匹配');
      return {v:1,ids:[product],expected:1,summary:'按完整来源产品编号定位的产品',repairedFromLegacy:Boolean(legacyProductId)};
    }
    if(!code&&!reference)return null;
    if(code&&reference)throw Error('不能同时使用两种结果名单链接');
    let spec;
    const loadResult=async(path,expectedReference)=>{
      const response=await fetch('/ai-api/v1/results/'+path,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error(response.status===404?'结果名单不存在，请重新生成链接':'结果名单服务暂不可用，请稍后重试');
      const raw=await response.text();if(new TextEncoder().encode(raw).length>400000)throw Error('结果名单超出大小限制');
      const record=JSON.parse(raw),database=location.pathname.startsWith('/private_fund/')?'private_fund':'tianyan';
      if(!/^[a-f0-9]{64}$/.test(record.id)||expectedReference&&record.id!==expectedReference||record.database!==database||typeof record.payload!=='string'||new TextEncoder().encode(record.payload).length>200000)throw Error('结果名单页面或格式不匹配');
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(record.payload))),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(digest!==record.id)throw Error('结果名单完整性校验失败');
      return {...JSON.parse(record.payload),repairedFromLegacy:record.repaired===true};
    };
    if(reference){
      if(!/^[a-f0-9]{64}$/.test(reference))throw Error('结果编号格式无效');
      spec=await loadResult(reference,reference);
    }else{
    if(code.length>16000||!/^[A-Za-z0-9_-]+$/.test(code))throw Error('筛选链接格式无效');
    const bytes=Uint8Array.from(atob(code.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-code.length%4)%4)),c=>c.charCodeAt(0));
    if(!window.DecompressionStream)throw Error('浏览器不支持此筛选链接，请升级浏览器');
    try{
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();let size=0,parts=[];
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>200000){await reader.cancel();throw Error('筛选条件超出大小限制');}parts.push(value);}
    spec=JSON.parse(await new Blob(parts).text());
    }catch(error){
      // Only a worker-registered exact alias may repair an old corrupted URL.
      // Never guess missing bytes or substitute a keyword/broader result set.
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code))),byte=>byte.toString(16).padStart(2,'0')).join('');
      try{spec=await loadResult('legacy/'+hash);}catch{throw error;}
    }
    }
    if(spec.v!==1||!Array.isArray(spec.filters||[])||(spec.filters||[]).length>30||typeof spec.summary!=='string'||spec.summary.length>500)throw Error('筛选条件版本或长度无效');
    if(spec.ids!==undefined&&(!Array.isArray(spec.ids)||spec.ids.length>10000||spec.ids.some(x=>typeof x!=='string'||x.length>150)))throw Error('名单无效');
    if(spec.ids && (new Set(spec.ids).size!==spec.ids.length || spec.expected!==spec.ids.length))throw Error('名单数量与预期不一致');
    if(spec.ids?.some(id=>!(isPrivate?/^[a-z][a-z0-9_]{1,50}:[^\s]+$/:/^[a-z][a-z0-9_]{1,50}__[^\s]+$/).test(id)))throw Error('名单产品标识与页面不匹配');
    for(const f of spec.filters||[]){if(!f||typeof f.field!=='string'||f.field.length>100||f.field.split('.').some(k=>blocked.has(k))||!['eq','in','contains','gte','gt','lte','lt','exists'].includes(f.op)||(f.op==='in'&&(!Array.isArray(f.value)||f.value.length>200)))throw Error('字段筛选条件无效');}
    return spec;
  }
  async function create(rows,key,root){
    let spec=null,error='';
    const navigation=new URL(location.href);
    if(!isPrivate&&navigation.searchParams.get('channel')){
      const value=navigation.searchParams.get('channel'),labels=new Set(rows.map(r=>String(r.渠道||'')));
      const aliases=new Set(rows.filter(r=>String(key(r)).split('__',1)[0]===value).map(r=>String(r.渠道||'')).filter(Boolean));
      if(!labels.has(value)&&aliases.size===1){navigation.searchParams.set('channel',[...aliases][0]);history.replaceState(null,'',navigation);}
      else if(!labels.has(value))error='当前公开页面没有这个渠道，未执行筛选';
    }
    for(const [param,field] of isPrivate?[['source','source'],['strategy','strategy1']]:[['institution','投顾机构']]){
      for(const value of navigation.searchParams.getAll(param)){
        if(value&&!rows.some(r=>String(r[field]||'__not_disclosed__')===value))error='当前公开页面没有已指定的'+(param==='institution'?'投顾机构':param==='source'?'数据来源':'策略类型')+'，未执行筛选';
      }
    }
    try{spec=await read();}catch(e){error=/[\u4e00-\u9fff]/.test(e.message)?e.message:'筛选链接损坏或格式无效';}
    const codeKey=()=>{const q=new URLSearchParams(location.search);return q.get('result')||q.get('bf')||q.get('product');};
    let currentCode=codeKey();
    let highlightEnabled=true, explicitHighlight=new URLSearchParams(location.search).get('highlight')==='blue';
    window.addEventListener('popstate',()=>{if(codeKey()!==currentCode)location.reload();});
    const box=document.createElement('p');box.className='business-filter-summary';box.setAttribute('role','status');box.style.cssText='padding:12px 16px;background:#f3f6fa;color:#16324f;border-left:3px solid #16324f;line-height:1.6';root.prepend(box);
    let ids=spec?.ids?new Set(spec.ids):null;let active=Boolean(spec)||Boolean(error);
    if(spec){for(const f of spec.filters||[]){if(!rows.some(r=>get(r,f.field)!==undefined)){error='当前页面未发布字段“'+f.field+'”，无法执行此条件';break;}}}
    const original=new Set(rows.map(key));let missing=ids?[...ids].filter(id=>!original.has(id)).length:0;
    return {get active(){return active;},get highlightColor(){return highlightEnabled&&(spec||explicitHighlight)&&!error?'#2563EB':null;},clearHighlight(){highlightEnabled=false;},apply(input){
      if(error)return [];
      if(!spec)return input;
      return input.filter(r=>(!ids||ids.has(key(r)))&&(spec.filters||[]).every(f=>matches(r,f)));
    },describe(count){
      box.textContent=error?'筛选未执行：'+error+'。可清除业务筛选后查看公开列表。':spec?(spec.repairedFromLegacy?'已按原查询修复旧链接。':'')+'当前范围：'+spec.summary+(ids?'；查询命中'+ids.size+'条，公开页面已收录'+(ids.size-missing)+'条，尚未发布'+missing+'条；当前筛选显示'+count+'条':'；本页显示'+count+'条')+(spec.asOf?'；名单核对日'+spec.asOf:'')+'。':'当前范围：按页面已选条件筛选，共'+count+'条。';
      box.dataset.expected=ids?String(ids.size):'';box.dataset.published=ids?String(ids.size-missing):'';box.dataset.missing=String(missing);box.dataset.visible=String(count);box.dataset.error=error;
    },clear(){spec=null;error='';ids=null;active=false;missing=0;currentCode=null;legacyProductId=null;explicitHighlight=false;const u=new URL(location.href);u.searchParams.delete('bf');u.searchParams.delete('result');u.searchParams.delete('product');u.searchParams.delete('highlight');history.replaceState(null,'',u);}};
  }
  window.BusinessQuery={create,version:3,requiresFullCatalog:Boolean(legacyProductId)||incoming.searchParams.has('bf')||incoming.searchParams.has('result')||incoming.searchParams.has('product')};
})();
