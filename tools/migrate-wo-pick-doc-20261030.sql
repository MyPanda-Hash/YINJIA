/* ============================================================
   migrate-wo-pick-doc-20261030.sql — 「手机扫码 · 生产领料」配对台账

   用户口径(2026-10-30):
     「把生产领料和工序报工这两个 app 的面版重新放在一个新的『手机扫码』(和生产计划平级)导航下。
      工序报工不变。生产领料重写。
      现在是先做一个『生成工单领料/退料单』,先扫工单号,然后根据这个工单的物料,去查询组织工艺清单的
      组织bom表。对应生成一条生产领料单和生产退料单的数据。
      然后进入『生产领料』的界面……如果点进去对应单据里面可以看到对应的领料单明细。……
      全部领料完成后才可以提交转成材料出库单,并且将已完成的单据,在生产领料的界面放到下面的已完成区
      (并且已完成和未完成都可以展开和收缩)。
      生产退料与领料一致,只是退料默认数量为0。可以不进行退料操作,退料生成的应该是其他入库单,并且写好备注。」

   ------------------------------------------------------------
   ★ 为什么需要这张表(不建行不行)
   ------------------------------------------------------------
   领料单与退料单在物理上是**两张不同面板的单据**:
     领料 = 生产领料单,落 `bd_material_out` + `bl_material_out`(业务类型「生产领料」);
     退料 = 生产退料单,按用户口径最终转成「其他入库单」。
   两张单在库里**没有任何互相指向的列**,而这一版的核心交互恰恰是「一对单据、两个页签一起看、
   一起判定是否完成」。如果只靠 `加工单号 + 工单行号` 反查,会踩三个坑:

     ① **无法区分"这一对"**:2026-10-18 起口径是「一个生产工单可以对应多个领料单据」,
        同一工单行可以同时存在多张领料单;按工单号+行号反查会一次捞出一堆,分不清哪张配哪张;

     ② **没有"未完成 / 已完成"的状态**:用户要求列表页把已完成的单据放到下面的已完成区、
        且两组都能展开收起 —— 这个"完成"不是单据自身的状态(领料单审核完才叫出库,而用户在
        "全部领完"那一刻就要求能提交),必须有地方记「这一对领料是否已领满、是否已提交」;

     ③ **防重复生单**:扫一次工单就生成一对单,连扫两下会生成两对空单,台账的唯一约束挡得住。

   ⇒ 本表 = **单据头级的配对台账**(一对领料/退料单一行),不是明细表、不参与库存计算。

   ------------------------------------------------------------
   ★ 与"库存批次追溯"的关系(AGENTS 红线,必须写明结论)
   ------------------------------------------------------------
   本表**不参与任何库存增减**:库存只由 `StockLedgerService` 在材料出库单/其他入库单
   审核时按 `kucun(物料,仓库,批号)` 写入。本表只记单号与状态,不碰批次、不碰数量。
   故它不改变 `docs/development/上线前必验-库存批次追溯.md` §五 的任何验收口径 ——
   本期出库仍沿用验收期权宜口径(可用量按 物料+仓库 判断,代码处标注 `// 【上线前改写】`)。

   ------------------------------------------------------------
   幂等:建表/索引/注明/设置键全部判存在;可重复执行(不动已有数据)。
   两账套都执行(正式 HSDZ_MES 先、测试 HSDZ_MES_TEST 后),已登记进 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- 1. 配对台账表 ---------- */
