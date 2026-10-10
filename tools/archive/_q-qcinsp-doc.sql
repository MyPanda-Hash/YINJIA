-- _q-qcinsp-doc.sql — 取一张来料检验单单号(多行显示改动的阴性对照面板,2026-10-15)
SET NOCOUNT ON;
SELECT TOP 3 [单据编号], [单据状态] FROM dbo.qc_insp WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC;
