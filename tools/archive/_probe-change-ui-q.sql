SET NOCOUNT ON;
SELECT 单据状态, 编号 FROM (SELECT N'?' AS 单据状态, N'?' AS 编号) x;
SELECT (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code=N'RD_CHANGE' AND form_no=N'CHG-2026-09-0020' AND action='SIGNOFF' AND result='PENDING') AS p, N'CHG-2026-09-0020' AS no;