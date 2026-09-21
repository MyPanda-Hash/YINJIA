/* =============================================================================
   特采申请单(QC_TC)「最终处理结果」字典补齐第三值「管控使用」
   —— 与纸质表 YJ-QR-60 原图(三个勾选框)一致,并与新面板 QC_TC_IN 对齐

   背景(2026-09-21 实测 HSDZ_MES):
     YJ-QR-60 特采申请单原图「二．最终处理结果」印的是三个勾选框:
     正常使用 / 管控使用 / 挑选使用。而 QC_TC 这一行(seq=170)的 dict_sql 只有两值,
     漏了「管控使用」;前端版式 docSheetConfigs.js 的 QC_TC 也只配了两值。
     前端已随本提交同步改为三值,本迁移负责把库内字典对齐 —— 否则查询弹窗的下拉
     仍然只出两值,与纸面不符。

   口径:
     · 只改 QC_TC 这一行的 dict_sql,不动 data_type / place / 其它字段。
     · 新面板 QC_TC_IN 建表时字典就是三值(migrate-qc-tc-in.sql),本迁移不涉及。
     · 存量单据若已存过「管控使用」,改前因不在字典里而显示为空,改后正常显示。

   自检:末尾 SELECT 应输出 1 行、字典含「管控使用」;重复执行不改变结果(幂等)。
   ============================================================================= */
SET NOCOUNT ON;
GO

UPDATE yj_field
   SET dict_sql = N'SELECT v FROM (VALUES (N''正常使用''),(N''管控使用''),(N''挑选使用'')) AS t(v)'
 WHERE panel_code = N'QC_TC'
   AND col_name = N'最终处理结果'
   AND ISNULL(dict_sql, N'') <> N'SELECT v FROM (VALUES (N''正常使用''),(N''管控使用''),(N''挑选使用'')) AS t(v)';
GO

-- 自检
SELECT N'QC_TC.最终处理结果' AS 项, dict_sql AS 字典
FROM yj_field WHERE panel_code = N'QC_TC' AND col_name = N'最终处理结果';
GO
