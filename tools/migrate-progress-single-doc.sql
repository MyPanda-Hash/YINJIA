/* ============================================================
   migrate-progress-single-doc.sql
   ------------------------------------------------------------
   把「项目进度查询」(RD_PROGRESS) 改成**单单据面板**并重置数据:

   1. yj_panel.config 写入 {"singleDoc":true}
      后端 PanelConfigService 读到后会给该面板输出 metadata.singleDoc=true,
      前端(PanelxList 的 singleDocMode 分支)随之隐藏「新增单据」等入口 ——
      全部项目都放进同一张进度单据的明细里。
      保留 mode='doc',所以草稿/已审核/归档的状态机不变。

   2. 数据重置(用户确认可清):
      · 只保留一张进度单据(单据编号最大的那张),其余单据行/明细/状态行删除;
      · 保留单的明细清空 —— 后续由「实施计划保存/审核/阶段完成」自动导入,或调
        callButton('RD_PROGRESS','同步进度') 手动全量回灌;
      · 保留单状态重置为草稿,便于继续编辑。

   幂等:config 用条件 UPDATE;数据部分以 @keep 为基准,重复执行无副作用。
   ============================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

-- ① 单单据标记
UPDATE yj_panel
   SET config = N'{"singleDoc":true}'
 WHERE panel_code = 'RD_PROGRESS'
   AND (config IS NULL OR CONVERT(nvarchar(max), config) NOT LIKE N'%singleDoc%');
DECLARE @cfg nvarchar(max);
SELECT @cfg = config FROM yj_panel WHERE panel_code = 'RD_PROGRESS';   -- PRINT 里不能直接放子查询
PRINT N'  RD_PROGRESS config = ' + ISNULL(@cfg, N'(null)');

-- ② 只留一张单据
DECLARE @keep nvarchar(50);
SELECT @keep = MAX(单据编号) FROM rd_progress;   -- T-SQL 不允许 DECLARE @x = (SELECT ...)
IF @keep IS NULL
BEGIN
    PRINT N'  [跳过] 当前没有进度单据,无需重置数据';
END
ELSE
BEGIN
    DECLARE @n int;
    DELETE FROM rd_progress_detail WHERE 单据编号 <> @keep;  SET @n = @@ROWCOUNT; PRINT N'  删除多余单据的明细 ' + CAST(@n AS nvarchar(10)) + N' 行';
    DELETE FROM rd_progress       WHERE 单据编号 <> @keep;  SET @n = @@ROWCOUNT; PRINT N'  删除多余单据 ' + CAST(@n AS nvarchar(10)) + N' 张';
    DELETE FROM yj_doc_status WHERE panel_code = 'RD_PROGRESS' AND doc_no <> @keep;
    DELETE FROM rd_progress_detail WHERE 单据编号 = @keep;  SET @n = @@ROWCOUNT; PRINT N'  清空保留单的明细 ' + CAST(@n AS nvarchar(10)) + N' 行';

    -- 保留单重置为草稿(可编辑)
    MERGE yj_doc_status AS t USING (VALUES ('RD_PROGRESS', @keep)) AS s(panel_code, doc_no)
       ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no
    WHEN MATCHED THEN UPDATE SET archived = NULL, archived_at = NULL, canceled = 'N', pending = 'N',
                                 saved = 'N', shr = NULL, shsj = NULL, deleting = 'N', modify_state = NULL,
                                 update_at = GETDATE()
    WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, saved, update_at)
                          VALUES ('RD_PROGRESS', @keep, 'N', 'N', GETDATE());
    PRINT N'  保留单据 ' + @keep + N',已重置为草稿';
END
GO

SELECT '面板配置' AS k, panel_code, CONVERT(nvarchar(200), config) AS v FROM yj_panel WHERE panel_code = 'RD_PROGRESS'
UNION ALL SELECT '单据', 单据编号, N'' FROM rd_progress
UNION ALL SELECT '明细行数', CAST(COUNT(*) AS nvarchar(10)), N'' FROM rd_progress_detail;
GO
