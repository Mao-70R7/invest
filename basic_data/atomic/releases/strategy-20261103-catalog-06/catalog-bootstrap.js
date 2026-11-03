(() => {
  'use strict';
  const self = document.currentScript;
  const base = new URL('.', self.src);
  const page = self.dataset.pageScript;
  async function initialize() {
    if (!['institutions.js', 'strategies.js', 'strategy-detail.js', 'insights.js'].includes(page)) throw Error('页面入口不匹配');
    const e = window.__TY_CATALOG_ENVELOPE__;
    if (!e || e.contract !== 'full_catalog_gzip_v1' || !Number.isInteger(e.bytes) || e.bytes <= 0 || e.bytes > 128 * 1024 * 1024) throw Error('完整策略目录格式不匹配');
    const packed = Uint8Array.from(atob(e.gzipBase64), c => c.charCodeAt(0));
    const reader = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const parts = []; let length = 0;
    for (;;) {
      const {value, done} = await reader.read(); if (done) break;
      length += value.length;
      if (length > e.bytes) { await reader.cancel(); throw Error('策略目录长度不匹配'); }
      parts.push(value);
    }
    if (length !== e.bytes) throw Error('策略目录长度不匹配');
    const raw = new Uint8Array(length); let offset = 0;
    for (const p of parts) { raw.set(p, offset); offset += p.length; }
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', raw)), x => x.toString(16).padStart(2, '0')).join('');
    if (sha !== e.sha256) throw Error('策略目录完整性校验失败');
    const {config, summary} = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(raw));
    const ids = summary?.strategies?.map(r => r.统一策略ID);
    if (!ids?.length || ids.some(s => typeof s !== 'string' || !s) || new Set(ids).size !== ids.length || config?.count !== ids.length ||
        JSON.stringify(summary.catalog) !== JSON.stringify(config) || Object.keys(config.routes || {}).length !== ids.length || ids.some(id => !config.routes[id])) throw Error('完整策略目录身份不匹配');
    window.__TY_PORTAL__ = config;
    window.__BASIC_DATA__ = {details: {}, summary};
    delete window.__TY_CATALOG_ENVELOPE__;
    for (const name of ['basic-common.js', 'data.js', 'catalog-runtime.js', 'business-query.js', page, 'tianyan-assistant-config.js', 'tianyan-assistant.js']) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = new URL(name, base).href;
        script.onload = resolve; script.onerror = () => reject(Error('页面文件加载失败：' + name));
        document.head.appendChild(script);
      });
    }
  }
  window.__TY_CATALOG_READY__ = initialize().catch(error => {
    const status = document.getElementById('pageLoadingStatus');
    if (status) { status.hidden = false; status.textContent = '数据加载失败，请刷新重试。' + error.message; }
    console.error(error);
    throw error;
  });
})();
