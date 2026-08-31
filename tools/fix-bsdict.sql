USE HSDZ_MES;
GO
IF COL_LENGTH('bs_dict','asp_cancel') IS NULL
  ALTER TABLE bs_dict ADD asp_cancel char(1) NULL DEFAULT 'N';
GO
UPDATE bs_dict SET asp_cancel = 'N' WHERE asp_cancel IS NULL;
GO
SELECT COUNT(*) AS ok FROM bs_dict WHERE ISNULL(asp_cancel,'N') <> 'Y';
GO
