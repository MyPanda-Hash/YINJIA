/* migrate-stock-detail-panel.sql — 库存报表新增第四张:**库存明细**(`STOCK_DETAIL`),直读结存表 `kucun`
 *
 * 【用户口径 2026-10-15】
 *   ① 「我要用这个 KUCUN 表做库存报表下的库存明细」⇒ 面板 `line_table = kucun`,**不建视图、不 join 档案**
 *      (与休眠的 `STOCK_STATUS`「库存状况」同一形态;另三张报表读的是 `v_stock_*` 视图)。
 *   ② 「现存量 + 累计入库/累计出库(照原样显示)」⇒ 列 = 存货编码·仓库·批号·累计入库量·累计出库量·现存量·更新时间。
 *
 * 【为什么库存现状以 kucun 为准(实测 2026-10-15,详见 tools/archive/_kucun-stock-detail/)】
 *   · 2026-10-14 的金蝶期初导入(2004 行,`asp_user1='期初导入'`)**只写进 kucun、没写流水** ——
 *     当时 `inh` 的期初段(src=0)只剩 1 行 / 10 个单位,流水口径的「库存状况表」902 行合计
 *     `现存量 = -323,341.826`(负!),而 kucun 现存量合计 `+4,287,547.564`;1419 个 (仓库,存货) 键对不上、
 *     其中 717 个键在状况表里根本没有行。⇒ 「现在有多少货」当时只有 kucun 答得出(用户据此拍板直读 kucun)。
 *   · 同日下午**另一条线把期初补进了流水**(commit `eba52b4d`「期初结存补进流水(两账套 1,888 行)」):
 *     现在 `inh` 期初段 = 1889 行 / 4,816,726.896,库存状况表合计转正 `+4,493,375.070`;
 *     但两口径**仍不相等** —— 残差 `205,827.506` 落在 **696 个键**上
 *     (根因是期初回填的批号键与出库行不一致:`kucun` 有 542 行现存量是**负的**,合计 -3,986,989.206,
 *      全部来自期初导入那一批;同一物料的期初挂在无批号/期初批号、出库却打在 PC0000 上)。
 *     ⇒ 本面板读 kucun,与三张流水报表**不保证逐键相等**;两者口径差异属数据面,见留档 README。
 *     该残差是**当时**的实测值,数据面仍在变(另一条线在补),以 `tools/archive/_kucun-stock-detail/` 的
 *     q-01…q-19 与 README 记录的时间点为准。
 *
 * 【列口径(照原样显示,不做换算;此处是唯一能写清的地方)】
 *   · `yl`   现存量   = 应用维护量(审核/弃审同事务加减,`StockLedgerService.applyIn/applyOut`),启动自检核对;
 *     实测 2281 行里 **542 行为负**(合计 -3,986,989.206,全部来自期初导入那批的批号口径错位)——
 *     面板不做任何过滤/修正,原样呈现(要清这批负数是数据面的活,另案)。
 *   · `rkl`/`ckl` 累计入库/累计出库 = 应用写入的 **277 行自洽**(yl = rkl − ckl);
 *     2004 行「期初导入」带的是**金蝶累计值**,与 yl 不平(1888/2281 行不满足 yl = rkl − ckl)
 *     ⇒ 按用户口径照原样显示,**不换算、不隐藏**;读表人须知道这两列对期初行不是同一把尺子。
 *   · `price` 结存单价 = 最近一次入库的**单据单价**(出库不回填、期初导入行为 NULL;仅 277/2281 行有值);
 *     ⚠ 2026-10-15 用户口径「不用显示结存单价」⇒ 本面板**不再注册这一列**(见 migrate-stock-detail-drop-price.sql);
 *   · 金额列**不做**:`kucun.total_je` 全表为 0(遗留零引用列),要金额只能 `单价 × 现存量`,口径另议。
 *   · 粒度 = (物料编码 wzdm, 仓库编码 ckdm, 批号 lot_no):仓库编码 100% 命中 `bs_wh`;
 *     物料编码 2268/2281 命中 `bs_inv`(13 行悬空,属源数据,本面板不掩盖)。
 *
 * 【形态】`mode='flat'` + `pk_col='id'` + `date_col='update_date'`
 *   ⇒ QueryService 走平表取数:`WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY [update_date] DESC, id DESC`
 *   (最近更新的排最前;`kucun` 有 id 主键索引列 `UX_kucun_id`)。查询区 3 个字段:
 *   存货编码/仓库声明为**参照**(INV/WH)⇒ 查询弹窗按名称挑选、过滤按**编码精确等值**
 *   (QueryService.appendDirectFilters:参照字段走 `RTRIM(col) = ?`,避免编码互为子串串行);
 *   列表页列值仍是 kucun 里的编码(不 join 档案就取不到名称,这是「直读 kucun」的已知代价)。
 *
 * 【配套】菜单 `frontend/src/business/menus.js`(库存报表组第 4 项)+ 10 语言词条
 *   (frontend/src/i18n/locales 下的 10 个语言文件)+ 面板/字段译名(yj_translation)+ 各角色授权(yj_role_panel)。
 *   ⚠ 别在这里写 glob(如 locales 目录加星号):T-SQL 的块注释是**可嵌套**的,星号加斜杠会再开一层注释,
 *     整条脚本会以「缺少注释的结尾标记」被拒(2026-10-15 实测踩到)。
 * 幂等:面板/字段/授权/译名逐段判存在,重跑全 no-op。两账套都执行(先正式后测试)。
 */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ═══ ① 面板 ═══ */
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCK_DETAIL')
BEGIN
  INSERT INTO yj_panel (panel_code, panel_name, panel_name_en, category, mode, line_table, head_table, group_col,
                        pk_col, code_col, prefix, date_col, page_size, detail_key, module_group, config, config_at)
  VALUES ('STOCK_DETAIL', N'库存明细', 'Stock Detail', N'报表', 'flat', 'kucun', NULL, NULL,
          'id', NULL, NULL, 'update_date', 50, 'items', N'系统管理', NULL, NULL);
  PRINT N'[OK] yj_panel 已加 STOCK_DETAIL(库存明细,flat → kucun)';
