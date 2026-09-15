# 金蝶云·星辰销售订单同步工具 · 使用说明

> 从金蝶云·星辰(开放平台)定时拉取**销售订单 + 采购订单**(已审核),写入本系统 SQL Server 的
> `bd_so_order`/`bl_so_order` 与 `bd_pu_order`/`bl_pu_order`,对应面板(SO_ORDER/PU_ORDER)直接可见。
> 本文档面向需要在**其他电脑**上部署、测试、运维本工具的项目成员。

## 0. 两个脚本,各司其职

| 脚本 | 用途 | 拉取范围 | 运行方式 |
|---|---|---|---|
| **`sync.mjs`** | 日常增量(销售+采购订单 + **12 类基础资料档案**) | 订单:**已审核(C)** + 近 `windowDays`(默认31)天修改/新增;档案:全量+指纹跳过 | 计划任务,每 5 分钟 |
| **`init-sync.mjs`** | 首次初始化 / 定期复核 | **已审核(C)**、无时间窗(档案同 sync,全量+指纹) | **部署时手动跑一次即可**;月度复核由计划任务自动跑(可选) |

> - **两个脚本是同一个核心的两种用法**:初始化和月度复核都是 `init-sync.mjs` 全量扫描——
>   库空时=全量写入(约 30-40 分钟/6千张;档案约 4600 条,分页 `pageSize` 默认 **50 条/页**,
>   商品 3818 条约 23 分钟),库满时=指纹跳过(十几秒);
> - **初始化清污(2026-09-15 起,仅档案+init)**:每轮初始化在写入前先「确认 → 全量前像备份 →
>   删除本同步器旧数据(外部数据ID 非空 或 asp_user1='jdy-sync')→ 全量重建」,
>   保证初始化产物干净、不残留上一次的半截/改错数据;**手录行(无外部数据ID且非本同步器所写)保留**,
>   随后按编码列收编接管。增量(sync.mjs)不做清污,只增量写入;
> - **仅同步基础资料**:`config.sync.types` 只列 12 个 `BD_*` 即只跑档案(订单已由历史任务同步时使用);
> - **初始化只需启动一次**:新部署/换账套/重置数据后手动跑一次,之后无需再手动运行,
>   日常同步完全由 `sync.mjs` 每 5 分钟自动完成;
> - **月度复核是可选保险**:兜底增量时间窗的极小概率漏单(时钟偏差、窗口边界毛刺),
>   成本每月十几秒——删掉月度任务也不影响日常同步,建议保留;
> - 两个脚本**默认都只同步已审核单据**;config.sync.types 可增减(档案条目以 `BD_` 开头,
>   先于订单执行——商品的所属类别依赖商品分类先落表);
> - **基础资料档案(2026-09-15 起)**:客户(dm_kh)/供应商(dm_gf)/商品(bs_inv)/职员(bs_emp)/部门(bs_dept)/
>   仓库(bs_wh)/计量单位(bs_uom)/结算方式/客户分类/供应商分类/商品分类/币别。
>   编码列为空的行(如金蝶中无员工编码的职员)跳过并计数(MES 该列必填,不臆造编码);
>   无审核流不写 yj_doc_status;停用=行保留置停用位(dm_kh/dm_gf 走 asp_cancel);敏感字段
>   (地址/电话/邮箱/银行账号/手机/证件号,AES 密文)起步策略跳过置空,界面在金蝶维护;
>   空锚点的手录行按编码列收编接管(外部数据ID IS NULL AND 编码=xx);
> - **跨进程互斥锁(PID 存活判断)**:初始化长跑期间,计划任务的增量自动让行,不会并发竞争;
> - 已同步的单若在星辰被**弃审**,不会再出现在"已审核"列表,本地状态不自动回退
>   (以星辰为准;需要清理用第 8 节 SQL)。档案同理:金蝶删档后列表不再返回,本地行保留。
> - 两脚本共享 `sync-core.mjs`、`config.json`、`state.json`、日志(按日 `logs/sync-*.log`)。

> 为什么要有 init:增量依赖时间窗,极小概率漏窗(接口窗口过滤实测有边界毛刺,
> 已用"端点前移 `endBiasMinutes`,默认180分钟"规避);每月跑一次 init 做全量指纹比对即可兜底。

## 1. 工作原理

