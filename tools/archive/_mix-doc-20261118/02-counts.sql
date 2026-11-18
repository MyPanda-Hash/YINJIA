SET NOCOUNT ON;
SELECT COUNT(*) AS mate_rows, COUNT(DISTINCT m_no) AS mate_products FROM dbo.mate;
GO
SET NOCOUNT ON;
SELECT COUNT(*) AS mixing_rows FROM dbo.wo_mixing_list;
GO
SET NOCOUNT ON;
SELECT TOP 3 id, m_no, wzdm2, wzmc2, jldw2, bzl, sl2 FROM dbo.mate ORDER BY id;
GO
SET NOCOUNT ON;
SELECT panel_code, perms, COUNT(*) AS roles FROM dbo.yj_role_panel WHERE panel_code IN (N'MIX_SCAN', N'MOBILE_PICK') GROUP BY panel_code, perms;
GO
SET NOCOUNT ON;
SELECT COUNT(*) AS plang_rows FROM dbo.plang;
