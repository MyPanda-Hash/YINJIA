SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.bs_inv') AND (c.name LIKE N'%检验%' OR c.name LIKE N'%类别%');
SELECT ISNULL(来料检验, N'(空)') AS 来料检验, COUNT(*) AS 物料数 FROM dbo.bs_inv GROUP BY 来料检验;
