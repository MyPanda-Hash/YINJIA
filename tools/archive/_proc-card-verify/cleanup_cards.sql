/* 造数清理:物理删除验证期间建的流程卡(头 + 工序行 + 该面板的照片登记行),把两张卡表清回 0 行。
   ⚠ 只删带本验证标记的卡(工单行 1168 / 119 建的两张 LZK- 卡,验证前两张卡表均为 0 行);
      若将来正式库已有真实卡,请按 卡号 LIKE 'LZK-GD-2026-10-0223-1%' / '%GD-2026-09-0049-1%' 收窄。 */
SET NOCOUNT ON;
PRINT N'==== cleanup @' + DB_NAME() + N' ====';

SELECT N'清理前 卡头行数' AS 项, COUNT(*) AS 值 FROM dbo.wo_proc_card_head
UNION ALL SELECT N'清理前 工序行数', COUNT(*) FROM dbo.wo_proc_card_detail
UNION ALL SELECT N'清理前 PROC_FLOW_CARD 照片行数', COUNT(*) FROM dbo.yj_attachment WHERE panel_code = N'PROC_FLOW_CARD';
GO

/* 照片行(验证期间上传的都已在界面上删掉,这里兜底清一次) */
DELETE FROM dbo.yj_attachment WHERE panel_code = N'PROC_FLOW_CARD';
GO
DELETE d FROM dbo.wo_proc_card_detail d
 WHERE d.卡号 IN (SELECT h.卡号 FROM dbo.wo_proc_card_head h WHERE h.工单行id IN (1168, 119));
GO
DELETE FROM dbo.wo_proc_card_head WHERE 工单行id IN (1168, 119);
GO

SELECT N'清理后 卡头行数(应为 0)' AS 项, COUNT(*) AS 值 FROM dbo.wo_proc_card_head
UNION ALL SELECT N'清理后 工序行数(应为 0)', COUNT(*) FROM dbo.wo_proc_card_detail
UNION ALL SELECT N'清理后 PROC_FLOW_CARD 照片行数(应为 0)', COUNT(*) FROM dbo.yj_attachment WHERE panel_code = N'PROC_FLOW_CARD'
UNION ALL SELECT N'残留 卡号(应为空)', COUNT(*) FROM dbo.wo_proc_card_head WHERE 卡号 LIKE N'LZK-%';
GO
