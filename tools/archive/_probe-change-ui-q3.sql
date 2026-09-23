SET NOCOUNT ON;
SELECT CAST(ISNULL(effective,'') AS nvarchar(4)) AS eff FROM yj_doc_status WHERE panel_code = N'RD_CHANGE' AND doc_no = N'CHG-2026-09-0020';