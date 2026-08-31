# YINJIA-MES

**light-mes 面板引擎 + SQL Server HSDZ_MES 数据库** 的组合项目。

| 属性 | 内容 |
|---|---|
| 文档类型 | 项目说明 |
| 适用场景 | 项目入门 |
| 维护状态 | 生效 |
| 创建日期 | 2026-08-29 |
| 当前版本 | v0.5(2026-08-29 角色面板操作权限 11 项 + 模块分组) |

## v0.5 升级内容(角色操作权限)

| 升级项 | 说明 |
|---|---|
| 11 项操作权限 | 可见/查询/新增/修改/删除/导出EXCEL/打印预览/审核反审核/价格金额/复核反复核/调价 |
| 全选按钮 | 每个面板行末尾"全选"勾选框 + 模块折叠头"全选/清空"批量操作 |
| 权限联动 | 取消"可见"则清空全部权限;勾选其他操作隐含"可见";仅"可见"时不勾其他 |
| 存储格式 | yj_role_panel.perms 列存逗号分隔操作码(view,query,add,edit,delete,export,print,audit,price,review,adjust) |
| 模块分组 | 授权面板按真实模块折叠分组(基础资料/订单管理/仓库管理/生产管理,yj_panel.module_group) |
| 后端定义 | SysAdminController.PERMISSION_ACTIONS 常量暴露给前端;管理员=超级权限无需配置 |

## v0.4 升级内容(审批流照搬 light-mes)

| 升级项 | 说明 |
|---|---|
| 审批状态机 | 草稿→提交审批→审批中→审批通过(已审核)/审批驳回(草稿,意见必填);弃审回草稿;状态推导=已作废>已审核>审批中>草稿 |
| 审批留痕 | yj_form_approval 表(对齐 light-mes form_approval):SUBMIT/APPROVE/REJECT/UNAUDIT 全记录,含操作人/意见/节点 |
| 防伪校验 | requirePendingSubmission:通过/驳回必须紧跟有效 SUBMIT/PENDING |
| 审批权限 | 审批通过/驳回需 is_admin(对应 light-mes can_approve);前端 approvePanels 联动 |
| 守护规则 | 审批中不可保存/删除;仅草稿可删;已审核须先弃审 |
| 工具栏 | 单据面板审批组[提交审批/审批通过/审批驳回/审批情况/弃审](前端 normalizeApprovalGroups 归一化) |
| 待办通知 | todo=审批中单据(提交人/时间去审批) |
| 迁移脚本 | tools/migrate-approval-flow.sql(yj_form_approval + yj_doc_status.pending 列) |

## v0.3 升级内容(基础资料单单据化 + 规范落地)

| 升级项 | 说明 |
|---|---|
| 基础资料单单据结构 | KHDA/GFDA/YWYDA/CKDA/ZDGL 严格按 light-mes §八:queryFields=[]、dataSchema 仅"备注"、全部字段在 detail.tabs(业务键 khda/gfda/...)、gridTabs=面板名+"明细"/rowSource=rows、panelState=状态(启用/已作废) |
| 元数据扩展 | yj_panel 新增 detail_key(明细页签键);档案字段 place 全部归 detail;category=基础档案 |
| 工具栏对齐规范 | 档案:新增/修改/保存(保存,保存新增)/删除(删除,删除单据)/查找(查找,刷新)/打印/导入/更多(复制,导出,退出) |
| 四份开发规范 | docs/ 下落地 YINJIA 版:前端面板设计/后端逻辑设计/服务器部署/开发与质量(含 light-mes 同步流程与验收清单) |
| 迁移脚本 | tools/migrate-arch-single-doc.sql(存量库升级);setup-db.sql 已同步新结构 |

## v0.2 升级内容(同步 light-mes 8/27-8/28 更新)

| 升级项 | 说明 |
|---|---|
| 面板运行时注入 | 前端 core 渲染器不再直接依赖 business 层,经 `core/panel-runtime.js` 的 `installPanelRuntime` 注入(main.js) |
| 按钮注册表架构 | 后端新增 `panel/PanelRuntimeService + PanelActionRegistry + PanelActionHandler`,PxController 只依赖运行时契约;领域动作(生单等)经 Handler 插拔,通用生命周期仍走 ButtonService |
| 扫描填单(OCR) | 移植完整阿里云 OCR 链(`/api/ocr/scan-form`):图片校验/限流/按面板配置白名单映射表头与明细表格;未配置 `ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET` 时明确报"OCR 服务未配置" |
| 审批组归一化 | engine.normalizeApprovalGroups:含"提交审批"的面板合并为单一"审批"组(前端兼容层) |
| 现存量回填 | engine.fillCurrentStock 对接 STOCK_STATUS 面板;HSDZ 字段键(物料代码/物料名称)一并识别 |
| STOCK_STATUS 库存状况 | 新增 flat 平表模式面板(读 kucun 台账 588 行),fillCurrentStock/低库存预警共用 |
| 通知中心 | /api/portal/badge+notice:list 三分类:todo=yj_doc_status 待处理单据、message=s_log 操作日志、alarm=kucun 低库存(<100) |
| ApiResult 语义 | ok code=200(对齐 light-mes);OCR/上传/权限类错误走 body-code,避免 403 触发前端登出 |
| 档案保存加固 | 档案查询返回全量(≤2000 行),保证"缺席行=已删除"语义在全量上下文中执行 |

## 设计定位

