# 转ERP按钮 运维说明

> 面板:采购入库(PURCHASE_IN)/ 销售出库(SALE_OUT) → 工具栏「转ERP ▼」(转ERP / 批量转ERP)
> 实现:纯 Java(KingdeePushService:签名 + HttpURLConnection),**无 Node 子进程,部署包自包含**

---

## 一、凭证安全(为什么凭证不会被看到)

所有含密钥的文件均已 gitignore 且未跟踪,**推送仓库不包含任何凭证**:

| 文件 | 内容 | git 状态 |
|---|---|---|
| `deploy/push/config.json` | 当前生效账套凭证 | ✅ gitignored,未跟踪 |
| `deploy/push/config.example.json` | 占位符模板 | 入库,无真实密钥 |

**自查命令**(每次推送前可复核):

```bat
git ls-files deploy/push/config.json   :: 应输出为空
git grep -l "<密钥片段>" HEAD            :: 应无结果
```

历史遗留说明:早期一次提交曾带入**已作废**的测试沙箱旧密钥(appSecret 已轮换失效);
保险起见可在金蝶开放平台重置该 clientSecret 一次,历史值即彻底无效。

---

## 二、执行转ERP前(检查清单)

| # | 检查项 | 说明 |
|---|---|---|
| 1 | `deploy/push/config.json` 凭证指向目标账套 | **真实账套**(2026-09-18 起):clientId/clientSecret + **outerInstanceId**(动态授权,appKey/appSecret 留空,24h 轮换自动自愈);测试沙箱等静态密钥场景才手填 appKey/appSecret |
| 2 | 后端运行中 | 本地:`java -jar backend/target/*.jar`(工作目录=仓库根);服务器:部署包 |
| 3 | 账套基础资料齐 | 真实账套与同步脚本同一套,12 类档案已全量同步,**无需导入**;缺档时报 `参数number[xxx]不存在` |
| 4 | 单据满足条件 | ①已审核(审批通过) ②是否已转ERP=否 ③有明细行 ④明细行仓库已填(必填红星) |
| 5 | 按钮出现 | 工具栏「转ERP ▼」;没有则刷新页面(面板配置缓存 30s) |

**换凭证后生效时机**:app-token 有 22h 缓存;新凭证在下次取 token 时生效,立即生效需重启后端。

---

## 三、切换账套步骤(2026-09-18 已切真实账套,本节留作换账套操作手册)

> 动态授权已实现:`KingdeePushService.fetchAuthorization` 凭 outerInstanceId 自动取当前
> appKey/appSecret/domain(appSecret 官方 24h 轮换,取新 token 前自动刷新,1030002006 自愈重试),
> 与 `deploy/kingdee-client.mjs` 同算法——真实账套**无需手工维护密钥**。

| # | 步骤 | 说明 |
|---|---|---|
| 1 | 换凭证(二选一) | ① **本地双套切换**:`deploy/push/config.test.json` 是测试套凭证(静态密钥,24h轮换需手工续),切换=把它的 kingdee 段覆盖 `config.json` 的 kingdee 段;**切回真实套**=kingdee 段改回真实套三件套 clientId/clientSecret/outerInstanceId(与 `deploy/config.json` 读入同步同套,对照可取;appKey/appSecret 留空走动态授权);② 服务器:jar 旁 `config/application.properties` 配 `kingdee.push.*`(见下方)或同名环境变量 |
| 2 | 重启后端 | 清 app-token 与单位ID缓存,立即用新账套(切换必做,凭证与缓存均驻内存) |
| 3 | 验证 | ①推**一张**已审核单 ②金蝶目标账套界面核对生成的 Z 状态暂存单 ③MES 回填 ERP单号=金蝶编号(≠MES编号) |
| 4 | 核对备注 | 金蝶单备注含 `[MES:单据编号]` 可追溯来源 |

> **账套差异自动适配(2026-09-18)**:计量单位ID(`unit_id`)按账套各不同(米=8 只是读入账套的ID),
> 推送代码按**当前凭证**实时拉目标账套单位主数据(`/jdy/v2/bd/measure_unit`,缓存22h)按名称换ID,
> 本地 bs_uom 档案不参与——测试/真实套切换零代码改动,不会因单位ID错位静默推错单位。

**服务器凭证注入(不走 config.json 时)**——jar 旁 `config/application.properties`:

```properties
kingdee.push.clientId=<目标账套>
kingdee.push.clientSecret=<目标账套>
kingdee.push.outerInstanceId=<目标账套第三方实例ID,动态授权必配>
kingdee.push.appKey=
kingdee.push.appSecret=
kingdee.push.domain=https://tf.jdy.com
```

或环境变量:`KINGDEE_PUSH_CLIENTID` / `KINGDEE_PUSH_CLIENTSECRET` / `KINGDEE_PUSH_OUTERINSTANCEID` / `KINGDEE_PUSH_APPKEY` / `KINGDEE_PUSH_APPSECRET` / `KINGDEE_PUSH_DOMAIN`

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
| `1030002006 授权密钥校验失败` | appSecret 已轮换(24h) | 配了 outerInstanceId 时**自动自愈**(重取授权再试),无需处理;静态密钥场景(测试套)才需手工更新 config.json 并重启后端 |
| `第N行基础资料"unit"字段不能为空` | 保存接口必送 `unit_id`(金蝶单位ID),漏送或送的名称解析不到都会这样报 | 已修(2026-09-18):按当前账套单位主数据自动换ID;若报"无对应ID"=行上计量单位名称在该账套不存在,改行单位或到金蝶补单位档案 |
| `参数number[xxx]不存在` | 账套缺该供应商/商品 | 先把基础资料导入对应账套(真实账套已全量同步,一般不出现) |
| `X-Api-Signature is invalid` | 签名原文 nonce/timestamp 错位(已修复) | 如再现,核对 KingdeePushService.apiSignature 传参顺序 |
| `请先在金蝶界面删除旧单` | 旧版曾传 bill_no 触发重复 | 当前版本不传 bill_no,不应再现 |
