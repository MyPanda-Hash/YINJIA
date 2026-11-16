/* ============================================================
   migrate-wo-bom-20261113.sql — 2026-11-13
   新增「工单物料清单」wo_bom(临时工单用料) + 生产工单页动作词 create

   用户口径(2026-11-13,附生产工单/新增工单截图):
     「让当前的生产工单可以新建生产工单」;
     「在当前新建生产工单中增加一个页签按钮,为增加临时工单,临时工单需要实现上方为主物料
      下方为所需的物料……增加临时工单BOM」;
     「这个页面能否同时作为新建生产工单的实现呢?作为生产工单的实现的话会不会导致只填写
      主物料,而没写子物料导致的当前 bom 没法被查询到?」

   ⇒ 设计(与用户提问的答复一致):
     ① 同一个「新增生产工单」弹窗两页签:常规工单 / 临时工单;
     ② 常规工单只填主物料 —— 用料仍按产品的**标准组装物料清单** bs_asm_bom 查(领料/报工
        现有取数逻辑不变),所以不会出现「BOM 查不到」;
     ③ 临时工单在主物料之下**必须**维护子件(本表),这是"按工单定制"的用料,不污染产品标准
        BOM;领料/报工取 BOM 时**优先取本表**,查不到再回落 bs_asm_bom。
     ④ 为什么另起一张表而不复用 bs_asm_bom:那张表按「产品编码+工序」唯一取最新一版,
        写进去等于把临时用料升级成该产品的标准 BOM(所有后续工单都会按它领料)—— 不是本意。

   本脚本:
     ① 新建 wo_bom(工单行id × 行序 → 一个子件);
     ② 表 + 逐列 MS_Description 中文注明;
     ③ 唯一键(同一工单行同一行序一格,软删不占唯一)+ 按工单号查询索引;
     ④ 生产工单页面面板(WORK_ORDER_LIST)加动作词 create(「新增」),授予已有查看权的角色。

   幂等可重跑;两账套均执行(先正式、后测试)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.wo_bom', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_bom (
        id          bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_wo_bom PRIMARY KEY,
        [工单号]    nvarchar(50)    NOT NULL,
        [工单行id]  bigint          NULL,
        [工单行号]  int             NULL,
        [产品编码]  nvarchar(100)   NULL,
        [行序]      int             NOT NULL CONSTRAINT DF_wo_bom_seq DEFAULT (0),
        [子件编码]  nvarchar(100)   NOT NULL,
        [子件名称]  nvarchar(200)   NULL,
        [子件规格]  nvarchar(200)   NULL,
        [计量单位]  nvarchar(20)    NULL,
        [标准用量]  decimal(18,4)   NOT NULL CONSTRAINT DF_wo_bom_qty DEFAULT (0),
        [损耗量]    decimal(18,4)   NOT NULL CONSTRAINT DF_wo_bom_loss DEFAULT (0),
        [行备注]    nvarchar(500)   NULL,
        [来源]      nvarchar(20)    NOT NULL CONSTRAINT DF_wo_bom_src DEFAULT (N'临时工单'),
        asp_user1   nvarchar(50)    NULL,
        asp_time1   datetime2(3)    NULL,
        asp_user2   nvarchar(50)    NULL,
        asp_time2   datetime2(3)    NULL,
        asp_cancel  nvarchar(1)     NOT NULL CONSTRAINT DF_wo_bom_cancel DEFAULT ('N')
    );
END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_bom_row_line'
               AND object_id = OBJECT_ID(N'dbo.wo_bom'))
    CREATE UNIQUE INDEX UX_wo_bom_row_line
        ON dbo.wo_bom([工单行id], [行序])
        WHERE asp_cancel = 'N';
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_bom_wo_no'
               AND object_id = OBJECT_ID(N'dbo.wo_bom'))
    CREATE INDEX IX_wo_bom_wo_no
        ON dbo.wo_bom([工单号], [工单行号])
        INCLUDE ([工单行id], [子件编码], [标准用量]);
GO
-- ── 中文注明(表 + 逐列)──────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_bom')
                 AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description',
         N'工单物料清单(临时工单用料):一行=工单行×一个子件;2026-11-13 新增。常规工单的用料仍取产品标准组装物料清单 bs_asm_bom;本表只在「新增生产工单→临时工单」时写入,领料/报工取 BOM 时优先本表、查不到回落 bs_asm_bom',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_bom';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description',
         N'工单物料清单(临时工单用料):一行=工单行×一个子件;2026-11-13 新增。常规工单的用料仍取产品标准组装物料清单 bs_asm_bom;本表只在「新增生产工单→临时工单」时写入,领料/报工取 BOM 时优先本表、查不到回落 bs_asm_bom',
         N'SCHEMA', N'dbo', N'TABLE', N'wo_bom';
GO
DECLARE @cols TABLE (col sysname, descr nvarchar(400));
INSERT INTO @cols (col, descr) VALUES
 (N'工单号',   N'工单号(= plang.pl_no)'),
 (N'工单行id', N'工单行id(= plang.id;领料/报工按它精确定位本工单行的临时用料)'),
 (N'工单行号', N'工单行号(= plang.pl_xc;冗余展示列)'),
 (N'产品编码', N'主物料编码(= plang.dm;临时工单"上方主物料")'),
 (N'行序',     N'行序(同一工单行内 1..N;唯一键 UX_wo_bom_row_line 的一部分)'),
 (N'子件编码', N'子件物料编码(= bs_inv.存货编码;临时工单"下方所需物料")'),
 (N'子件名称', N'子件物料名称'),
 (N'子件规格', N'子件规格型号'),
 (N'计量单位', N'计量单位(空时取 bs_inv.计量单位)'),
 (N'标准用量', N'标准用量(每 1 个成品的用量;领料需求 = 本列 × 工单排产数量)'),
 (N'损耗量',   N'损耗量(预留,当前不参与领料计算)'),
 (N'行备注',   N'行备注'),
 (N'来源',     N'来源(临时工单=本表唯一写入入口;留给后续其它来源扩展)'),
 (N'asp_user1', N'创建人'),
 (N'asp_time1', N'创建时间'),
 (N'asp_user2', N'最后修改人'),
 (N'asp_time2', N'最后修改时间'),
 (N'asp_cancel', N'作废标志(N=有效,Y=作废)');
DECLARE @col sysname, @descr nvarchar(400);
DECLARE cur CURSOR FOR SELECT col, descr FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @col, @descr;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.class = 1 AND ep.major_id = OBJECT_ID(N'dbo.wo_bom')
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_bom'), @col, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @descr,
             N'SCHEMA', N'dbo', N'TABLE', N'wo_bom', N'COLUMN', @col;
    ELSE
        EXEC sp_updateextendedproperty N'MS_Description', @descr,
             N'SCHEMA', N'dbo', N'TABLE', N'wo_bom', N'COLUMN', @col;
    FETCH NEXT FROM cur INTO @col, @descr;
END
CLOSE cur;
DEALLOCATE cur;
GO
-- ── 页面动作词「新增」(create):生产工单页;授予已有查看权的角色 ──
-- 口径与 2026-10-29 dayplan 一致:已有「可见」的角色补授,不另行发一份新的权限矩阵。
UPDATE rp
   SET rp.perms = CASE WHEN ISNULL(rp.perms, N'') = N'' THEN N'create'
                       ELSE rp.perms + N',create' END
  FROM dbo.yj_role_panel rp
 WHERE rp.panel_code = N'WORK_ORDER_LIST'
   AND ISNULL(rp.perms, N'') LIKE N'%view%'
   AND ISNULL(rp.perms, N'') NOT LIKE N'%create%';
GO
-- ── 自检 ──────────────────────────────────────────────────────────────
DECLARE @bad int = 0;
IF OBJECT_ID(N'dbo.wo_bom', N'U') IS NULL SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PK_wo_bom'
               AND object_id = OBJECT_ID(N'dbo.wo_bom')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_wo_bom_row_line'
               AND object_id = OBJECT_ID(N'dbo.wo_bom')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_bom_wo_no'
               AND object_id = OBJECT_ID(N'dbo.wo_bom')) SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_bom')
                 AND minor_id = 0 AND name = N'MS_Description') SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM sys.extended_properties
    WHERE class = 1 AND major_id = OBJECT_ID(N'dbo.wo_bom')
      AND minor_id > 0 AND name = N'MS_Description') < 18 SET @bad = @bad + 1;
IF NOT EXISTS (SELECT 1 FROM dbo.yj_role_panel WHERE panel_code = N'WORK_ORDER_LIST'
               AND perms LIKE N'%create%') SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'工单物料清单(wo_bom)自检失败(%d 项缺失)', 16, 1, @bad);
ELSE PRINT N'wo_bom 就绪(表 + 主键/唯一/查询索引 + 逐列中文注明 + 生产工单页 create 授权)';
GO