```text
Windows 计划任务(每 5 分钟,隐藏窗口)
  → node sync.mjs(增量)
     ① 主动获取授权(POST push_app_authorize,凭 outerInstanceId)
        → 当前 appKey/appSecret/domain   ← appSecret 官方 24 小时轮换,每次取 token 前自动刷新
     ② 换取 app-token(缓存约 23 小时;遇 1030002006 自动重取授权重试)
     ③ GET /jdy/v2/scm/sal_order        列表:bill_status=C + modify 近31天(端点前移10分钟)
     ④ 指纹比对:本地已有且列表级字段无变化 → 跳过(不调详情)
     ⑤ GET /jdy/v2/scm/sal_order_detail 仅对"新增/有变化"的单逐张取商品分录(节流)
     ⑥ 字段映射 → 事务写 SQL Server(幂等:外部数据ID 去重 + 审核状态镜像 yj_doc_status)
     ⑦ 日志追加 sync.log

node init-sync.mjs(初始化/复核):同上,但列表为全量(无时间窗),状态同为已审核(C)
```

- **凭证**:正式环境只需 `clientId + clientSecret + outerInstanceId` 三条——
  `appKey/appSecret/domain` 每次自动获取(appSecret 官方 24h 轮换,不能写死);
  静态密钥的特殊联调场景才在 config 里手填 appKey/appSecret;
- **指纹跳过**:列表级字段(状态/日期/客户/部门/业务员/金额/执行状态)拼成指纹存
  `bd_so_order.外部指纹`,无变化不拉详情——实测 3784 张全量复核仅 12 秒;
  局限:只改行明细而不影响列表字段的编辑可能滞后感知(靠月度 init 复核兜底);
- **幂等**:`bd_so_order.外部数据ID` 存星辰单据 id(唯一索引),重拉/重叠不产生重复单据;
- **限流**:账套级 500 次/分钟(官方);增量为"1 组授权/token + 几页列表 + 变化单详情"。

## 2. 运行安全规范(所有脚本强制遵循)

| 规范 | 实现方式 |
|---|---|
| **批量操作提示** | 按**实际写入量**判断:计划写入/删除超过 `confirmThreshold`(默认 200 条)→ 交互终端**必须输入 y 确认**;**等待确认超过 `confirmTimeoutSeconds`(默认 5 秒)自动放行并记告警**(隐藏窗口/计划任务里 stdin 可能"看起来可交互",不设超时会让进程永久挂起——实测踩坑);`--yes` 显式跳过 |
| **写入前备份** | 每次写入/删除前,把**将被影响的单据前像**(头表+行表原始行)快照到 `backup/<单据类型>-<时间戳>.jsonl`——增量**只备份待写单**(通常几张,几 KB),初始化为全量前像;**无变化时不产生备份文件**;超保留期(`backupRetentionDays`,默认365天)自动清理 |
| **数据量判断** | 提示与备份都先统计条数并写入日志;数据量越大越醒目(超过阈值必须在日志/终端可见) |
| **回滚能力** | `node _rollback.mjs backup/xxx.jsonl`(预演)→ 加 `--apply` 执行还原(单事务,失败整体回滚) |
| **日志与保留** | 日志按日分文件 `logs/sync-YYYY-MM-DD.log`,**默认保留 365 天**(规范要求至少一年),超期自动清理 |
| **范围** | 规范同样约束维护脚本(`_switch-prod.mjs --clean` 等);将来若新增"向金蝶写入"的脚本,须同样先备份+统计+提示 |

> 实时(增量)脚本同样执行备份与日志——数据量小(近31天窗口)但规范不打折。

## 3. 交付文件清单(本目录)

| 文件 | 作用 | 必需 |
|---|---|---|
| `sync.mjs` | **增量入口**(计划任务):已审核 + 近31天窗口 | ✓ |
| `init-sync.mjs` | **初始化/复核入口**(手动或每月):全量全部状态 | ✓ |
| `sync-core.mjs` | 共享核心:授权/列表/指纹/映射/落库/日志 | ✓ |
| `kingdee-client.mjs` | 星辰 API 客户端:两套签名/token/GET(重试) | ✓ |
| `run-hidden.vbs` | 计划任务隐藏启动器(消除 node 控制台弹窗) | ✓ |
| `config.example.json` | 配置模板(**复制为 config.json 再填**) | ✓ |
| `package.json` / `package-lock.json` | npm 依赖声明(mssql,连接 SQL Server) | ✓ |
| `migrate-add-external-cols.sql` | 数据库幂等迁移:bd_so_order 加 外部数据ID/外部单据号/外部指纹 + 唯一索引 | ✓ |
| `_verify-signature.mjs` | 诊断:离线校验签名算法与官方文档示例值是否一致 | 可选 |
| `_switch-prod.mjs` | 一次性切换脚本:补迁移 + 清空旧同步数据(切正式/换账套时用) | 可选 |
| `README.md` | 本文档 | — |

