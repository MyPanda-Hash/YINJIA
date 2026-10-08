-- 一次性回退脚本(不登记迁移链,用完即归档 tools/archive/):
-- 把 仓位面板 的「大区 / 存储分区」从下拉框改回纯文本,清掉字典SQL,并抹掉 zone-dict 迁移的链记录。
-- 用户口径 2026-10-08:「不行把这个下拉框的实现去除掉,回退到没有下拉框的时候」。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

PRINT N'=== 1. 回退 yj_field:下拉框 → 文本,字典SQL 清空 ===';
UPDATE yj_field SET data_type = N'文本', dict_sql = NULL
WHERE panel_code = N'WHLOC' AND label IN (N'大区', N'存储分区');
PRINT N'  影响 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';
GO

PRINT N'=== 2. 列注明回退(去掉"改下拉框"那句) ===';
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bs_wh_loc')
           AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_wh_loc'), N'存储分区', 'ColumnId') AND name=N'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
    N'存储分区(用途标签 = 《仓库总体规划》列头:炭粉区/胶粉区/货架区/纸箱区/端盖区/PP棉区/无纺布区/网套区/标签区;按(区码,排号区间)切,不是物理层级;2026-10-08 由「库区」正名)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'存储分区';
IF EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id=OBJECT_ID(N'dbo.bs_wh_loc')
           AND minor_id=COLUMNPROPERTY(OBJECT_ID(N'dbo.bs_wh_loc'), N'大区', 'ColumnId') AND name=N'MS_Description')
  EXEC sp_updateextendedproperty N'MS_Description',
    N'大区(仓内的大功能分区,层次:厂区 > 仓 > 大区 > 分区;取值 原料区/辅料及配件区/成品仓区;B仓/C仓 不分区故为空;2026-10-08 按用户口径新增)',
    N'SCHEMA', N'dbo', N'TABLE', N'bs_wh_loc', N'COLUMN', N'大区';
GO

PRINT N'=== 3. 抹掉 zone-dict 迁移的链记录(该迁移文件即将删除,不留链上孤儿) ===';
DELETE FROM yj_schema_log WHERE script_name LIKE N'%zone-dict%';
PRINT N'  删除链记录 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 条';
GO

PRINT N'=== 4. 核对 ===';
SELECT label AS 字段, data_type AS 类型,
       CASE WHEN ISNULL(dict_sql,N'')=N'' THEN N'✓ 无字典' ELSE N'★ 仍有字典' END AS 字典
FROM yj_field WHERE panel_code=N'WHLOC' AND label IN (N'大区',N'存储分区');
SELECT N'zone-dict 链记录残留(应 0)' AS 项, CAST(COUNT(*) AS nvarchar(6)) AS 值 FROM yj_schema_log WHERE script_name LIKE N'%zone-dict%'
UNION ALL SELECT N'WHLOC 下拉框字段数(应 0)', CAST(COUNT(*) AS nvarchar(6)) FROM yj_field WHERE panel_code=N'WHLOC' AND data_type=N'下拉框'
UNION ALL SELECT N'仓位数据未动(应 679)', CAST(COUNT(*) AS nvarchar(6)) FROM bs_wh_loc WHERE ISNULL(asp_cancel,'N')<>'Y';
GO
PRINT N'回退完成';
GO
