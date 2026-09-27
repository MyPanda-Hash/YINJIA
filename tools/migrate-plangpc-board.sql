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
-- legacy 老行批次号同步(2026-09-27 补:plang_pc 原始 8 月老行批次号为 NULL,而 plang 侧批次号
-- 已按 pl_date 回填(如 20260826)→ 两侧行键不一致,看板 JOIN 匹配不上老行。同步之,幂等。)
UPDATE pc SET pc.[批次号] = p.[批次号]
FROM dbo.plang_pc pc
JOIN dbo.plang p ON p.comm = pc.comm AND p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc
  AND ISNULL(p.asp_cancel,'N') <> 'Y'
WHERE pc.[批次号] IS NULL AND p.[批次号] IS NOT NULL;
GO
-- legacy 老行镜像进 plang(2026-09-27 补②:原始 plang_pc 的 GD 老行在 plang 无对应行,
-- 看板 INNER JOIN plang 取活数据时被整行滤掉。把 plang_pc 存量行镜像 INSERT 进 plang,
-- 批次号=pl_date(与 plang 老行回填口径一致),幂等:同(工单号,行号)已有任何 plang 行则跳过。)
INSERT INTO plang (comm, pl_no, pl_xc, pl_date, khdm, dm, mc, gg, gg2, jldw,
                   pl_sl, pl_sl2, xq_sl, rk_sl, yl, dj, jine, cp_date, st_date, cp_date2,
                   rk_no, bz, ja, od_no, od_xc, lot_no, color, siz, ll_no, wb_no, lb, mjlx,
                   BomId, ll_no2, remark, MoDId, llxz, cgrkdh, lldh, djlx, zl,
                   asp_user1, asp_time1, asp_cancel, [批次号])
SELECT pc.comm, pc.pl_no, pc.pl_xc, pc.pl_date, pc.khdm, pc.dm, pc.mc, pc.gg, pc.gg2, pc.jldw,
       pc.pl_sl, pc.pl_sl2, pc.xq_sl, pc.rk_sl, pc.yl, pc.dj, pc.jine, pc.cp_date, pc.st_date, pc.cp_date2,
       pc.rk_no, pc.bz, pc.ja, pc.od_no, pc.od_xc, pc.lot_no, pc.color, pc.siz, pc.ll_no, pc.wb_no, pc.lb, pc.mjlx,
       pc.BomId, pc.ll_no2, pc.remark, pc.MoDId, pc.llxz, pc.cgrkdh, pc.lldh, pc.djlx, pc.zl,
       pc.asp_user1, pc.asp_time1, N'N', CONVERT(varchar(8), pc.pl_date, 112)
FROM dbo.plang_pc pc
WHERE ISNULL(pc.asp_cancel,'N') <> 'Y'
  AND NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.pl_no = pc.pl_no AND p.pl_xc = pc.pl_xc);
GO
-- 双侧批次号兜底(pc 侧 NULL→pl_date;此后与镜像行一致)
UPDATE dbo.plang_pc SET [批次号] = CONVERT(varchar(8), pl_date, 112)
WHERE [批次号] IS NULL AND pl_date IS NOT NULL;
GO
PRINT N'plang_pc 工单排产就绪(扩宽+批次号+回填+老行同步+老行镜像,幂等)';
GO
