-- migrate-gfda-restore-fields.sql — GFDA 供应商档案补注册 9 个原始字段(42 口径对齐)
-- 背景:cleanup-base-panels.sql 旧版被重跑删尽 GFDA 的 yj_field 行(2026-09-16 事故),
--       链上 kingdee 脚本按 NOT EXISTS 仅自愈金蝶口径字段,setup-db.sql 原始 9 字段
--       (dm/mc/addr/tel/ywman/sui_no/bank/bank_no/bz)无人补回 → 面板 33 字段,
--       而迁移链从零重放终态为 42。本脚本补注册,使库与链重放一致。
-- 显隐:税号(sui_no)当前 23 行数据全空,按 hide-empty-fields 治理口径默认隐藏,
--       金蝶同步回填后用户可在表头调整勾选恢复;其余 8 个可见(均有数据)。
-- 译名:9 个中文标签(供应商编码/供应商名称/地址/电话/业务员/税号/开户行/银行账号/备注)
--       均已有全局共享词条(9 语言,yj_translation scope='field'),无需新增。
-- 幂等:字段已存在自动跳过,可重跑。
SET NOCOUNT ON;
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='dm')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'dm', N'供应商编码', N'文本', N'detail', 1, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='mc')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'mc', N'供应商名称', N'文本', N'detail', 2, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='addr')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'addr', N'地址', N'文本', N'detail', 4, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='tel')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'tel', N'电话', N'文本', N'detail', 5, 130, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='ywman')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'ywman', N'业务员', N'文本', N'detail', 6, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='sui_no')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'sui_no', N'税号', N'文本', N'detail', 7, 140, 1, 0, 1, 0);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='bank')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'bank', N'开户行', N'文本', N'detail', 8, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='bank_no')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'bank_no', N'银行账号', N'文本', N'detail', 9, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='GFDA' AND col_name='bz')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
    VALUES ('GFDA', 'bz', N'备注', N'文本', N'detail', 11, 220, 1, 0, 0, 1);
GO
-- 自检:GFDA 字段总数应为 42
SELECT COUNT(*) AS gfda_field_count FROM yj_field WHERE panel_code = 'GFDA';
GO
PRINT N'migrate-gfda-restore-fields 完成';
GO