- **设计与按钮逻辑来自 light-mes**:前端 `core/` 通用面板渲染器(PanelxList/PanelxForm/参照/选单弹窗)、`/api/px/*` 接口契约、中文按钮分发(保存/审核/弃审/删除)、草稿→已审核状态机,全部沿用 light-mes 的模式,前端 core 渲染器零修改。
- **面板与字段来自数据库**:面板注册(`yj_panel`)与字段定义(`yj_field`)存放在 HSDZ_MES 中,配置生成器实时读取并产出 light-mes 格式的 panel_config JSON。增删字段只需改 `yj_field` 表,无需改代码。
- **业务数据直读直写 HSDZ_MES 原表**(inh/outh/Porder/order_bt/order_bs/mate/dm_*),与老 ASPMIS 系统数据同源:留痕用 `asp_user1/asp_time1`(创建)、`asp_user2/asp_time2`(修改)、软删 `asp_cancel='Y'`,单号沿用 `s_allno` 号池(前缀+yyMMdd+4位序)。
- **原 light-mes 项目(C:\INCER\light-mes)保持不动**。

## 技术栈

```text
浏览器
  -> Vue 3 / Element Plus(light-mes core 渲染器)
  -> /api/*(契约与 light-mes 完全一致)
  -> Spring Boot 3 (JdbcTemplate + mssql-jdbc,端口 8090)
  -> SQL Server HSDZ_MES(PANDA 本机,SQL 账号 yinjia)
```

## 目录

```text
YINJIA-MES/
├── frontend/            # 从 light-mes 复制的前端;仅改 business/menus.js、engine.js(SINGLE_DOC_CODES)、品牌文案、代理端口
├── backend/
│   └── src/main/java/com/yinjia/mes/
│       ├── config/      # JWT + Security + 异常归一化(对齐 light-mes)
│       ├── controller/  # PxController(契约同 light-mes)/Auth/Shell(dashboard 等)
│       └── service/     # PanelRegistry(元数据) PanelConfigService(配置生成)
│                        # QueryService(行契约映射) ButtonService(按钮/状态机) FormNoService(s_allno)
├── tools/
│   ├── setup-db.sql     # yj_* 元数据表 + 登录 + 10 面板/121 字段种子(可反复执行)
│   ├── enable-mixed-auth.ps1  # 开启 SQL Server 混合认证(已执行过)
│   └── verify-api.ps1   # API 全链路验证(15 步)
└── start-project.bat    # 一键启动前后端
```

## 首批面板(11 个)

| 面板 | 数据表 | 模式 |
|---|---|---|
| KHDA 客户档案 / GFDA 厂商档案 / YWYDA 业务员档案 / CKDA 仓库档案 / ZDGL 数据字典 | dm_kh / dm_gf / dm_ywy / dm_ck / dm_gx | 档案(合成单单据) |
| RKD 入库单 / CKD 出库单 | inh / outh | 单据(单表分组) |
| CGD 采购单 | Porder | 单据(单表分组) |
| KHDD 客户订单 | order_bt + order_bs | 单据(头行分表) |
| WLBOM 物料清单 | mate | 单据(单表分组,6655 父件) |
| STOCK_STATUS 库存状况 | kucun | 平表报表(现存量回填/低库存预警数据源) |

## 本地启动

前置:JDK 24(D:\Program Files\Java\jdk-24)、SQL Server 运行中(HSDZ_MES 已还原,混合认证已开启)、Node 20。

1. 初始化元数据(仅首次或元数据变更时):

   ```powershell
   sqlcmd -S localhost -E -i tools\setup-db.sql   # 文件为 UTF-8 BOM
   ```

2. 构建后端:`backend\build.bat`(复用 light-mes 的 Maven)
3. 一键启动:`start-project.bat`
4. 访问 `http://localhost:5173`,账号 `admin / 123456`(首次启动自动种子到 yj_user)

## 面板配置如何"以数据库为准"

- `yj_field` 每行 = 一个字段的定义:`col_name`(表列)、`label`(中文标签,即前端字段键)、`data_type`(文本/小数/日期/下拉框/参照)、`place`(query,header,detail 的组合)、`dict_sql`(下拉选项来源)、`ref_panel/ref_field/display_field`(参照来源)。
- `PanelConfigService` 读取后实时生成 light-mes 契约的 panel_config(metadata/panelPageDto/dataSchema/detail),缓存 30 秒。
- 新增面板 = 在 `yj_panel`/`yj_field` 插入记录(参照 `tools/setup-db.sql` 的写法),前端菜单加一行,无需改后端代码。

## 状态与留痕约定

| 动作 | 实现 |
|---|---|
| 保存 | 无编号=新建(取 s_allno 号);有编号=行 upsert(有 id 更新/无 id 插入/缺席行软删),asp_user1=创建、asp_user2=最后修改 |
| 审核/弃审 | `yj_doc_status`(shr/shsj),不动旧表 |
| 删除 | 单据=yj_doc_status.canceled='Y';档案行=asp_cancel='Y' |
| 状态推导 | 已作废(canceled) > 已审核(shr 非空) > 草稿 |

## 已知边界(v0.2)

- 生单(推式跨单据流转)尚未实现:领域动作可经 `PanelActionHandler` 插拔注册(panel 包),无需改通用生命周期。
- 扫描填单需配置阿里云 OCR 密钥(`ALIBABA_CLOUD_ACCESS_KEY_ID/SECRET` 环境变量),未配置时按钮链路返回明确的 503 提示。
- 多级审批流未接入(yj_doc_status 只有一级审核);normalizeApprovalGroups 前端兼容已就绪。
- 档案保存为全量 upsert 语义(缺席行=软删),调用方必须先取全量再提交(前端已保证;直接调 API 需遵守)。
- 凭据/密钥:数据库口令在 application.yml(开发),生产须改环境变量 `YINJIA_JWT_SECRET` / 数据源注入。