IF OBJECT_ID('dbo.wo_pick_doc','U') IS NULL
CREATE TABLE dbo.wo_pick_doc (
  id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_pick_doc PRIMARY KEY,
  -- 工单键:与 plang(pl_no, pl_xc) 同口径,也是唯一约束的两列
  工单号        nvarchar(60)   NOT NULL,
  工单行号      int            NOT NULL CONSTRAINT DF_wo_pick_doc_xc DEFAULT 0,
  -- 这一对的来源产品(BOM 是按产品编号查的,存下来便于售后追溯"当时按哪张 BOM 展开")
  产品编号      nvarchar(120)  NULL,
  产品名称      nvarchar(200)  NULL,
  -- 一对单据的单号(两边各自可空:退料单可以整单作废,领料单在极少数情况下也会被删)
  领料单号      nvarchar(60)   NULL,
  退料单号      nvarchar(60)   NULL,
  -- 状态:未完成 / 已完成 / 已作废
  --   未完成 = 生成了但还没领满(或领满没提交)
  --   已完成 = 全部明细行都已领完并提交转材料出库单
  --   已作废 = 空单被整单作废(退料单数量全 0 又不做退料时走这条)
  状态          nvarchar(20)   NOT NULL CONSTRAINT DF_wo_pick_doc_state DEFAULT N'未完成',
  -- 领料侧进度快照(提交后用不到,但列表页要显示"已领几项/共几项",避免每行都去数明细)
  物料项数      int            NOT NULL CONSTRAINT DF_wo_pick_doc_items DEFAULT 0,
  已领项数      int            NOT NULL CONSTRAINT DF_wo_pick_doc_done DEFAULT 0,
  -- 打印:生单时自动打一次工单二维码(用户口径「在生成生产领料单的时候自动打印一次」)
  打印次数      int            NOT NULL CONSTRAINT DF_wo_pick_doc_print DEFAULT 0,
  打印时间      datetime2      NULL,
  -- 留痕
  创建人        nvarchar(50)   NULL,
  创建时间      datetime2      NULL CONSTRAINT DF_wo_pick_doc_cat DEFAULT SYSDATETIME(),
  提交人        nvarchar(50)   NULL,
  提交时间      datetime2      NULL,
  -- 审计列(AGENTS 规范:单据类表必须带 asp_user1/2 + asp_time1/2)
  asp_user1     nvarchar(50)   NULL,
  asp_time1     datetime2      NULL,
  asp_user2     nvarchar(50)   NULL,
  asp_time2     datetime2      NULL,
  asp_cancel    char(1)        NOT NULL CONSTRAINT DF_wo_pick_doc_cancel DEFAULT 'N'
);
GO

-- 唯一约束:一个工单行只能有**一对有效**单据 —— 这是防"连扫两下生成两对空单"的硬闸门。
-- ⚠ 用过滤索引排除已作废的行:作废后允许重新生单(现场常见"开错了,作废重开")。
IF OBJECT_ID('dbo.wo_pick_doc','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_wo_pick_doc_wo' AND object_id = OBJECT_ID('dbo.wo_pick_doc'))
  CREATE UNIQUE INDEX UX_wo_pick_doc_wo ON dbo.wo_pick_doc(工单号, 工单行号)
      WHERE 状态 <> N'已作废';
GO
-- 列表页按状态分组 + 按时间倒序翻页(未完成在上、已完成在下),故单列索引足够
IF OBJECT_ID('dbo.wo_pick_doc','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_doc_state' AND object_id = OBJECT_ID('dbo.wo_pick_doc'))
  CREATE INDEX IX_wo_pick_doc_state ON dbo.wo_pick_doc(状态, 创建时间 DESC);
GO
-- 按单号反查(从材料出库单/其他入库单跳回台账)
IF OBJECT_ID('dbo.wo_pick_doc','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_doc_out' AND object_id = OBJECT_ID('dbo.wo_pick_doc'))
  CREATE INDEX IX_wo_pick_doc_out ON dbo.wo_pick_doc(领料单号);
GO
IF OBJECT_ID('dbo.wo_pick_doc','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wo_pick_doc_back' AND object_id = OBJECT_ID('dbo.wo_pick_doc'))
  CREATE INDEX IX_wo_pick_doc_back ON dbo.wo_pick_doc(退料单号);
GO

