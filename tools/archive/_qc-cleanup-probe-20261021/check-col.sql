SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_return_detail') AND c.name LIKE N'%送检%';
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('qc_return') AND c.name LIKE N'%送检%';
GO
