SET NOCOUNT ON;
PRINT N'=== 清理前 ===';
SELECT 仓位编码, ISNULL(大区,N'(空)') AS 大区, asp_user2, asp_time2 FROM bs_wh_loc WHERE 仓位编码 IN (N'B4-24-1',N'B4-24-2');
PRINT N'=== 清理:把试填的大区还原为空(B仓 按口径不分区) ===';
UPDATE bs_wh_loc SET 大区 = NULL WHERE 仓位编码 IN (N'B4-24-1',N'B4-24-2') AND 大区 IN (N'3123',N'12123');
PRINT N'  还原 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
PRINT N'=== 清理后核对 ===';
SELECT N'异常大区/分区 残留(应 0)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM bs_wh_loc
  WHERE 仓库编码 IN (N'CK-A',N'CP-02',N'CK-C',N'CK-D')
    AND ( (ISNULL(大区,N'')<>N'' AND 大区 NOT IN (N'原料区',N'辅料及配件区',N'成品仓区'))
       OR (ISNULL(存储分区,N'')<>N'' AND 存储分区 NOT IN (N'炭粉区',N'胶粉区',N'货架区',N'纸箱区',N'端盖区',N'PP棉区',N'无纺布区',N'网套区',N'标签区')) )
UNION ALL SELECT N'仓位总数(应 679)', CAST(COUNT(*) AS nvarchar(6)) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'B仓 有大区的行(应 0)', CAST(COUNT(*) AS nvarchar(6)) FROM bs_wh_loc WHERE 仓库编码=N'CP-02' AND ISNULL(大区,N'')<>N'';
GO