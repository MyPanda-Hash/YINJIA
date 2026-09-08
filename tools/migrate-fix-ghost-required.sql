-- migrate-fix-ghost-required.sql — 填写测试审计修正:清除"幽灵必填"
-- RD_PROGRESS 头级"项目名称"required=1 但真实数据在明细行(项目等级|项目名称 主从表),头级永不可填 → 取消必填
SET NOCOUNT ON;
GO
UPDATE yj_field SET [required] = 0
 WHERE [panel_code] = N'RD_PROGRESS' AND [col_name] = N'项目名称' AND [place] = N'header';
GO
PRINT N'RD_PROGRESS 头级项目名称取消幽灵必填';
GO
