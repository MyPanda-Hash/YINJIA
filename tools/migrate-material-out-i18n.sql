-- migrate-material-out-i18n.sql — 材料出库单接口并集新字段的**日语**译名补齐(AGENTS.md 多语言强制规范)
-- ═════════════════════════════════════════════════════════════════════════════════
-- 背景:migrate-material-out-fields.sql 按采购入库(2026-09-16)同款只写了 en 译名,
--   而多语言规范的**判定标准**是「切换到英语/日语后,新功能显示目标语言而非中文」——
--   实测本次 92 个新标签里只有 7 个(部门编码/仓库编码/创建时间/辅助数量/换算率/经手人编码/行号,
--   均为其它面板已有的共享标签)带 ja,其余 85 个切到日语即回落中文 ⇒ 判定不通过。
--   本脚本补齐这 85 条的 ja(人工译名,source='manual';不覆盖任何已有译名)。
--   · 其余 7 个语言(ko/zh-TW/es/fr/de/ru/vi/th)仍由 TranslationService 机翻兜底(source='mt'),
--     与采购入库/销售出库那批并集字段同口径;要人工校对可另开脚本。
-- 幂等:仅当 (scope='field', ref_key=标签, locale='ja') 不存在时插入;复跑插入 0 行。
-- 自检:MATERIAL_OUT 全部字段标签的 ja 覆盖应为 100%(缺 0),且本文件列出的标签必须真实存在。
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
GO
DECLARE @ja TABLE (k nvarchar(200), t nvarchar(400));
INSERT INTO @ja (k, t) VALUES
  (N'auditor_id',            N'監査者ID'),
  (N'bill_type_id',          N'伝票タイプID'),
  (N'creator_id',            N'作成者ID'),
  (N'dept_id',               N'部門ID'),
  (N'emp_id',                N'従業員ID'),
  (N'ERP单号',               N'ERP伝票番号'),
  (N'modifier_id',           N'更新者ID'),
  (N'pick_use_id',           N'出庫用途ID'),
  (N'保质期',                N'品質保持期間'),
  (N'保质期到期日',          N'品質保持期限'),
  (N'保质期类型',            N'品質保持期間タイプ'),
  (N'仓库id',                N'倉庫ID'),
  (N'仓库启用仓位管理',      N'倉庫ロケーション管理有効'),
  (N'仓位id',                N'ロケーションID'),
  (N'仓位编码',              N'ロケーションコード'),
  (N'仓位名称',              N'ロケーション名'),
  (N'产地',                  N'原産地'),
  (N'成本',                  N'原価'),
  (N'创建人',                N'作成者'),
  (N'创建人编码',            N'作成者コード'),
  (N'单据标签',              N'伝票ラベル'),
  (N'单据类型编码',          N'伝票タイプコード'),
  (N'单据类型名称',          N'伝票タイプ名'),
  (N'单据状态_bill_status',  N'伝票ステータス(ERP)'),
  (N'单位id',                N'単位ID'),
  (N'单位编码',              N'単位コード'),
  (N'单位成本',              N'単位原価'),
  (N'辅助单位id',            N'補助単位ID'),
  (N'辅助单位编码',          N'補助単位コード'),
  (N'辅助单位名称',          N'補助単位名'),
  (N'辅助换算系数',          N'補助換算係数'),
  (N'辅助属性1id',           N'補助属性1ID'),
  (N'辅助属性1编码',         N'補助属性1コード'),
  (N'辅助属性1名称',         N'補助属性1名'),
  (N'辅助属性2id',           N'補助属性2ID'),
  (N'辅助属性2编码',         N'補助属性2コード'),
  (N'辅助属性2名称',         N'補助属性2名'),
  (N'辅助属性3id',           N'補助属性3ID'),
  (N'辅助属性3编码',         N'補助属性3コード'),
  (N'辅助属性3名称',         N'辅助属性3名'),
  (N'辅助属性id',            N'補助属性ID'),
  (N'辅助属性编码',          N'補助属性コード'),
  (N'辅助属性名称',          N'補助属性名'),
  (N'换算系数',              N'換算係数'),
  (N'基本单位id',            N'基本単位ID'),
  (N'基本单位编码',          N'基本単位コード'),
  (N'基本单位名称',          N'基本単位名'),
  (N'基本数量',              N'基本数量'),
  (N'库存基本数量',          N'在庫基本数量'),
  (N'库存数量',              N'在庫数量'),
  (N'领料类型',              N'材料出庫タイプ'),
  (N'领料用途编码',          N'出庫用途コード'),
  (N'领料用途名称',          N'出庫用途名'),
  (N'默认浮动数量',          N'既定変動数量'),
  (N'商品id',                N'商品ID'),
  (N'商品是否保质期',        N'品質保持期間対象'),
  (N'商品是否多单位',        N'多単位商品'),
  (N'商品是否辅助属性',      N'補助属性対象'),
  (N'商品是否批次',          N'ロット管理対象'),
  (N'商品是否序列号',        N'シリアル管理対象'),
  (N'审核人_auditor_name',   N'監査者名'),
  (N'审核人编码',            N'監査者コード'),
  (N'审核时间_audit_time',   N'監査日時'),
  (N'生产许可证',            N'生産許可証'),
  (N'是否已转ERP',           N'ERP転送済み'),
  (N'条形码',                N'バーコード'),
  (N'图片',                  N'画像'),
  (N'修改人',                N'更新者'),
  (N'修改人编码',            N'更新者コード'),
  (N'修改时间',              N'更新日時'),
  (N'序列号流转ID',          N'シリアル流通ID'),
  (N'序列号清单',            N'シリアル一覧'),
  (N'有效期至',              N'有効期限'),
  (N'源单编号',              N'起源伝票番号'),
  (N'源单产品分录id',        N'起源製品明細ID'),
  (N'源单分录id',            N'起源明細ID'),
  (N'源单类型id',            N'起源伝票タイプID'),
  (N'源单类型编码',          N'起源伝票タイプコード'),
  (N'源单类型名称',          N'起源伝票タイプ名'),
  (N'源单内部id',            N'起源内部ID'),
  (N'源单日期',              N'起源伝票日付'),
  (N'源单行号',              N'起源行番号'),
  (N'注册证号',              N'登録証番号'),
  (N'转ERP操作人',           N'ERP転送担当者'),
  (N'转ERP时间',             N'ERP転送日時');

