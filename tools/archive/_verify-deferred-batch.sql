SET NOCOUNT ON;
SELECT DB_NAME() AS db_name;
SELECT COUNT(*) AS pre_completion_batch_rows FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([完工状态],N'')<>N'生产完工' AND ISNULL([批次号],N'')<>N'';
SELECT COUNT(*) AS completed_rows_without_batch FROM plang WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([完工状态],N'')=N'生产完工' AND ISNULL([批次号],N'')=N'';
SELECT COUNT(*) AS pc_mirror_batch_mismatch FROM plang p JOIN plang_pc pc ON pc.plang_id=p.id AND ISNULL(pc.asp_cancel,'N')<>'Y' WHERE ISNULL(p.[批次号],N'')<>ISNULL(pc.[批次号],N'');
