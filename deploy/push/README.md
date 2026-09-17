# 转ERP按钮 运维说明

> 面板:采购入库(PURCHASE_IN)/ 销售出库(SALE_OUT) → 工具栏「转ERP ▼」(转ERP / 批量转ERP)
> 实现:纯 Java(KingdeePushService:签名 + HttpURLConnection),**无 Node 子进程,部署包自包含**

---

## 一、凭证安全(为什么凭证不会被看到)

所有含密钥的文件均已 gitignore 且未跟踪,**推送仓库不包含任何凭证**:

| 文件 | 内容 | git 状态 |
|---|---|---|
| `deploy/push/config.json` | 当前生效账套凭证 | ✅ gitignored,未跟踪 |
| `temp-push-sandbox/config.json` | 暂存的另一账套凭证 | ✅ gitignored,未跟踪 |
| `deploy/push/config.example.json` | 占位符模板 | 入库,无真实密钥 |

**自查命令**(每次推送前可复核):

```bat
git ls-files deploy/push/config.json temp-push-sandbox/   :: 应输出为空
git grep -l "<密钥片段>" HEAD                               :: 应无结果
```

历史遗留说明:早期一次提交曾带入**已作废**的测试沙箱旧密钥(appSecret 已轮换失效);
保险起见可在金蝶开放平台重置该 clientSecret 一次,历史值即彻底无效。

---

## 二、执行测试账套转ERP前(检查清单)

| # | 检查项 | 说明 |
|---|---|---|
| 1 | `deploy/push/config.json` 为**测试账套凭证** | appKey 见 `temp-push-sandbox/README.md` 对照;密钥 **24h 轮换**,失效报 `1030002006` → 到测试账套控制台取最新 appKey/appSecret 更新本文件 |
| 2 | 后端运行中 | 本地:`java -jar backend/target/*.jar`(工作目录=仓库根);服务器:部署包 |
| 3 | 测试账套基础资料齐 | 引用的供应商/商品编码必须已导入(现有 64 供应商/143 商品);缺时报 `参数number[xxx]不存在` |
| 4 | 单据满足条件 | ①已审核(审批通过) ②是否已转ERP=否 ③有明细行 ④明细行仓库已填(必填红星) |
| 5 | 按钮出现 | 工具栏「转ERP ▼」;没有则刷新页面(面板配置缓存 30s) |

**换凭证后生效时机**:app-token 有 22h 缓存;新凭证在下次取 token 时生效,立即生效需重启后端。

---

## 三、切换到真实账套转ERP(步骤)

> 前提:服务器部署测试已全部完成

| # | 步骤 | 说明 |
|---|---|---|
| 1 | **补 outerInstanceId 支持** | 真实账套密钥 24h 自动轮换,纯 Java 端尚未实现动态取密钥流程(需在 KingdeePushService 增加 fetchAuthorization,约 30 行);**不补则每 24h 手动更新一次 appSecret** |
| 2 | 换凭证(二选一) | ① 本地:`copy temp-push-sandbox\config.json deploy\push\config.json`(内含真实账套 clientId/appKey/outerInstanceId);② 服务器:jar 旁 `config/application.properties` 配 `kingdee.push.*` 或环境变量(见下方) |
| 3 | 重启后端 | 清 app-token 缓存,立即用新账套 |
| 4 | 验证 | ①只读 probe:任一单据点转ERP前先看认证不报错 ②推**一张**已审核单 ③金蝶真实账套界面核对生成的 Z 状态暂存单 ④MES 回填 ERP单号=金蝶编号(≠MES编号) |
| 5 | 核对备注 | 金蝶单备注含 `[MES:单据编号]` 可追溯来源 |

**服务器凭证注入(不走 config.json 时)**——jar 旁 `config/application.properties`:

```properties
kingdee.push.clientId=<真实账套>
kingdee.push.clientSecret=<真实账套>
kingdee.push.appKey=<真实账套>
kingdee.push.appSecret=<可留空,outerInstanceId生效后动态获取>
kingdee.push.domain=https://tf.jdy.com
```

或环境变量:`KINGDEE_PUSH_CLIENTID` / `KINGDEE_PUSH_CLIENTSECRET` / `KINGDEE_PUSH_APPKEY` / `KINGDEE_PUSH_APPSECRET` / `KINGDEE_PUSH_DOMAIN`

**注意事项**:
- 真实账套与同步脚本同一套(基础资料本就完整,**无需导入**);推送只写单据数据
- 真实账套写入即真实业务数据,误推的单需在金蝶界面手动删除
- 金蝶 save 接口只能新建不能改/删,重复单号会报"组合值与其他表单重复"——但本按钮不传
  bill_no(金蝶自动编号),不会触发

---

## 四、日常使用

| 场景 | 行为 |
|---|---|
| 已审核+未转 → 点转ERP | 推送成功,回填 是否已转ERP=是 + 金蝶生成的ERP单号 + 操作人 + 时间 |
| 已转(是)再点 | 友好提示"该单据已转入ERP,不可重复转入"(防多次点击) |
| 弃审 | 清 是否已转ERP/ERP单号/操作人/时间 → 修改后重审可再转 |
| 批量转ERP | 弹窗列出全部 已审核+未转 单据,勾选批量推,逐行显示 成功/已转/失败 |
| 到金蝶后 | 单据为 Z(暂存)状态,**人工在金蝶界面审核** |

## 五、常见报错对照

| 报错 | 原因 | 处理 |
|---|---|---|
| `1030002006 授权密钥校验失败` | appSecret 已轮换(24h) | 取最新密钥更新 config.json,重启后端 |
| `参数number[xxx]不存在` | 账套缺该供应商/商品 | 先把基础资料导入对应账套 |
| `X-Api-Signature is invalid` | 签名原文 nonce/timestamp 错位(已修复) | 如再现,核对 KingdeePushService.apiSignature 传参顺序 |
| `请先在金蝶界面删除旧单` | 旧版曾传 bill_no 触发重复 | 当前版本不传 bill_no,不应再现 |