END
ELSE
BEGIN
  UPDATE yj_panel SET panel_name = N'库存明细', panel_name_en = 'Stock Detail', category = N'报表', mode = 'flat',
         line_table = 'kucun', pk_col = 'id', date_col = 'update_date', page_size = 50, detail_key = 'items',
         module_group = N'系统管理'
   WHERE panel_code = 'STOCK_DETAIL';
  PRINT N'[SKIP] yj_panel.STOCK_DETAIL 已存在(已按本脚本口径归位)';
END
GO

/* ═══ ② 字段(7 列;col_name 必须是 kucun 的真实列,否则取数 SQL 直接报「列名无效」) ═══ */
DECLARE @f TABLE (col_name sysname, label nvarchar(50), data_type nvarchar(20), ref_panel varchar(40),
                  ref_field nvarchar(128) NULL, display_field nvarchar(128) NULL, place varchar(40), seq int, width int);
INSERT INTO @f VALUES
  ('wzdm',        N'存货编码',   N'参照',   'INV', N'存货编码', N'存货名称', 'query,detail', 10, 130),
  ('ckdm',        N'仓库',       N'参照',   'WH',  N'仓库编码', N'仓库名称', 'query,detail', 20, 130),
  ('lot_no',      N'批号',       N'文本',   NULL,  NULL,       NULL,       'query,detail', 30, 150),
  ('rkl',         N'累计入库量', N'小数',   NULL,  NULL,       NULL,       'detail',       40, 100),
  ('ckl',         N'累计出库量', N'小数',   NULL,  NULL,       NULL,       'detail',       50, 100),
  ('yl',          N'现存量',     N'小数',   NULL,  NULL,       NULL,       'detail',       60, 100),
  ('update_date', N'更新时间',   N'日期时间', NULL, NULL,       NULL,       'detail',       80, 150);

INSERT INTO yj_field (panel_code, col_name, label, data_type, ref_panel, ref_field, display_field, place, seq, width,
                      editable, required, hidden, visible)
SELECT 'STOCK_DETAIL', f.col_name, f.label, f.data_type, f.ref_panel, f.ref_field, f.display_field, f.place, f.seq, f.width,
       0, 0, 0, 1
FROM @f f
WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = 'STOCK_DETAIL' AND x.col_name = f.col_name);

UPDATE yj_field SET label = f.label, data_type = f.data_type, ref_panel = f.ref_panel, ref_field = f.ref_field,
       display_field = f.display_field, place = f.place, seq = f.seq, width = f.width,
       editable = 0, required = 0, hidden = 0, visible = 1
FROM yj_field j JOIN @f f ON f.col_name = j.col_name
WHERE j.panel_code = 'STOCK_DETAIL';

DECLARE @nf int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL');
PRINT N'[字段] STOCK_DETAIL 字段行 = ' + CAST(@nf AS nvarchar(10)) + N'(应 7)';
GO

/* ═══ ③ 授权:三张库存报表授给全部角色(view,query,export,print),本面板照抄 ═══ */
INSERT INTO yj_role_panel (role_id, panel_code, can_approve, perms)
SELECT r.id, 'STOCK_DETAIL', 'N', 'view,query,export,print'
FROM yj_role r
WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel p WHERE p.role_id = r.id AND p.panel_code = 'STOCK_DETAIL');
DECLARE @ngr int = (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = 'STOCK_DETAIL');
PRINT N'[授权] STOCK_DETAIL 授权角色数 = ' + CAST(@ngr AS nvarchar(10));
GO

