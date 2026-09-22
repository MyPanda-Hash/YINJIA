-- migrate-rd-approval-remark-field.sql — 立项申请表右侧「备注」区登记为可填字段(2026-09-22)
--
-- 背景:设计「立项申请表.xlsx」右侧一列是 F5 = 「备注」标签 + F6:G15 合并填写区;
--   实现此前只画装饰虚线(docSheetConfigs 的 deco → .as-deco),而 rd_approval.[备注]
--   (nvarchar(1000))这一列**一直存在却从未登记 yj_field** ⇒ 界面上不可填、也不入库。
--   2026-09-22 版式改为 remark 列(DocSheet 渲染文本域绑 head['备注']),本脚本登记该字段。
--
-- 译名:yj_translation 里「备注」的 scope='field'/'ui' 已有 10 语言(实测),无需新增。
-- 幂等:COL_LENGTH / NOT EXISTS 守卫,可重复执行。
SET NOCOUNT ON;
IF DB_NAME() = N'master' USE HSDZ_MES;   -- 仅在未选定库时切正式库(选定测试库/克隆库时不得被切走)
GO

-- §1 列缺失则补(克隆库/全新库可能没有;正式库实测为 nvarchar(1000) NULL)
IF COL_LENGTH('rd_approval', N'备注') IS NULL
  ALTER TABLE rd_approval ADD [备注] nvarchar(1000) NULL;
GO

-- §2 字段登记(header;seq 165 = 排在 项目等级 160 之后)
INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
SELECT N'RD_APPROVAL', N'备注', N'备注', N'文本', N'header', 165, 250, 1, 0, 0, 1
WHERE NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'RD_APPROVAL' AND col_name = N'备注');
GO

-- §3 自检(三项都应为 1)
SELECT N'列存在' AS k, CASE WHEN COL_LENGTH('rd_approval', N'备注') IS NOT NULL THEN 1 ELSE 0 END AS ok
UNION ALL SELECT N'字段已登记', CASE WHEN EXISTS (SELECT 1 FROM yj_field
           WHERE panel_code = N'RD_APPROVAL' AND col_name = N'备注') THEN 1 ELSE 0 END
UNION ALL SELECT N'译名(en)', CASE WHEN EXISTS (SELECT 1 FROM yj_translation
           WHERE ref_key = N'备注' AND locale = 'en') THEN 1 ELSE 0 END;
GO
