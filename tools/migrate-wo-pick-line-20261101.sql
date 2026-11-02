/* ============================================================
   migrate-wo-pick-line-20261101.sql — 生产领料独立成「领料明细」,
                                  提交后才生成材料出库单

   ⚠ 两个账套都要执行(先正式、后测试);幂等。

   ------------------------------------------------------------
   ★ 为什么要改(用户 2026-11-01 口径)
   ------------------------------------------------------------
   「通过『生成工单领料单』生成的应该是**生产领料**里面的明细,
     然后通过扫码领料**提交后才生成材料出库单**。审批是仓管登录平台审批的。」

   改造前:生单直接往 `bd_material_out`(+`bl_material_out`)插一张**材料出库单草稿**,
           扫码只是改它的明细,提交等于审核它。
   后果:材料出库单面板里**还没领料就已经有这张单**,与业务事实不符;
        而且一旦提交就自动审核、立刻扣库存,绕过了仓管的审批。

   改造后分两个阶段:
     ① 生单  → 只写 `wo_pick_doc`(单头)+ **新表 `wo_pick_line`(领料明细)**;
                领料单号先"预留"(仍取 LL 号池),但**不建任何 bd_/bl_ 记录**;
     ② 扫码  → 只改 `wo_pick_line.实领数量`;
     ③ 提交  → 用预留号在 `bd_material_out`/`bl_material_out` 生成正式材料出库单,
                **不审核**(等仓管在 MATERIAL_OUT 面板审批,审批才扣库存)。

   ------------------------------------------------------------
   本脚本做三件事
   ------------------------------------------------------------
   ① 建 `wo_pick_line`(带中文扩展属性,符合数据库规范);
   ② 把现有"未完成"单据的明细从 `bl_material_out` **迁移**进来(需求数量从备注解析);
   ③ 删掉这些单据**提前建出来的**材料出库单草稿(`bl_` → `bd_` → `yj_doc_status`)。
      已完成/已审核的单据一律不动 —— 它们已经是合法的历史出库单。
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @dbNow sysname = DB_NAME();
PRINT N'[库] ' + @dbNow;

/* ---------- ① 建表 ---------- */
IF OBJECT_ID(N'dbo.wo_pick_line', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wo_pick_line (
        id           INT IDENTITY(1,1) NOT NULL,
        单头id       INT              NOT NULL,   -- → wo_pick_doc.id
        行号         NVARCHAR(20)     NOT NULL DEFAULT N'',
        物料编码     NVARCHAR(120)    NOT NULL DEFAULT N'',
        物料名称     NVARCHAR(200)    NULL,
        规格型号     NVARCHAR(500)    NULL,
        计量单位     NVARCHAR(40)     NULL,
        需求数量     DECIMAL(18,4)    NOT NULL DEFAULT 0,   -- BOM单件用量 × 工单数量
        实领数量     DECIMAL(18,4)    NOT NULL DEFAULT 0,   -- 扫码确认后才有值
        仓库         NVARCHAR(120)    NULL,
        仓库编码     NVARCHAR(60)     NULL,
        批号         NVARCHAR(120)    NULL,
        明细备注     NVARCHAR(500)    NULL,
        asp_user1    NVARCHAR(100)    NULL,
        asp_time1    DATETIME2        NULL,
        asp_user2    NVARCHAR(100)    NULL,
        asp_time2    DATETIME2        NULL,
        asp_cancel   CHAR(1)          NULL DEFAULT 'N',
        CONSTRAINT PK_wo_pick_line PRIMARY KEY CLUSTERED (id)
    );
    PRINT N'[建表] wo_pick_line 已创建';
END
ELSE
    PRINT N'[建表] wo_pick_line 已存在,跳过';
GO

/* 索引:按单头取明细是最热的查询 */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_pick_line_doc' AND object_id = OBJECT_ID(N'dbo.wo_pick_line'))
    CREATE INDEX IX_wo_pick_line_doc ON dbo.wo_pick_line (单头id, 行号);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wo_pick_line_mat' AND object_id = OBJECT_ID(N'dbo.wo_pick_line'))
    CREATE INDEX IX_wo_pick_line_mat ON dbo.wo_pick_line (物料编码);
GO

/* ---------- ② 中文注明(数据库规范:新表必须带) ---------- */
DECLARE @tblDesc nvarchar(200) = N'生产领料明细(手机扫码);一行 = 一张领料单的一项用料。需求数量=BOM单件用量×工单数量,实领数量=现场扫码确认后才写。提交后才据此生成材料出库单。';
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                WHERE major_id = OBJECT_ID(N'dbo.wo_pick_line') AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @tblDesc, N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_line';
ELSE
    EXEC sp_updateextendedproperty N'MS_Description', @tblDesc, N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_line';

DECLARE @col TABLE (col sysname, descr nvarchar(300));
INSERT INTO @col (col, descr) VALUES
 (N'单头id',   N'指向 wo_pick_doc.id(这张明细属于哪张领料单)'),
 (N'行号',     N'明细行号,从 1 开始'),
 (N'物料编码', N'领用物料编码'),
 (N'物料名称', N'领用物料名称'),
 (N'规格型号', N'物料规格(BOM 上的写法优先,没有则取存货档案)'),
 (N'计量单位', N'计量单位,取自存货档案(材料出库单必填)'),
 (N'需求数量', N'应领= BOM单件用量 × 工单排产数量,生单时算好,用于扫码预填'),
 (N'实领数量', N'实领= 现场扫码确认后写入;0 表示还没领。领料进度按它算'),
 (N'仓库',     N'领用仓库(按库存最大仓预填)'),
 (N'仓库编码', N'仓库编码'),
 (N'批号',     N'领用批号(先进先出拆批后记录)'),
 (N'明细备注', N'留痕:BOM 单号 + 用量 × 工单 = 需求;扫码后追加批次串');

DECLARE @c sysname, @d nvarchar(300);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, descr FROM @col;
OPEN cur; FETCH NEXT FROM cur INTO @c, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                    WHERE major_id = OBJECT_ID(N'dbo.wo_pick_line') AND minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.wo_pick_line'), @c, 'ColumnId') AND name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'wo_pick_line', N'COLUMN', @c;
    FETCH NEXT FROM cur INTO @c, @d;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[注明] 表与列的中文说明已写入';
GO

/* ---------- ③ 迁移现有"未完成"单据的明细 ----------
   需求数量:从明细备注里解析「需求 N」(备注形如「…= 需求 10)」)。
   ⚠ LIKE/CHARINDEX 都**不能要求左括号紧跟"需求"** —— 实际是「= 需求 10)」。 */
DECLARE @migrated int = 0;

INSERT INTO dbo.wo_pick_line
    (单头id, 行号, 物料编码, 物料名称, 规格型号, 计量单位,
     需求数量, 实领数量, 仓库, 仓库编码, 批号, 明细备注,
     asp_user1, asp_time1, asp_cancel)
SELECT d.id, ISNULL(l.行号, N''), ISNULL(l.材料编码, N''), l.材料名称, l.规格型号, l.计量单位,
       -- 需求:取「需求 」后到最近的「)」之前
       CASE
         WHEN ISNULL(l.明细备注,'') LIKE N'%需求 %' AND ISNUMERIC(
              SUBSTRING(l.明细备注,
                        CHARINDEX(N'需求 ', l.明细备注) + 3,
                        CHARINDEX(N')', l.明细备注, CHARINDEX(N'需求 ', l.明细备注))
                          - CHARINDEX(N'需求 ', l.明细备注) - 3)) = 1
         THEN CAST(SUBSTRING(l.明细备注,
                        CHARINDEX(N'需求 ', l.明细备注) + 3,
                        CHARINDEX(N')', l.明细备注, CHARINDEX(N'需求 ', l.明细备注))
                          - CHARINDEX(N'需求 ', l.明细备注) - 3) AS decimal(18,4))
         ELSE ISNULL(l.数量, 0)
       END,
       ISNULL(l.数量, 0), l.仓库, l.仓库编码, l.批号, l.明细备注,
       N'migration', SYSDATETIME(), 'N'
  FROM dbo.bl_material_out l
  JOIN dbo.bd_material_out h ON h.单据编号 = l.单据编号
  JOIN dbo.wo_pick_doc d ON d.领料单号 = l.单据编号
 WHERE ISNULL(l.asp_cancel,'N') <> 'Y'
   AND d.状态 = N'未完成'
   -- 幂等:该单头已经迁过就不再迁
   AND NOT EXISTS (SELECT 1 FROM dbo.wo_pick_line x WHERE x.单头id = d.id);

