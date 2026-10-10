-- migrate-sale-out-order-cols-20261015.sql
-- 销售出库单带出「销售订单号 / 销售订单行号」(2026-10-15 用户口径:
--   「销售出库单是从销售订单生单或者选单过来的,要带有销售订单号和销售订单行号」)
--
-- ── 根因:物理列早就有,是**元数据没登记/被隐藏**,不是数据链没带 ──
--   实测(HSDZ_MES):
--     · bd_sale_out.销售订单号   物理列存在、**yj_field 里完全没登记** ⇒ 界面永远不会显示
--     · bd_sale_out.来源单号/来源单据/匹配来源单号 同样存在、同样未登记
--     · bl_sale_out.源单编号/源单行号 存在且已登记,但 hidden=1 / visible=0 ⇒ 看不到
--   数据现状:表头 4 列 0/54 全空(从没有过真源单);明细源单编号 11/123、源单行号 15/123 有值,
--   但那批带 XQ-/ZL- 前缀的是**历史导入**,不是 SO_ORDER 链路(SO_ORDER 单号形如 ZXL-20260916-01);
--   form_flow_link 里 SO_ORDER→SALE_OUT 链路数为 0 ⇒ 该链路尚未真正跑过,本迁移只把显示与
--   映射补齐,历史单不回填(用户口径:只做新单)。
--
-- ── 对齐基线:采购链(已跑通的同款需求)──
--   PURCHASE_IN.header.采购订单号   seq=160 hidden=0 visible=1
--   PURCHASE_IN.detail.源单行号     seq=290 hidden=0 visible=1 **label=采购订单行号**
--   ⇒ 销售侧同构:表头「销售订单号」可见;明细列名仍是物理列 源单行号,
--     但 **label 用「销售订单行号」**(与采购链的「采购订单行号」写法对称,用户看到的词也就对了)。
--
-- ⚠ 明细两列不重复登记:源单编号/源单行号两行已存在(仅 hidden 位为 1),本脚本**只改可见性/标签/seq**,
--   不插新行 —— 插新行会造出「同一物理列两条登记」,体检项 07(完全重复的字段登记行)会报错。
-- 幂等:INSERT 走 NOT EXISTS、UPDATE 带窄条件;两账套均执行(先 HSDZ_MES 正式,后 HSDZ_MES_TEST 测试)。
SET NOCOUNT ON;
GO

-- ═══ ① 表头「销售订单号」:未登记 ⇒ 登记为可见(物理列 bd_sale_out.销售订单号 已存在)═══
-- 位置:紧随「单据编号」(seq=20)之后取 30,与销售域「先单号、后订单号」的读法一致;
--       原 seq=30 区间无占用(实测该面板 header 已用 10/20/40/50/60...)。
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'SALE_OUT' AND col_name = N'销售订单号')
  INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field,
                        place, seq, width, editable, required, hidden, visible)
  VALUES (N'SALE_OUT', N'销售订单号', N'销售订单号', N'文本', NULL, NULL, NULL, NULL,
          N'query,header', 30, 150, 1, 0, 0, 1);
ELSE
  UPDATE yj_field SET hidden = 0, visible = 1
  WHERE panel_code = N'SALE_OUT' AND col_name = N'销售订单号' AND (hidden = 1 OR visible = 0);
PRINT N'[OK] SALE_OUT 表头「销售订单号」已登记可见,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

-- ═══ ② 明细「销售订单行号」:物理列=源单行号,只把 label 正名 + 放开可见 ═══
-- label 改「销售订单行号」后,**带入映射要以它为落点**(见 PanelConfigService 的 FLOW_DETAIL_SYNONYMS)。
-- seq 取 55/56:SALE_OUT 明细 50 段(存货等)与 60 段之间有空档,且**避开 290**
--   (该面板 290/300 已被隐藏列 仓库编码/仓库启用仓位管理 占用;采购链那侧 290 是空的才用 290,
--    这里照抄会撞位、同 seq 的先后就变成靠 id 决胜负,读起来不稳)。
UPDATE yj_field
SET label = N'销售订单行号', hidden = 0, visible = 1, seq = 56, width = 120
WHERE panel_code = N'SALE_OUT' AND col_name = N'源单行号';
PRINT N'[OK] SALE_OUT 明细「销售订单行号」(物理列 源单行号)已可见,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

-- ═══ ③ 明细「源单编号」:同批放开可见(订单号落表头,单号-行号配对可追溯;与采购链同款)═══
-- 采购链该列 PURCHASE_IN.detail.源单编号 现为 hidden=1 —— 但那是「订单号已在表头」的同款情形,
-- 用户本次明确要「销售订单号**和**行号」两列,故销售侧把明细来源单号一并放开,便于核对来自哪张单。
UPDATE yj_field
SET hidden = 0, visible = 1, seq = 55, width = 140
WHERE panel_code = N'SALE_OUT' AND col_name = N'源单编号';
PRINT N'[OK] SALE_OUT 明细「源单编号」已可见,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

-- ═══ ④ 多语言:新增标签「销售订单行号」补 en(AGENTS.md 强制;其它语言由机翻兜底)═══
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'销售订单行号' AND locale = N'en')
  INSERT INTO yj_translation (scope, ref_key, locale, text, source)
  VALUES (N'field', N'销售订单行号', N'en', N'Sales Order Line No.', N'manual');
PRINT N'[OK] 译名「销售订单行号」en 已登记,影响 ' + CAST(@@ROWCOUNT AS nvarchar(4)) + N' 行';
GO

-- ═══ ⑤ 自检(RAISERROR severity 10 = 信息级,不中断;DbSync 会打印)═══
DECLARE @h int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'SALE_OUT' AND col_name = N'销售订单号'
                     AND place LIKE N'%header%' AND hidden = 0 AND visible = 1);
DECLARE @l int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'SALE_OUT' AND col_name = N'源单行号'
                     AND label = N'销售订单行号' AND hidden = 0 AND visible = 1);
DECLARE @d int = (SELECT COUNT(*) FROM yj_field
                   WHERE panel_code = N'SALE_OUT' AND col_name = N'源单编号'
                     AND hidden = 0 AND visible = 1);
-- 物理列必须仍在(本脚本只改元数据,不碰 DDL)
DECLARE @c1 int = COL_LENGTH(N'bd_sale_out', N'销售订单号');
DECLARE @c2 int = COL_LENGTH(N'bl_sale_out', N'源单行号');
IF @h = 1 AND @l = 1 AND @d = 1 AND @c1 IS NOT NULL AND @c2 IS NOT NULL
  RAISERROR(N'SELFCHECK OK  销售订单号 表头可见(1) / 销售订单行号 明细可见(1) / 源单编号 可见(1) / 物理列俱在', 10, 1) WITH NOWAIT;
ELSE
  RAISERROR(N'SELFCHECK FAIL 表头=%d 行号=%d 源单编号=%d 物理列1=%d 物理列2=%d', 16, 1, @h, @l, @d, @c1, @c2);
GO

PRINT N'migrate-sale-out-order-cols-20261015 完成';
GO