运行后本目录会自动产生(均不入 git):`config.json`(配置)、`state.json`(token 缓存)、`sync.log`(运行日志)、`node_modules/`(依赖)。

## 3. 前置条件

1. **Node.js ≥ 18**(建议 LTS):https://nodejs.org 下载安装,`node -v` 验证;
2. **SQL Server 可访问**:目标库默认 `HSDZ_MES`,需要一个有 `bd_so_order`/`bl_so_order`
   读写权限的 SQL 账号(本机后端的连接信息见项目 `backend/src/main/resources/application.yml`);
3. **金蝶开放平台凭证**(https://open.jdy.com 开发者后台),正式环境三条:
   - `clientId`/`clientSecret`:创建应用后,应用详情页"应用凭证"区;
   - `outerInstanceId`:**授权记录表格里的"第三方实例ID"**(购买API授权服务并完成授权后可见);
   - `appKey`/`appSecret`/`domain` **无需填写**——脚本每次自动获取(appSecret 官方 24h 轮换);
   - 静态密钥特殊联调场景:才手填 `appKey`/`appSecret` 并留空 outerInstanceId。

   > **凭证归属(对接模式)**:推荐四条凭证全部使用**客户自建应用**的——客户注册开发者、
   > 建应用、授权自己的账套,工具交付后由客户(或实施人员)填入自己的 config.json,
   > 安全边界最干净(凭证资产全归客户,我方不暴露自己的 clientSecret)。
   > 另一种模式(我方持有应用、客户仅授权)亦支持:clientId/clientSecret 用我方的,
   > 每个客户账套产生一组新 appKey/appSecret。

## 4. 新电脑部署(5 步,约 10 分钟)

> ⚠ 目录位置要求:**路径不要含括号/空格/中文**,推荐 `D:\jdy-sync`。
> (cmd 对括号路径的解析会导致计划任务静默失败,本项目实测踩过)

1. **复制整个目录**到目标机器,如 `D:\jdy-sync\`;
2. **装依赖**(PowerShell 中若 npm 报"禁止运行脚本",改用 `npm.cmd`):
   ```powershell
   cd D:\jdy-sync
   npm.cmd install
   ```
3. **配置**:复制 `config.example.json` → `config.json`,按下表填写:

   | 段 | 字段 | 说明 |
   |---|---|---|
   | kingdee | clientId / clientSecret | 应用凭证(应用级) |
   | kingdee | outerInstanceId | 正式授权的第三方实例ID(自动获取轮换密钥的关键) |
   | kingdee | appKey / appSecret | 仅静态密钥特殊场景填,正式环境留空 |
   | kingdee | domain | IDC 域名,如 https://tf.jdy.com |
   | database | server/port/database | SQL Server 地址与库名(本机默认 localhost:1433/HSDZ_MES) |
   | database | user / password | SQL 账号(如 yinjia) |
   | sync | billStatus | **增量**状态过滤:默认 `C`(仅已审核);空=全部 |
   | sync | initBillStatus | **初始化**状态过滤:默认 `C`(仅已审核);空=全部 |
   | sync | windowDays / endBiasMinutes | 增量时间窗天数(默认31)/ 窗口端点前移分钟(默认10,规避边界漏单) |
   | sync | pageSize / maxPages | 列表分页大小与最大页数(单次运行保护上限) |

   `config.json` 含密钥口令,**已被 .gitignore 排除,严禁提交或外发**;
4. **数据库迁移**(一次性,幂等可重复):SSMS 连接目标库执行 `migrate-add-external-cols.sql`,
   自检应输出四项 1;
5. **验证与初始化**:先 `node sync.mjs --probe` 验证链路,再 `node init-sync.mjs`
   完成首次全量初始化(数量大时约 1 分钟/千张),之后注册计划任务跑增量。

## 5. 验证与运行

```powershell
cd D:\jdy-sync
node sync.mjs --probe        # ① 验证凭证+全链路(不连数据库,零依赖)
node sync.mjs --dry-run      # ② 增量预演(已审核+31天窗),打印映射不写库
node sync.mjs                # ③ 正式增量(计划任务跑的就是它)
node init-sync.mjs           # ④ 首次初始化/月度复核(全量已审核,指纹跳过,很快)
```

预期输出(③,无新单时,实测约 2 秒):

```text
[时间] app-token 就绪(eyJ0eX...) [增量]
[时间] 列表第 1/3 页,共 246 条(近31天修改/新增)
[时间] 无变化跳过 246 张
[时间] 完成:新增 0,更新 0,失败 0,跳过 246
```

退出码:`0` 成功;`2` 部分单据失败(下轮自动重试);`1` 整体失败(看日志首行报错)。

## 6. 注册定时任务(一键,两个任务)

推荐直接运行随包脚本(**幂等,可重复执行**;管理员 PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File install-tasks.ps1
```

它会注册两个任务:

| 任务名 | 频率 | 动作 |
|---|---|---|
| `JdySalOrderSync` | 每 5 分钟 | `wscript run-hidden.vbs` → `sync.mjs`(增量) |
| `JdySalOrderSyncMonthly` | 每月 1 日 02:00 | `wscript run-hidden.vbs "init-sync.mjs --yes"`(全量复核) |

任务已内置的关键设置(实测经验,勿随意去掉):

- **隐藏窗口**:动作为 `wscript.exe run-hidden.vbs`(node 是控制台程序,直接作为动作会每 5 分钟弹黑窗);
  `run-hidden.vbs` 支持传参,第二参数即"脚本名+参数";
- **StartWhenAvailable**:机器关机/休眠期间错过的运行,开机后自动补跑(实测:周末关机两天,开机后一跳内补齐);
- **ExecutionTimeLimit = 1 小时**:任何卡住的实例最多挡 1 小时(默认 3 天会导致后续跳全部被压住);
- **MultipleInstancesPolicy = IgnoreNew**:不重复启动;
- 手动触发:`Start-ScheduledTask JdySalOrderSync`;查看结果:`Get-ScheduledTaskInfo JdySalOrderSync`。

> 为什么不手工写 `Register-ScheduledTask -Trigger`:PowerShell 5.1 的 `New-ScheduledTaskTrigger`
> **没有 -Monthly 参数**,且部分 Settings 组合需要管理员权限;统一改用 XML 注册(脚本已封装)。

常用运维命令:

```powershell
Start-ScheduledTask JdySalOrderSync      # 立即触发一次
Get-ScheduledTaskInfo JdySalOrderSync    # 看上次结果(0=正常)与下次时间
Unregister-ScheduledTask JdySalOrderSync -Confirm:$false   # 删除任务
```

改频率:删任务后把 `New-TimeSpan -Minutes 5` 改成目标值重新注册。
(可选)要求"用户未登录也运行":管理员权限下把注册命令加上
`-Principal (New-ScheduledTaskPrincipal -UserId "$env:COMPUTERNAME\$env:USERNAME" -LogonType S4U)`。

## 7. 字段映射

| 星辰(详情接口) | 本地 bd_so_order | 说明 |
|---|---|---|
| id | 外部数据ID | 幂等锚点(唯一索引) |
| bill_no | 单据编号 / 外部单据号 | 沿用星辰单号,与本地 SO- 前缀单号天然不冲突 |
| bill_date / remark | 单据日期 / 备注 | |
| customer_number / customer_name | 客户编码 / 客户 | |
| settle_customer_number | 结算客户 | 星辰详情仅返回编码 |
| dept_name / emp_name | 部门 / 业务员 | |
| contact_linkman | 联系人 | 电话/地址为加密敏感字段,不取 |
| bill_status C/Z | 单据状态 已审核/草稿 | 默认拉全部状态,如实映射;只要已审核则 billStatus 设 C |
| auditor_name / audit_time | 审核人 / 审核时间 | |
| 明细最早 delivery_date | 预计交货日期 | 头表无此字段 |

| 星辰 material_entity | 本地 bl_so_order |
|---|---|
| material_number / material_name / material_model | 存货编码 / 存货名称 / 规格型号 |
| qty / unit_name | 数量 / 销售单位 |
| price / cess / tax_price | 单价 / 税率% / 含税单价 |
| amount / all_amount / dis_amount | 金额 / 含税金额 / 折扣金额 |
| delivery_date / inv_qty / comment | 预计交货日期 / 现存量 / 备注 |

品牌/部门负责人/项目星辰无对应字段,置 NULL。写库统一 `asp_user1='jdy-sync'` 留痕;
更新时行表按单据编号先删后插(与头表同一事务)。

| 星辰 material_entity | 本地 bl_pu_order |
|---|---|
| material_number / material_name / material_model | 物料编码 / 物料名称 / 规格型号 |
| qty / unit_name | 数量 / 单位 |
| price / cess / tax_price | 单价 / 税率% / 含税单价 |
| amount / all_amount / dis_amount / dis_rate | 金额 / 含税金额 / 折扣金额 / 折扣% |
| delivery_date / inv_qty / comment / stock_name | 预计到货日期 / 现存量 / 备注 / 仓库 |
| aux_qty / aux_unit_name | 数量2 / 计量单位2 |

头表映射:bill_no→单据编号、bill_date→单据日期、supplier_name/number→供应商/供应商编码、
exchange_rate→汇率、明细最早 delivery_date→交货日期、数据来源='金蝶同步'。
**币种列本地 NOT NULL 而星辰只返回 currency_id**,统一写"人民币"(如需真实币别需扩展
币别基础资料接口;README 记录此简化)。采购列表行无金额字段,指纹由
供应商/执行状态/备注等组合。

**审核状态镜像(MES 显示的关键)**:MES 面板的"单据状态"由工作流注册表 `yj_doc_status`
推导(不看单据表物理列),同步会把星辰状态镜像进去:

| 星辰动作 | yj_doc_status | MES 显示 |
|---|---|---|
| 审核(bill_status=C) | shr/shsj=星辰审核人/审核时间 | 已审核 |
| 弃审(未审核) | shr/shsj 置空 | 草稿 |
| 单据关闭(S/H) | stopped=Y | 已中止 |

⚠ 同步单据以星辰为唯一事实源:在 MES 界面手动"审核"同步单,下一轮(≤5分钟)会被星辰状态覆盖。

**列表排序**:`asp_time1` 固定写星辰创建时间(创建留痕),MES"最新创建在前"排序稳定。

## 8. 常见问题(全部为实测踩坑)

| 现象 | 原因与处理 |
|---|---|
| 签名不匹配/401 | 确认 clientSecret 为最新(后台可"重新生成");可跑 `node _verify-signature.mjs` 自证算法 |
| `1030002006 授权密钥校验失败` | 账套重新授权后 appSecret 已变,更新 config.json |
| token 相关异常 | 删除 state.json 强制重取(缓存约 23h,正常无需干预) |
| `HTTP 429 已被限流` | 超出 500 次/分钟,等下一周期;频繁出现则加大任务间隔 |
| 计划任务 LastResult=1 且无日志 | 任务动作经 cmd/bat + 路径含括号 → 改用 run-hidden.vbs 方案(本文档第 6 节) |
| 自写 bat 报"不是内部或外部命令"碎片 | bat 必须 CRLF+ASCII(LF 会被 cmd 错位解析) |
| 每 5 分钟弹黑窗 | 任务用了控制台动作 → 用 run-hidden.vbs 隐藏启动(本文档第 6 节) |
| SQL 连接失败 | 检查 1433 端口/防火墙/账号;本地实例 encrypt 保持 false |
| 税率字段口径存疑 | 星辰 cess 为百分点数值(13 表示 13%);拉到真实单后 dry-run 核对一次 |
| 想立即刷新全部 | 跑 `node init-sync.mjs`(全量指纹复核,十几秒);增量手动触发 `Start-ScheduledTask JdySalOrderSync` |
| 单据异常/漏单怀疑 | 跑 `node init-sync.mjs` 全量复核兜底(时间窗外的变化会被它补齐) |

**更换账套 / 重置已同步数据**:改 `config.json` 的 kingdee 段(新账套的
clientId/clientSecret/outerInstanceId)→ `node _switch-prod.mjs`(清空旧同步数据+补迁移)
→ `node init-sync.mjs` 重新初始化。清理 SQL(`外部数据ID IS NOT NULL` 即已同步行):

```sql
DELETE FROM bl_so_order WHERE 单据编号 IN (SELECT 单据编号 FROM bd_so_order WHERE 外部数据ID IS NOT NULL);
DELETE FROM yj_doc_status WHERE panel_code = N'SO_ORDER' AND doc_no IN (SELECT 单据编号 FROM bd_so_order WHERE 外部数据ID IS NOT NULL);
DELETE FROM bd_so_order WHERE 外部数据ID IS NOT NULL;
```

## 9. 安全要点(对应金蝶开放平台安全规范)

- 密钥/连接信息只放 `config.json`,已 gitignore,**严禁硬编码进代码或提交仓库**;
- `clientSecret`/`appSecret` 泄露时立即到开发者后台"重新生成";
- 沙箱数据定期清理、限额 100 条,仅用于联调,勿当业务数据;
- 日志只记运行锚点(条数/单号/结果),不打印全量报文。
