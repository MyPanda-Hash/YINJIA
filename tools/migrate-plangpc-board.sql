/* ============================================================
   migrate-plangpc-board.sql — 2026-09-27 工单排产看板切 plang_pc
   ------------------------------------------------------------
   用户拍板:工单排产(WorkOrderBoard:骨架 linesSummary/按线明细 scheduled/
   调线 reassign)数据源由 bd_manu_order 切参考库排产表 plang_pc;
   快速排产「排入产线」同步落 plang_pc 薄记录(排产字段),看板读 plang_pc×plang
   (排产字段取 pc,数量/状态/打印等活数据取 plang)。
   本脚本:① plang_pc.pl_no 扩宽 nvarchar(14字符)→28(容纳 MO-yyyy-MM-xxxx)
          ② plang_pc.lb 扩宽 2→10 字符(排产班组名)
          ③ plang_pc 加 批次号 nvarchar(12)(与 plang 同口径)
          ④ 回填:plang 中已排产(scx 非空)未结案行 → 插入 plang_pc 薄记录(幂等)
   幂等可重跑。 ============================================================ */
SET NOCOUNT ON;
GO
IF EXISTS (SELECT 1 FROM sys.columns c
           WHERE c.object_id = OBJECT_ID(N'dbo.plang_pc') AND c.name = N'pl_no' AND c.max_length < 56)
    ALTER TABLE dbo.plang_pc ALTER COLUMN pl_no nvarchar(28) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns c
           WHERE c.object_id = OBJECT_ID(N'dbo.plang_pc') AND c.name = N'lb' AND c.max_length < 20)
    ALTER TABLE dbo.plang_pc ALTER COLUMN lb nvarchar(10) NULL;
IF COL_LENGTH(N'dbo.plang_pc', N'批次号') IS NULL
    ALTER TABLE dbo.plang_pc ADD [批次号] nvarchar(12) NULL;
GO
IF COL_LENGTH(N'dbo.plang_pc', N'批次号') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.plang_pc')
                 AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.plang_pc'), N'批次号', 'ColumnId')
                 AND ep.name = N'MS_Description')
        EXEC sp_updateextendedproperty N'MS_Description', N'批次号(与 plang.批次号 同口径:转单日期 yyyyMMdd,同日多次转单 -2/-3)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'批次号';
    ELSE
        EXEC sp_addextendedproperty N'MS_Description', N'批次号(与 plang.批次号 同口径:转单日期 yyyyMMdd,同日多次转单 -2/-3)',
            N'SCHEMA', N'dbo', N'TABLE', N'plang_pc', N'COLUMN', N'批次号';
END
GO
-- 回填:plang 已排产行 → plang_pc 薄记录(幂等:不存在才插)
INSERT INTO plang_pc (comm, pl_no, pl_xc, pl_date, scx, pl_man, lb, st_date, cp_date, jh_date,
                      od_no, od_xc, ja, asp_cancel, asp_user1, asp_time1, [批次号])
SELECT p.comm, p.pl_no, p.pl_xc, p.pl_date, p.scx, p.pl_man, p.lb, p.st_date, p.cp_date, NULL,
       p.od_no, p.od_xc, p.ja, N'N', N'回填', GETDATE(), p.[批次号]
FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.scx,N'') <> N''
  AND ISNULL(p.ja,'N') NOT IN ('T','Y')
  AND NOT EXISTS (SELECT 1 FROM dbo.plang_pc pc
                  WHERE pc.comm = p.comm AND pc.pl_no = p.pl_no AND pc.pl_xc = p.pl_xc
                    AND ISNULL(pc.[批次号],N'') = ISNULL(p.[批次号],N''));
GO
PRINT N'plang_pc 工单排产就绪(扩宽+批次号+回填,幂等)';
GO