SET @migrated = @@ROWCOUNT;
PRINT N'[迁移] 领料明细已入库 ' + CAST(@migrated AS nvarchar(10)) + N' 行';
GO

/* ---------- ④ 删掉这些单据"提前建出来"的材料出库单草稿 ---------- */
DECLARE @outs TABLE (no nvarchar(60) PRIMARY KEY);
INSERT INTO @outs (no)
SELECT DISTINCT h.单据编号
  FROM dbo.bd_material_out h
  JOIN dbo.wo_pick_doc d ON d.领料单号 = h.单据编号
 WHERE d.状态 = N'未完成'
   -- 只删**没审核过**的草稿:审核过的是合法历史单,绝不动
   AND NOT EXISTS (SELECT 1 FROM dbo.yj_doc_status s
                    WHERE s.panel_code = N'MATERIAL_OUT' AND s.doc_no = h.单据编号
                      AND ISNULL(s.shr, N'') <> N'');

DECLARE @blDel int = 0, @bdDel int = 0;
DELETE l FROM dbo.bl_material_out l WHERE l.单据编号 IN (SELECT no FROM @outs);
SET @blDel = @@ROWCOUNT;
DELETE s FROM dbo.yj_doc_status s WHERE s.doc_no IN (SELECT no FROM @outs);
DELETE h FROM dbo.bd_material_out h WHERE h.单据编号 IN (SELECT no FROM @outs);
SET @bdDel = @@ROWCOUNT;