/* ---------- 2. 中文注明(表级 + 列级,幂等;AGENTS 硬规范) ---------- */
DECLARE @tbl sysname = N'wo_pick_doc';
DECLARE @c TABLE (col sysname, descr nvarchar(500));
INSERT INTO @c (col, descr) VALUES
 (N'id',        N'主键(自增;一行 = 一个工单行的一对领料/退料单)'),
 (N'工单号',    N'工单号(与 plang.pl_no 同口径;与工单行号一起唯一确定这一对单据)'),
 (N'工单行号',  N'工单行号(与 plang.pl_xc 同口径;扫工单码里的 1000+行号 解出的值)'),
 (N'产品编号',  N'产品编号(该工单行的产品;BOM 按产品编号查组装BOM表,存下来便于追溯当时用的哪张 BOM)'),
 (N'产品名称',  N'产品名称(该工单行的产品名称,列表页直接显示,免得每行回查 plang)'),
 (N'领料单号',  N'领料单单号(= 材料出库单 bd_material_out.单据编号,业务类型「生产领料」)'),
 (N'退料单号',  N'退料单单号(退料默认数量为 0;不做退料则整单作废,不产生其他入库单)'),
 (N'状态',      N'这一对单据的状态:未完成=已生单未领满/未提交;已完成=全部领完并提交转材料出库单;已作废=空单整单作废'),
 (N'物料项数',  N'该工单行按组装BOM表展开的物料项数(列表页显示「已领 N / 共 M」的分母)'),
 (N'已领项数',  N'已领到数量的物料项数(领满/提交时等于物料项数)'),
 (N'打印次数',  N'工单二维码打印次数(生单时自动打一次,单据里可重打,每次 +1)'),
 (N'打印时间',  N'工单二维码最后一次打印时间'),
 (N'创建人',    N'生单人(扫工单生成这一对单据的登录账号)'),
 (N'创建时间',  N'生单时间'),
 (N'提交人',    N'提交人(把这一对单据转成材料出库单的登录账号)'),
 (N'提交时间',  N'提交时间(全部领完后提交的时刻)'),
 (N'asp_user1', N'创建人(审计列,与旧表同口径)'),
 (N'asp_time1', N'创建时间(审计列)'),
 (N'asp_user2', N'最后修改人(审计列)'),
 (N'asp_time2', N'最后修改时间(审计列)'),
 (N'asp_cancel',N'作废标记(N=有效;Y=作废。领料/退料单本身删干净后本行置 Y)');

IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.wo_pick_doc') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'手机扫码·生产领料 配对台账:一行 = 一个工单行的一对「生产领料单 + 生产退料单」;记录单号/状态/已领项数,不参与库存增减',
       N'SCHEMA', N'dbo', N'TABLE', @tbl;

DECLARE @col sysname, @d nvarchar(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @c;
OPEN cur;
FETCH NEXT FROM cur INTO @col, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                  WHERE major_id = OBJECT_ID(N'dbo.wo_pick_doc')
                    AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_pick_doc'), @col, 'ColumnId')
                    AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @d,
         N'SCHEMA', N'dbo', N'TABLE', @tbl, N'COLUMN', @col;
  FETCH NEXT FROM cur INTO @col, @d;
END
CLOSE cur; DEALLOCATE cur;
GO

/* ---------- 3. 系统参数:自动打印站点(2026-10-30) ----------
   用户口径:「(打印)要单独配一个自动打印的面版(这个面版是电脑上的)。只要这个面版配置参数
   并且设置成打开,然后在手机打印的时候就可以关联这个打开了面版参数的电脑,
   这台电脑连接的打印机就会自动打印」。

   ★ 为什么这里只放 3 个键、不放打印机名:
     打印机名/站点名是**每台电脑各自的**(一个账号可能登录多台电脑),
     存进库里就变成"一台电脑的设置盖住所有电脑"。故:
       · 云端的这三个键 = 全局开关与**兜底目标**(哪台是真打印工作站由下面 heartbeat 判断);
       · 打印机名/站点名由前端按浏览器 localStorage 绑本机(PrintStation.vue)。
   这三个键的作用是让手机端知道"现在有没有可用的打印电脑"。

   键名沿用既有 yj_app_setting 的 `域.键` 写法(与 db_backup.* 同款)。 */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'print.auto_enabled')
  INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
  VALUES (N'print.auto_enabled', N'N',
          N'自动打印总开关(Y=允许手机端把打印任务发给「自动打印」站点电脑;/Y 以外一律不接单)',
          N'migration', SYSDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'print.station_name')
  INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
  VALUES (N'print.station_name', N'',
          N'打印机站点的显示名(手机端选机时看到的名字;空=按电脑名显示)。真正的打印机名在本机浏览器里配',
          N'migration', SYSDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'print.last_heartbeat')
  INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
  VALUES (N'print.last_heartbeat', N'',
          N'打印站点最后一次心跳时间(ISO 格式;打印站点页每 15 秒刷新。手机端据此判断"有没有在线的打印电脑")',
          N'migration', SYSDATETIME());
