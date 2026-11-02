SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#m') IS NOT NULL DROP TABLE #m;
SELECT DISTINCT p.pl_no AS old_no, N'GD-2026-09-' + RIGHT(p.pl_no,4) AS new_no INTO #m FROM dbo.plang p
WHERE ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(p.[完工状态],N'')=N'生产完工'
  AND ISNULL(p.ja,'N') IN (N'T',N'Y')
  AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%')
  AND CAST(p.pl_date AS date)>='2026-09-01' AND CAST(p.pl_date AS date)<'2026-10-01';
GO
SELECT N'plang.pl_no' k, COUNT(*) n FROM dbo.plang p JOIN #m m ON p.pl_no=m.old_no
UNION ALL SELECT N'plang.源工单号', COUNT(*) FROM dbo.plang p JOIN #m m ON p.[源工单号]=m.old_no
UNION ALL SELECT N'plang.根工单号', COUNT(*) FROM dbo.plang p JOIN #m m ON p.[根工单号]=m.old_no
UNION ALL SELECT N'plang_pc.pl_no', COUNT(*) FROM dbo.plang_pc p JOIN #m m ON p.pl_no=m.old_no
UNION ALL SELECT N'scjl.gldh', COUNT(*) FROM dbo.scjl s JOIN #m m ON s.gldh=m.old_no
UNION ALL SELECT N'scjl.tm', COUNT(*) FROM dbo.scjl s JOIN #m m ON s.tm=m.old_no
UNION ALL SELECT N'wo_progress.单据编号', COUNT(*) FROM dbo.wo_progress w JOIN #m m ON w.[单据编号]=m.old_no
UNION ALL SELECT N'qc_first.工单号', COUNT(*) FROM dbo.qc_first_insp_head h JOIN #m m ON h.[工单号]=m.old_no
UNION ALL SELECT N'qc_proc.工单号', COUNT(*) FROM dbo.qc_proc_insp_head h JOIN #m m ON h.[工单号]=m.old_no
UNION ALL SELECT N'qc_asm.工单号', COUNT(*) FROM dbo.qc_asm_insp_head h JOIN #m m ON h.[工单号]=m.old_no
UNION ALL SELECT N'bd_finish_in.加工单号', COUNT(*) FROM dbo.bd_finish_in f JOIN #m m ON f.[加工单号]=m.old_no
UNION ALL SELECT N'bd_finish_in.匹配来源单号', COUNT(*) FROM dbo.bd_finish_in f JOIN #m m ON f.[匹配来源单号]=m.old_no
UNION ALL SELECT N'wo_process_line.工单号', COUNT(*) FROM dbo.wo_process_line l JOIN #m m ON l.[工单号]=m.old_no
UNION ALL SELECT N'wo_mixing_head.工单号', COUNT(*) FROM dbo.wo_mixing_head h JOIN #m m ON h.[工单号]=m.old_no
UNION ALL SELECT N'wo_mixing_detail.工单号', COUNT(*) FROM dbo.wo_mixing_detail d JOIN #m m ON d.[工单号]=m.old_no
UNION ALL SELECT N'wo_mixing_list.工单号', COUNT(*) FROM dbo.wo_mixing_list l JOIN #m m ON l.[工单号]=m.old_no
UNION ALL SELECT N'wo_transfer_log.pl_no', COUNT(*) FROM dbo.wo_transfer_log t JOIN #m m ON t.pl_no=m.old_no
UNION ALL SELECT N'wo_split_log.根工单号', COUNT(*) FROM dbo.wo_split_log s JOIN #m m ON s.[根工单号]=m.old_no
UNION ALL SELECT N'bd_prod_abn.工单号', COUNT(*) FROM dbo.bd_prod_abn a JOIN #m m ON a.[工单号]=m.old_no
UNION ALL SELECT N'inh.工单号', COUNT(*) FROM dbo.inh i JOIN #m m ON i.[工单号]=m.old_no
UNION ALL SELECT N'outh.工单号', COUNT(*) FROM dbo.outh o JOIN #m m ON o.[工单号]=m.old_no
UNION ALL SELECT N'bd_dispatch.加工单号', COUNT(*) FROM dbo.bd_dispatch d JOIN #m m ON d.[加工单号]=m.old_no
UNION ALL SELECT N'bd_material_out.加工单号', COUNT(*) FROM dbo.bd_material_out d JOIN #m m ON d.[加工单号]=m.old_no
UNION ALL SELECT N'bl_material_out.加工单号', COUNT(*) FROM dbo.bl_material_out d JOIN #m m ON d.[加工单号]=m.old_no
UNION ALL SELECT N'bd_manu_order.合同号', COUNT(*) FROM dbo.bd_manu_order d JOIN #m m ON d.[合同号]=m.old_no
UNION ALL SELECT N'bd_manu_order.源工单号', COUNT(*) FROM dbo.bd_manu_order d JOIN #m m ON d.[源工单号]=m.old_no
UNION ALL SELECT N'bl_manu_order.合同号', COUNT(*) FROM dbo.bl_manu_order d JOIN #m m ON d.[合同号]=m.old_no;
GO