PRINT N'[清理] 已删草稿明细 ' + CAST(@blDel AS nvarchar(10))
    + N' 行 / 草稿单头 ' + CAST(@bdDel AS nvarchar(10)) + N' 张(它们改由 wo_pick_line 承载)';
GO

/* ---------- ⑤ 自检 ---------- */
DECLARE @bad int;
-- 未完成单据不该再有 bd_material_out 记录
SELECT @bad = COUNT(*)
  FROM dbo.bd_material_out h
  JOIN dbo.wo_pick_doc d ON d.领料单号 = h.单据编号
 WHERE d.状态 = N'未完成';
IF @bad > 0
   PRINT N'[WARN] 仍有 ' + CAST(@bad AS nvarchar(10)) + N' 张未完成单据在材料出库单里(可能已审核,已保留)';
ELSE
   PRINT N'[PASS] 未完成单据不再占用材料出库单';

-- 每张未完成单据都该有明细
DECLARE @noLine int;
SELECT @noLine = COUNT(*) FROM dbo.wo_pick_doc d
 WHERE d.状态 = N'未完成'
   AND NOT EXISTS (SELECT 1 FROM dbo.wo_pick_line x WHERE x.单头id = d.id AND ISNULL(x.asp_cancel,'N') <> 'Y');
IF @noLine > 0
   PRINT N'[WARN] 有 ' + CAST(@noLine AS nvarchar(10)) + N' 张未完成单据没有领料明细';
ELSE
   PRINT N'[PASS] 未完成单据均有领料明细';
GO

/* ---------- ⑥ 结果 ---------- */
SELECT N'领料明细行数' AS 项目, CAST(COUNT(*) AS nvarchar(20)) AS 值 FROM dbo.wo_pick_line
UNION ALL
SELECT N'未完成单据数', CAST(COUNT(*) AS nvarchar(20)) FROM dbo.wo_pick_doc WHERE 状态 = N'未完成'
UNION ALL
SELECT N'已完成单据数', CAST(COUNT(*) AS nvarchar(20)) FROM dbo.wo_pick_doc WHERE 状态 = N'已完成';
GO