/* ═══ ④ 译名(多语言强制规范:面板名 + 8 个字段标签;已有译名的标签按 where not exists 跳过) ═══ */
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.loc, v.txt, 'manual'
FROM (VALUES
  ('panel', N'库存明细', 'en', N'Stock Detail'), ('panel', N'库存明细', 'ja', N'在庫明細'),
  ('panel', N'库存明细', 'ko', N'재고 명세'),      ('panel', N'库存明细', 'zh-TW', N'庫存明細'),
  ('panel', N'库存明细', 'es', N'Detalle de Inventario'), ('panel', N'库存明细', 'fr', N'Détail du Stock'),
  ('panel', N'库存明细', 'de', N'Bestandsdetail'), ('panel', N'库存明细', 'ru', N'Детализация запасов'),
  ('panel', N'库存明细', 'vi', N'Chi tiết tồn kho'), ('panel', N'库存明细', 'th', N'รายละเอียดสต๊อก'),

  ('field', N'存货编码', 'en', N'Item Code'), ('field', N'存货编码', 'ja', N'品目コード'),
  ('field', N'存货编码', 'ko', N'품목 코드'),   ('field', N'存货编码', 'zh-TW', N'存貨編碼'),
  ('field', N'存货编码', 'es', N'Código de artículo'), ('field', N'存货编码', 'fr', N'Code article'),
  ('field', N'存货编码', 'de', N'Artikelcode'), ('field', N'存货编码', 'ru', N'Код номенклатуры'),
  ('field', N'存货编码', 'vi', N'Mã hàng'),     ('field', N'存货编码', 'th', N'รหัสสินค้า'),

  ('field', N'仓库', 'en', N'Warehouse'), ('field', N'仓库', 'ja', N'倉庫'),
  ('field', N'仓库', 'ko', N'창고'),       ('field', N'仓库', 'zh-TW', N'倉庫'),
  ('field', N'仓库', 'es', N'Almacén'),   ('field', N'仓库', 'fr', N'Entrepôt'),
  ('field', N'仓库', 'de', N'Lager'),     ('field', N'仓库', 'ru', N'Склад'),
  ('field', N'仓库', 'vi', N'Kho'),       ('field', N'仓库', 'th', N'คลังสินค้า'),

  ('field', N'批号', 'en', N'Batch No.'), ('field', N'批号', 'ja', N'ロット番号'),
  ('field', N'批号', 'ko', N'배치 번호'),   ('field', N'批号', 'zh-TW', N'批號'),
  ('field', N'批号', 'es', N'N.º de lote'), ('field', N'批号', 'fr', N'N° de lot'),
  ('field', N'批号', 'de', N'Chargennummer'), ('field', N'批号', 'ru', N'Номер партии'),
  ('field', N'批号', 'vi', N'Số lô'),     ('field', N'批号', 'th', N'หมายเลขล็อต'),

  ('field', N'累计入库量', 'en', N'Total Received'), ('field', N'累计入库量', 'ja', N'累計入庫量'),
  ('field', N'累计入库量', 'ko', N'누적 입고량'),      ('field', N'累计入库量', 'zh-TW', N'累計入庫量'),
  ('field', N'累计入库量', 'es', N'Entrada acumulada'), ('field', N'累计入库量', 'fr', N'Entrées cumulées'),
  ('field', N'累计入库量', 'de', N'Gesamtzugang'), ('field', N'累计入库量', 'ru', N'Всего поступило'),
  ('field', N'累计入库量', 'vi', N'Tổng nhập lũy kế'), ('field', N'累计入库量', 'th', N'ยอดรับสะสม'),

  ('field', N'累计出库量', 'en', N'Total Issued'), ('field', N'累计出库量', 'ja', N'累計出庫量'),
  ('field', N'累计出库量', 'ko', N'누적 출고량'),    ('field', N'累计出库量', 'zh-TW', N'累計出庫量'),
  ('field', N'累计出库量', 'es', N'Salida acumulada'), ('field', N'累计出库量', 'fr', N'Sorties cumulées'),
  ('field', N'累计出库量', 'de', N'Gesamtabgang'), ('field', N'累计出库量', 'ru', N'Всего выбыло'),
  ('field', N'累计出库量', 'vi', N'Tổng xuất lũy kế'), ('field', N'累计出库量', 'th', N'ยอดจ่ายสะสม'),

  ('field', N'现存量', 'en', N'On-hand Qty'), ('field', N'现存量', 'ja', N'現在庫数'),
  ('field', N'现存量', 'ko', N'현재고'),       ('field', N'现存量', 'zh-TW', N'現存量'),
  ('field', N'现存量', 'es', N'Cantidad disponible'), ('field', N'现存量', 'fr', N'Quantité en stock'),
  ('field', N'现存量', 'de', N'Lagerbestand'), ('field', N'现存量', 'ru', N'Остаток'),
  ('field', N'现存量', 'vi', N'Tồn kho hiện tại'), ('field', N'现存量', 'th', N'จำนวนคงเหลือ'),

  ('field', N'结存单价', 'en', N'Balance Unit Price'), ('field', N'结存单价', 'ja', N'残高単価'),
  ('field', N'结存单价', 'ko', N'잔액 단가'),          ('field', N'结存单价', 'zh-TW', N'結存單價'),
  ('field', N'结存单价', 'es', N'Precio unitario de saldo'), ('field', N'结存单价', 'fr', N'Prix unitaire du solde'),
  ('field', N'结存单价', 'de', N'Saldopreis'), ('field', N'结存单价', 'ru', N'Цена остатка'),
  ('field', N'结存单价', 'vi', N'Đơn giá tồn'), ('field', N'结存单价', 'th', N'ราคาต่อหน่วยคงเหลือ'),

  ('field', N'更新时间', 'en', N'Updated At'), ('field', N'更新时间', 'ja', N'更新日時'),
  ('field', N'更新时间', 'ko', N'갱신 일시'),    ('field', N'更新时间', 'zh-TW', N'更新時間'),
  ('field', N'更新时间', 'es', N'Actualizado el'), ('field', N'更新时间', 'fr', N'Mis à jour le'),
  ('field', N'更新时间', 'de', N'Aktualisiert am'), ('field', N'更新时间', 'ru', N'Обновлено'),
  ('field', N'更新时间', 'vi', N'Cập nhật lúc'), ('field', N'更新时间', 'th', N'อัปเดตเมื่อ')
) AS v(scope, ref_key, loc, txt)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.loc);
PRINT N'[译名] 库存明细/现存量/结存单价/更新时间 等已补齐(已有语言跳过)';
GO

