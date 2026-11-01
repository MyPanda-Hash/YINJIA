/* 只删 UI 验证页建的那张卡(让「建卡」步骤可重复跑);API 冒烟那张保留给列表/追溯页用 */
SET NOCOUNT ON;
DELETE FROM dbo.wo_proc_card_detail WHERE 卡号 = N'LZK-GD-2026-09-0049-1';
GO
DELETE FROM dbo.wo_proc_card_head WHERE 卡号 = N'LZK-GD-2026-09-0049-1';
GO
SELECT N'剩余卡' AS 项, 卡号 AS 值 FROM dbo.wo_proc_card_head;
GO