GO

/* ---------- 4. 自检(缺一项即 RAISERROR;DbSync 遇错中止并**不写** yj_schema_log,修好重跑即可) ----------
   不在此处 BEGIN TRAN:本脚本前面已按批(GO)提交,包一层 BEGIN TRAN 也不回滚已提交的建表,
   反而会让失败时的报错信息更绕。DbSync 的口径是"失败即不登记、脚本幂等可重跑",
   故自检只负责**把问题点名报出来**(和 migrate-menu-node-20261023.sql 一致)。 */
DECLARE @colCnt int, @idxCnt int, @keyCnt int, @descCnt int;

SELECT @colCnt = COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.wo_pick_doc');
SELECT @idxCnt = COUNT(*) FROM sys.indexes
 WHERE object_id = OBJECT_ID(N'dbo.wo_pick_doc')
   AND name IN (N'UX_wo_pick_doc_wo', N'IX_wo_pick_doc_state', N'IX_wo_pick_doc_out', N'IX_wo_pick_doc_back');
SELECT @keyCnt = COUNT(*) FROM dbo.yj_app_setting
 WHERE setting_key IN (N'print.auto_enabled', N'print.station_name', N'print.last_heartbeat');
SELECT @descCnt = COUNT(*) FROM sys.extended_properties
 WHERE major_id = OBJECT_ID(N'dbo.wo_pick_doc') AND minor_id > 0 AND name = N'MS_Description';

-- 期望:列 21(21 列全带中文注明)、索引 4、设置键 3、表级注明 1
IF @colCnt <> 21
   RAISERROR(N'[FAIL] wo_pick_doc 列数 %d,应为 21', 16, 1, @colCnt);
IF @idxCnt <> 4
   RAISERROR(N'[FAIL] wo_pick_doc 索引 %d/4(缺 UX_wo_pick_doc_wo / IX_wo_pick_doc_state / IX_wo_pick_doc_out / IX_wo_pick_doc_back)', 16, 1, @idxCnt);
IF @keyCnt <> 3
   RAISERROR(N'[FAIL] yj_app_setting 缺 print.* 参数,%d/3', 16, 1, @keyCnt);
IF @descCnt < 21
   RAISERROR(N'[FAIL] wo_pick_doc 列级中文注明 %d/21(AGENTS:新表必须逐列注明)', 16, 1, @descCnt);
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.wo_pick_doc') AND minor_id = 0 AND name = N'MS_Description')
   RAISERROR(N'[FAIL] wo_pick_doc 缺表级中文注明', 16, 1);

IF @colCnt = 21 AND @idxCnt = 4 AND @keyCnt = 3 AND @descCnt >= 21
   PRINT N'[PASS] wo_pick_doc:21 列 / 4 索引 / 21 条列注明 / 表注明齐备;print.* 3 个参数就位';
GO
