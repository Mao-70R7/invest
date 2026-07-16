(() => {
  const B = window.BasicData;
  if (!B || typeof B.loadScript !== "function") {
    throw new Error("Minimal publish runtime requires basic-common.js");
  }

  const originalLoadScript = B.loadScript.bind(B);
  const pending = new Map();
  const fileProtocol = window.location.protocol === "file:";

  function showProtocolNotice() {
    if (!fileProtocol || document.getElementById("minimalPublishProtocolNotice")) return;
    const notice = document.createElement("div");
    notice.id = "minimalPublishProtocolNotice";
    notice.setAttribute("role", "alert");
    notice.style.cssText = "position:sticky;top:0;z-index:9999;padding:12px 18px;background:#fff4e5;border-bottom:1px solid #f5c26b;color:#7a2e0e;font:14px/1.5 system-ui;text-align:center";
    notice.textContent = "当前为 file:// 直接打开模式，浏览器无法读取压缩数据。请通过 HTTP 服务或 GitHub Pages 访问。";
    document.body.prepend(notice);
  }

  function removeRetiredPageLinks() {
    document.querySelectorAll('a[href$="data-quality.html"], a[href$="advisor-fof-ranking.html"]').forEach((link) => {
      const label = document.createElement("span");
      label.className = link.className;
      label.textContent = link.href.endsWith("data-quality.html") ? "质量提示" : link.textContent;
      link.replaceWith(label);
    });
  }

  function finalizeShell() {
    showProtocolNotice();
    removeRetiredPageLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", finalizeShell, { once: true });
  } else {
    finalizeShell();
  }

  function shardKey(value) {
    let hash = 0;
    String(value || "").split("").forEach((char) => {
      hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    });
    return (hash % 256).toString(16).padStart(2, "0");
  }

  function detailPath(kind, id) {
    const cleanKind = kind === "details" ? "details" : "fund_details";
    const cleanId = String(id || "").trim();
    return `./data/${cleanKind}/${shardKey(cleanId)}/${encodeURIComponent(cleanId)}.js`;
  }

  function compressedScriptUrl(src, detailOnly = false) {
    const url = new URL(src, document.baseURI);
    const path = url.pathname.replace(/\\/g, "/");
    const isDetail = /\/data\/(details|fund_details)\/(?:[^/]+\/)*[^/]+\.js$/i.test(path);
    if (detailOnly && !isDetail) return null;
    if (!detailOnly && !/\/data\/(?:[^/]+\/)*[^/]+\.js$/i.test(path)) return null;
    url.pathname = `${url.pathname}.gz`;
    return url;
  }

  async function responseText(response) {
    const encoding = String(response.headers.get("content-encoding") || "").toLowerCase();
    if (encoding.includes("gzip")) return response.text();
    if (typeof DecompressionStream !== "function" || !response.body) {
      throw new Error("当前浏览器不支持 gzip 数据加载，请使用新版 Chrome 或 Edge。");
    }
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).text();
  }

  async function loadCompressedScript(src, compressedUrl) {
    const response = await fetch(compressedUrl, { cache: "default" });
    if (!response.ok) {
      throw new Error(`压缩数据加载失败 (${response.status}): ${compressedUrl.pathname}`);
    }
    const source = await responseText(response);
    const script = document.createElement("script");
    script.text = `${source}\n//# sourceURL=${compressedUrl.href}`;
    document.head.appendChild(script);
  }

  function loadCompressed(src, detailOnly = false) {
    const compressedUrl = compressedScriptUrl(src, detailOnly);
    if (!compressedUrl) return originalLoadScript(src);
    if (fileProtocol) {
      return Promise.reject(new Error("压缩数据必须通过 HTTP 访问。"));
    }
    const key = compressedUrl.href;
    if (!pending.has(key)) {
      pending.set(key, loadCompressedScript(src, compressedUrl).catch((error) => {
        pending.delete(key);
        throw error;
      }));
    }
    return pending.get(key);
  }

  B.loadScript = function loadMinimalPublishScript(src) {
    const compressedUrl = compressedScriptUrl(src, false);
    if (!compressedUrl) return originalLoadScript(src);
    return loadCompressed(src, false).catch((error) => {
      if (/404/.test(String(error?.message || error))) return originalLoadScript(src);
      throw error;
    });
  };

  async function startPage(options = {}) {
    const dataScripts = Array.isArray(options.dataScripts) ? options.dataScripts : [];
    try {
      await Promise.all(dataScripts.map((src) => loadCompressed(src)));
      if (options.qualityScope && B.renderGlobalQualityGate) {
        B.renderGlobalQualityGate(options.qualityScope);
      }
      if (options.renderer) await originalLoadScript(options.renderer);
    } catch (error) {
      console.error(error);
      const root = document.querySelector("main") || document.body;
      const panel = document.createElement("section");
      panel.className = "panel";
      panel.innerHTML = `<div class="empty">页面数据加载失败：${B.esc(error?.message || error)}</div>`;
      root.prepend(panel);
    }
  }

  window.MinimalPublish = Object.freeze({
    version: 2,
    compressedDetails: true,
    compressedPagePacks: true,
    requiresHttp: true,
    shardKey,
    detailPath,
    startPage,
  });
  window.__MINIMAL_PUBLISH_RUNTIME__ = window.MinimalPublish;
})();
