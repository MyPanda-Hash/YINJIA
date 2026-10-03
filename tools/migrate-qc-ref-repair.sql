/* ============================================================
   migrate-qc-ref-repair.sql — 送料暂收单/来料检验单 参照源回正

   事故(2026-09-24 起,2026-10-03 修复):
     migrate-sl-supplier-ref.sql 的行内注释吞掉了同行 label/place 筛选条件,
     迁移链按内容哈希重放该脚本后,把 QC_RECV(送料暂收单)与 QC_INSP(来料检验单)
     **每一行字段**的 ref_panel/ref_field/display_field 都刷成了 GFDA(供应商)。
     表现:点开 物料编码/业务员/部门/仓库/单位/暂收单号 弹出的都是供应商列表,
     且 buildRefMap 会按供应商档案把 供应商名称/供应商编码 带回本字段。

   修复口径:
     `tools/migrate-sl-supplier-ref.sql` 已还原筛选条件并加行数守卫(根因);
     本脚本把**被写坏的 20 处参照源**按**污染前快照**逐字段回正。

   取值依据(不靠语义猜):
     · 快照库 HSDZ_MES_RESTORE(2026-09-23 13:23 由 C:\SQLBackup\HSDZ_MES-for-test.bak 还原,
       早于 09-24 事故)逐字段比对,19 处命中;
     · 「QC_INSP.暂收单号」快照原值 ref_field=单据编号 取不到值
       —— QC_RECV 的返回行键实测是 label「单号」(queryFormDataList?panelCode=QC_RECV),
       「单据编号」只是物理列名 ⇒ 本次一并改为 单号(display=单号)。
     比对清单见 tools/archive/_RefDiff.java 产出 tools/archive/_refdiff.out。

   范围:只动「参照源」三列(ref_panel/ref_field/display_field),
        不改 data_type / label / seq / place / 可见性 ⇒ 字段名与显示顺序零变化。
   幂等可重跑(先比对再写,已正确则 0 行)。
   ============================================================ */
SET NOCOUNT ON;
GO

DECLARE @fix TABLE (
    panel_code    varchar(40)   NOT NULL,
    label         nvarchar(120) NOT NULL,
    place_like    varchar(20)   NULL,   -- NULL = 表头/明细位置不限
    ref_panel     varchar(40)   NOT NULL,
    ref_field     sysname       NOT NULL,
    display_field sysname       NOT NULL
);

INSERT INTO @fix (panel_code, label, place_like, ref_panel, ref_field, display_field) VALUES
-- ── 送料暂收单 QC_RECV(9 处) ──
('QC_RECV', N'物料编码',   '%detail%', 'INV',      N'存货编码',     N'存货名称'),
('QC_RECV', N'物料名称',   '%detail%', 'INV',      N'存货名称',     N'存货名称'),
('QC_RECV', N'业务员',     '%header%', 'EMP',      N'员工名称',     N'员工名称'),
('QC_RECV', N'采购单号',   '%detail%', 'PU_ORDER', N'单据编号',     N'单据编号'),
('QC_RECV', N'订单号',     '%detail%', 'SO_ORDER', N'单据编号',     N'单据编号'),
('QC_RECV', N'部门',       NULL,       'DEPT',     N'部门名称',     N'部门名称'),
('QC_RECV', N'仓库',       '%header%', 'WH',       N'仓库名称',     N'仓库名称'),
('QC_RECV', N'审核人',     '%header%', 'EMP',      N'员工名称',     N'员工名称'),
('QC_RECV', N'品质复核人', '%detail%', 'EMP',      N'员工名称',     N'员工名称'),
-- ── 来料检验单 QC_INSP(10 处) ──
('QC_INSP', N'物料编码',   '%detail%', 'INV',      N'存货编码',     N'存货名称'),
('QC_INSP', N'物料名称',   '%detail%', 'INV',      N'存货名称',     N'存货名称'),
('QC_INSP', N'业务员',     '%header%', 'EMP',      N'员工名称',     N'员工名称'),
('QC_INSP', N'暂收单号',   '%header%', 'QC_RECV',  N'单号',         N'单号'),
('QC_INSP', N'单位',       '%detail%', 'UOM',      N'计量单位名称', N'计量单位名称'),
('QC_INSP', N'计量单位',   '%detail%', 'UOM',      N'计量单位名称', N'计量单位名称'),
('QC_INSP', N'检验员',     '%header%', 'EMP',      N'员工名称',     N'员工名称'),
('QC_INSP', N'检验方案',   '%header%', 'QC_PLAN',  N'方案名称',     N'方案名称'),
('QC_INSP', N'部门',       '%detail%', 'DEPT',     N'部门名称',     N'部门名称'),
('QC_INSP', N'审核人',     '%header%', 'EMP',      N'员工名称',     N'员工名称');

UPDATE f
   SET f.ref_panel     = x.ref_panel,
       f.ref_field     = x.ref_field,
       f.display_field = x.display_field
  FROM yj_field f
  JOIN @fix x
    ON x.panel_code = f.panel_code
   AND x.label      = f.label
   AND (x.place_like IS NULL OR f.place LIKE x.place_like)
 WHERE f.data_type = N'参照'
   AND (ISNULL(f.ref_panel, '')     <> x.ref_panel
     OR ISNULL(f.ref_field, '')     <> x.ref_field
     OR ISNULL(f.display_field, '') <> x.display_field);

PRINT N'migrate-qc-ref-repair:参照源回正 ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

-- ── 自检①:期望表里每一行都应已落位(命中 0 行 = 该字段缺失或已正确) ──
SELECT N'仍未落位的期望项(应为 0)' AS 检查, x.panel_code, x.label, x.place_like, x.ref_panel, x.ref_field
FROM @fix x
WHERE NOT EXISTS (
    SELECT 1 FROM yj_field f
     WHERE f.panel_code = x.panel_code AND f.label = x.label
       AND (x.place_like IS NULL OR f.place LIKE x.place_like)
       AND f.data_type = N'参照'
       AND f.ref_panel = x.ref_panel AND f.ref_field = x.ref_field AND f.display_field = x.display_field);
GO

-- ── 自检②:越界污染残留(非供应商语义却指 GFDA,应为 0) ──
SELECT N'越界污染残留(应为 0)' AS 检查, panel_code, place, seq, label, ref_panel, ref_field
FROM yj_field
WHERE panel_code IN ('QC_RECV', 'QC_INSP', 'SL_RECV')
  AND data_type = N'参照'
  AND ref_panel = 'GFDA'
  AND label NOT LIKE N'%供应商%'
ORDER BY panel_code, place, seq;
GO

PRINT N'migrate-qc-ref-repair 完成(两个账套均需执行)';
GO