/* ═══ 自检 ═══ */
DECLARE @bad int = 0;
-- ① 面板就位且指向 kucun
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'STOCK_DETAIL' AND mode = 'flat'
                 AND line_table = 'kucun' AND pk_col = 'id' AND date_col = 'update_date' AND page_size = 50)
  SET @bad = @bad + 1;
-- ② 字段 8 行,且 col_name 都必须是 kucun 的真实列(否则取数 SQL 报「列名无效」)
DECLARE @n int = (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL');
IF @n <> 7 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM yj_field f WHERE f.panel_code = 'STOCK_DETAIL'
             AND NOT EXISTS (SELECT 1 FROM sys.columns c
                             WHERE c.object_id = OBJECT_ID(N'dbo.kucun') AND c.name = f.col_name))
  SET @bad = @bad + 1;
-- ③ 查询区/明细列齐备(存货编码·仓库·批号 进查询区;5 个数值/日期列进明细)
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND place LIKE '%query%') <> 3 SET @bad = @bad + 1;
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'STOCK_DETAIL' AND place LIKE '%detail%') <> 7 SET @bad = @bad + 1;
-- ④ 授权:每个角色一行
IF (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = 'STOCK_DETAIL') <> (SELECT COUNT(*) FROM yj_role)
  SET @bad = @bad + 1;
-- ⑤ 译名:面板名 + 8 个标签,各 ≥10 语言
IF (SELECT COUNT(*) FROM yj_translation WHERE scope = 'panel' AND ref_key = N'库存明细') < 10 SET @bad = @bad + 1;
IF EXISTS (SELECT 1 FROM (VALUES (N'存货编码'),(N'仓库'),(N'批号'),(N'累计入库量'),(N'累计出库量'),
                                (N'现存量'),(N'更新时间')) AS l(lab)
           WHERE (SELECT COUNT(*) FROM yj_translation t WHERE t.scope = 'field' AND t.ref_key = l.lab) < 10)
  SET @bad = @bad + 1;

DECLARE @dbn sysname = DB_NAME();
DECLARE @rows int = (SELECT COUNT(*) FROM kucun);
DECLARE @nrole int = (SELECT COUNT(*) FROM yj_role);
DECLARE @ngrant int = (SELECT COUNT(*) FROM yj_role_panel WHERE panel_code = 'STOCK_DETAIL');
RAISERROR(N'[自检] %s:STOCK_DETAIL 字段 %d 行(应 7)/授权 %d 行(应 %d)/kucun 源表 %d 行;不符项 %d 条',
          10, 1, @dbn, @n, @ngrant, @nrole, @rows, @bad);
IF @bad = 0
  RAISERROR(N'[OK] 库存明细面板(STOCK_DETAIL)已就位:flat 直读 kucun + 7 列 + 角色授权 + 10 语言译名', 10, 1);
ELSE
  RAISERROR(N'[FAIL] STOCK_DETAIL 自检未过(见上一行数字)', 16, 1);
GO
