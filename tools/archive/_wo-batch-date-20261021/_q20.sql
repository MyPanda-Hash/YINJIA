SET NOCOUNT ON;
SELECT N'scjl' t, COUNT(*) n FROM dbo.scjl WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'plang_pc', COUNT(*) FROM dbo.plang_pc WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'wo_progress', COUNT(*) FROM dbo.wo_progress WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'qc_first_insp_head', COUNT(*) FROM dbo.qc_first_insp_head WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'qc_proc_insp_head', COUNT(*) FROM dbo.qc_proc_insp_head WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'qc_asm_insp_head', COUNT(*) FROM dbo.qc_asm_insp_head WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'bd_finish_in', COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'bl_finish_in', COUNT(*) FROM dbo.bl_finish_in WHERE ISNULL([批号],N'')=N'20261014'
UNION ALL SELECT N'plang', COUNT(*) FROM dbo.plang WHERE ISNULL([批次号],N'')=N'20261014'
UNION ALL SELECT N'bd_prod_abn', COUNT(*) FROM dbo.bd_prod_abn WHERE ISNULL([批次号],N'')=N'20261014';
GO
-- plang 里 20261014 的行,有多少是 closed 目标
SELECT SUM(CASE WHEN ISNULL(p.[完工状态],N'')=N'生产完工' AND ISNULL(p.asp_cancel,'N')<>'Y'
                 AND ISNULL(p.ja,'N') IN (N'T',N'Y')
                 AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
                THEN 1 ELSE 0 END) 已结案目标,
       SUM(CASE WHEN NOT (ISNULL(p.[完工状态],N'')=N'生产完工' AND ISNULL(p.asp_cancel,'N')<>'Y'
                 AND ISNULL(p.ja,'N') IN (N'T',N'Y')
                 AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'))
                THEN 1 ELSE 0 END) 其它,
       COUNT(*) 合计
FROM dbo.plang p WHERE ISNULL(p.[批次号],N'')=N'20261014';
GO
-- 其它(非目标)20261014 行示例
SELECT TOP 10 pl_no, pl_xc, ISNULL([完工状态],N'') 完工状态, ISNULL(ja,N'') ja, pl_sl, rk_sl,
       CONVERT(varchar(10),pl_date,120) 单据日期
FROM dbo.plang WHERE ISNULL([批次号],N'')=N'20261014'
  AND NOT (ISNULL([完工状态],N'')=N'生产完工' AND ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(ja,'N') IN (N'T',N'Y')
           AND ((ISNULL(pl_sl,0)>0 AND ISNULL(rk_sl,0)>=ISNULL(pl_sl,0)) OR pl_no LIKE N'GD2608%'));
GO