-- ① 防呆:清单里的标签必须在 MATERIAL_OUT 真实存在(拼错会静默无效,这里直接报错)
DECLARE @bad nvarchar(400) = (
  SELECT TOP 1 j.k FROM @ja j
  WHERE NOT EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code='MATERIAL_OUT' AND f.col_name = j.k)
);
IF @bad IS NOT NULL RAISERROR(N'[matout-i18n] 清单含非 MATERIAL_OUT 字段标签: %s', 16, 1, @bad);

-- ② 补 ja(仅缺失的;不覆盖已有译名)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', j.k, 'ja', j.t, 'manual'
FROM @ja j
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope='field' AND t.ref_key = j.k AND t.locale='ja');
PRINT N'[matout-i18n] ja 新增: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行(首次 85,复跑 0)';
GO
-- ③ 自检:MATERIAL_OUT 所有字段标签的 ja 覆盖率必须 100%
DECLARE @miss int = (
  SELECT COUNT(*) FROM (SELECT DISTINCT col_name FROM yj_field WHERE panel_code='MATERIAL_OUT') f
  WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                    WHERE t.scope='field' AND t.ref_key = f.col_name AND t.locale='ja')
);
IF @miss <> 0 RAISERROR(N'[matout-i18n] 自检失败:仍有 %d 个字段标签缺 ja 译名(应 0)', 16, 1, @miss);
ELSE PRINT N'[matout-i18n] 自检通过:MATERIAL_OUT 全部字段标签 ja 覆盖 100%';
GO
