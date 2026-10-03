-- migrate-rd-change-kind-2026-09-30.sql
-- 产品变更申请单加「变更类型」(严格变更 / 快捷变更) —— 幂等,两个账套都要执行
SET NOCOUNT ON;
GO

/* ═══════════════════════════════════════════════════════════════════════════
   需求原文(《产品开发系统需求汇总.xlsx》sheet「变更」底部两行):
     **严格变更** = 按上述流程
     **快捷变更** = 冯总审批
   (上面那六步图:① 发起人发起变更 ② 填写变更原因及上传相关数据 ③ 填写需修改文件及处理方案
    ④ 分发给文件负责人修改 ⑤ 审核人审批 ⑥ 受控关闭变更流程)

   现状(动手前实测):**零实现** —— 全仓 git grep「严格变更/快捷变更」0 命中,
   全库 yj_field 里也没有承载它的字段;`rd_change_head` 唯一沾边的分类是「性质」,
   字典是 变更/新增(说的是"这次是改还是加",不是"走哪条流程")。

   做法:加「变更类型」字段,**走备用列池的 备用1**(零 DDL,依
   docs/design/动态字段扩展-备用列池-V1.0.md;rd_change_head 有 备用1..20)。
   两档语义与后端落点:
     · 严格变更 —— 按六步走;会签是这条链上的多部门确认,勾「需会签」即可发起(submitSignoff)。
     · 快捷变更 —— 冯总(审核人)审批即可,**禁止提交会签**(ButtonService.submitSignoff 明确拒绝),
       直接「提交审批」。
   存量单兜底:已有变更单当年走的都是含会签的流程 ⇒ 一律补「严格变更」,不改其历史行为。
   ═══════════════════════════════════════════════════════════════════════════ */

-- ① 字段登记(place=header;纸面要显示,故 hidden=0)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_CHANGE' AND col_name = N'备用1')
BEGIN
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                        display_field, place, seq, width, editable, required, hidden, visible)
  VALUES (N'RD_CHANGE', N'备用1', N'变更类型', N'下拉框',
          N'SELECT v FROM (VALUES (N''严格变更''),(N''快捷变更'')) AS t(v)',
          NULL, NULL, NULL, N'header', 36, 100, 1, 0, 0, 1);
  PRINT N'[OK] RD_CHANGE 登记「变更类型」(备用1,下拉 严格变更/快捷变更)';
END
ELSE PRINT N'[SKIP] RD_CHANGE.备用1 已登记';
GO

-- ② 列级中文注明
IF COL_LENGTH('dbo.rd_change_head', N'备用1') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.extended_properties ep
              WHERE ep.major_id = OBJECT_ID(N'dbo.rd_change_head')
                AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.rd_change_head'), N'备用1', 'ColumnId')
                AND ep.name = N'MS_Description')
    EXEC sp_updateextendedproperty N'MS_Description', N'变更类型(原备用列池成员 备用1;2026-09-30 起承载:严格变更=按六步流程含会签 / 快捷变更=冯总审批即可、禁止提交会签。需求《产品开发系统需求汇总》sheet「变更」)',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_change_head', N'COLUMN', N'备用1';
  ELSE
    EXEC sp_addextendedproperty N'MS_Description', N'变更类型(原备用列池成员 备用1;2026-09-30 起承载:严格变更=按六步流程含会签 / 快捷变更=冯总审批即可、禁止提交会签。需求《产品开发系统需求汇总》sheet「变更」)',
         N'SCHEMA', N'dbo', N'TABLE', N'rd_change_head', N'COLUMN', N'备用1';
END
GO

-- ③ 存量单兜底:补「严格变更」(它们当年走的都是含会签的老流程)
UPDATE rd_change_head SET 备用1 = N'严格变更'
 WHERE ISNULL(备用1, N'') = N'' AND ISNULL(asp_cancel, 'N') <> 'Y';
PRINT N'[OK] 存量变更单补「严格变更」,影响 ' + CAST(@@ROWCOUNT AS nvarchar(6)) + N' 行';
GO

-- ④ 自检
DECLARE @f int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'RD_CHANGE' AND col_name = N'备用1' AND label = N'变更类型');
DECLARE @c int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.rd_change_head') AND name = N'备用1');
DECLARE @blank int = (SELECT COUNT(*) FROM rd_change_head WHERE ISNULL(备用1, N'') = N'' AND ISNULL(asp_cancel,'N') <> 'Y');
IF @f = 1 AND @c = 1 AND @blank = 0
  PRINT N'[OK] 自检通过:字段 1、物理列 1、存量空值 0';
ELSE
  PRINT N'[WARN] 自检异常:字段 ' + CAST(@f AS nvarchar(3)) + N'、列 ' + CAST(@c AS nvarchar(3)) + N'、空值 ' + CAST(@blank AS nvarchar(5));
GO
