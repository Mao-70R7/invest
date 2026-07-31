# 最小发布集

本目录只包含策略列表、调仓月报、策略对比、全市场产品排名、AI选策略，以及策略/基金详情下钻。

## 访问方式

GitHub Pages 会由 `.github/workflows/pages.yml` 自动部署。也可双击根目录 `启动最小发布集.cmd` 在本机启动静态站点：

```text
http://127.0.0.1:7676/basic_data/strategies.html
```

停止本机服务：双击根目录 `停止最小发布集.cmd`。

不要用 `file://` 直接打开页面。策略、基金详情使用 gzip 按需加载，必须通过 HTTP 服务访问；GitHub Pages、Nginx、IIS 和本目录启动脚本都满足要求。

## AI 模型

AI 选策略默认调用内网 OpenAI 兼容服务 `inner-deepseek`，模型为 `qwen35-397b-a17b`。配置已随发布集写入 `basic_data/config`，不依赖本机 Codex 桥接。

GitHub Pages 是 HTTPS 页面，而当前内网模型地址是 HTTP。浏览器是否允许调用取决于内网服务的 HTTPS、CORS 和 Private Network Access 配置；不满足时页面仍可使用本地规则筛选，但模型解读会提示连接失败。生产稳定使用建议为该内网接口增加 HTTPS 反向代理并放行发布站点 Origin。

## 本机服务器

```powershell
python -X utf8 scripts/serve_basic_data_site.py --host 0.0.0.0 --port 7676 --directory .
```

## 数据范围

- 策略详情：1318 个。
- 策略源数据完整标记：1106 个；源数据不完整：212 个，页面保留真实缺失状态，不做推测补齐。
- 基金详情：17629 个，覆盖全市场排名、策略当前持仓及历史持仓下钻。
- 仅基础详情：0 个；对应源站没有增强详情时仍可展示基础信息，不伪造净值或基准。
- 策略对比仓位快照：只保留每只策略最新有效快照，原始 303381 行，发布 84790 行；不影响当前配置对比和 AI 持仓筛选。
- 调仓月报：发布静态报告 `basic_data/monthly-rebalance-report-202606.html`，图片资产 8 个，合计 666500 字节。
- 详情文件采用确定性 gzip；必须通过 HTTP 服务访问，不能用 `file://` 直接打开。
- 发布清单及 SHA256：`deployment_manifest.json`。
- 功能与数据覆盖验收：`package_validation.json`。
