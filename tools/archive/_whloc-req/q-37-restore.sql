SET NOCOUNT ON;
UPDATE bs_wh_loc SET 存储分区=NULL, asp_user1=N'migration' WHERE 仓位编码=N'B4-24-2' AND 存储分区=N'ZZ临时测试区';
SELECT N'还原后该行存储分区(应 空)' AS 项, ISNULL(存储分区,N'(空)') AS 值 FROM bs_wh_loc WHERE 仓位编码=N'B4-24-2';
SELECT N'测试库残留 ZZ临时测试区(应 0)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM bs_wh_loc WHERE 存储分区=N'ZZ临时测试区';
SELECT N'测试库 存储分区种类(应 8)' AS 项, CAST(COUNT(DISTINCT 存储分区) AS nvarchar(6)) AS 值 FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(存储分区,N'')<>N'';
GO