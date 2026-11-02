SET NOCOUNT ON;
-- 回填历史漏标的退料单(业务类型已是「生产退料」但标志为空)
UPDATE dbo.bd_other_in SET 退料标志 = N'生产退料'
 WHERE 退料标志 IS NULL AND 业务类型 = N'生产退料';
SELECT N'回填行数 ' + CAST(@@ROWCOUNT AS nvarchar(10)) k;
GO
SELECT 单据编号, ISNULL(退料标志,'<NULL>') 退料标志 FROM bd_other_in WHERE 业务类型='生产退料' ORDER BY id DESC;
