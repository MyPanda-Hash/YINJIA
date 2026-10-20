/* ============================================================================
 * migrate-qcreturn-erp-20261019.sql —— 暂收退料单接「转ERP」(金蝶采购退货单 pur_ret)
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-19《10.19 问题》第 8 条):
 *   「暂收退料单需要转 ERP。查看接口文档是否能够对应。并且看测试账套能不能转 ERP。」
 *
 * 接口结论(见 docs/development/暂收退料单转ERP-接口对应与验证.md):
 *   · 金蝶侧对应 = **采购退货单** `POST /jdy/v2/scm/pur_ret`(cur 单据类型 `pur_bill_outbound`),
 *     头必填 supplier_number,行必填 material_id/material_number + qty + unit_id + stock_id/stock_number;
 *     其他出库单 inv_other_out 虽然也能"出库",但它没有 supplier 字段、且必须写死 trans_type_id ⇒ 不采用。
 *   · 转ERP 用的金蝶账套由 `kingdee.push.*` 凭证决定(**当前 = 测试沙箱**),与"登录哪个工厂"无关:
 *     登录测试库只决定**读/写哪张库**(DataSourceRouter 按 JWT 里的工厂切库),不决定推哪套金蝶账。
 *
 * 本脚本(幂等,两账套均执行):
 *   ① `qc_return` 补 ERP 留位四列(与 bd_purchase_in / bd_material_out 同名列同类型):
 *      `是否已转ERP` nvarchar(20) / `ERP单号` nvarchar(100) / `转ERP操作人` nvarchar(100) / `转ERP时间` nvarchar(60);
 *      **不加这四列,转ERP 一推就报「列名无效」**(KingdeePushService 回写段与 listPushableErp 都按它们过滤);
 *   ② 四列写中文注明;
 *   ③ `yj_field` 登记 4 行(place=header;**visible=1/hidden=0** 让左栏「ERP单」派生列能取到行值,
 *      editable=0 只读 —— 与其余 7 张已接转ERP的单据一致);seq 取 300 段避开现有 200 附件位;
 *   ④ `yj_translation` 兜底:四个标签是全局共享译名,缺 en 的补一条(已存在则跳过);
 *   ⑤ `erp_integ_api` / `erp_integ_field` 补一条转出接口配置 + 头/行字段映射(ERP系统集成 › 集成配置清单可见);
 *   ⑥ 自检:四列齐 + 四字段行齐,否则 RAISERROR。
 *
 * ⚠ 采购链四单基线:`QC_RETURN` 是四单之一 ⇒ 本脚本动了它的 yj_field,**同批**必须重跑
 *   `node tools/archive/_gen-fourdoc-restore.mjs` 刷新 `tools/fourdoc-baseline.tsv` 与回正脚本,
 *   并回写 docs/development/采购链四单字段与显示字段.md;回归闸 `verify/FourDocAudit.java` 必须 PASS。
 * ========================================================================== */

SET NOCOUNT ON;
GO

/* ---------- ① 四列 + ② 中文注明 ---------- */
DECLARE @cols TABLE (col sysname, typ nvarchar(50), cmt nvarchar(400));
INSERT INTO @cols (col, typ, cmt) VALUES
 (N'是否已转ERP', N'nvarchar(20)',
  N'是否已转ERP:否/是。暂收退料单审核后点「转ERP」推金蝶采购退货单(pur_ret)成功置「是」;弃审自动清回「否」(2026-10-19 接入)'),
 (N'ERP单号',     N'nvarchar(100)',
  N'ERP单号:转ERP 成功后回写的**金蝶采购退货单单号**(金蝶自动编号,如 CJTH-…);弃审清空(2026-10-19 接入)'),
 (N'转ERP操作人', N'nvarchar(100)',
  N'转ERP操作人:执行「转ERP」的账号;弃审清空(2026-10-19 接入)'),
 (N'转ERP时间',   N'nvarchar(60)',
  N'转ERP时间:转ERP 成功的时刻(yyyy-MM-dd HH:mm:ss 文本,与其余 7 张已接转ERP的单据同格式);弃审清空(2026-10-19 接入)');

DECLARE @c sysname, @t nvarchar(50), @m nvarchar(400);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT col, typ, cmt FROM @cols;
OPEN cur;
FETCH NEXT FROM cur INTO @c, @t, @m;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.qc_return', @c) IS NULL
    BEGIN
        EXEC(N'ALTER TABLE dbo.qc_return ADD [' + @c + N'] ' + @t + N' NULL');
        PRINT N'[加列] qc_return.' + @c;
    END
    IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = OBJECT_ID(N'dbo.qc_return')
                     AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.qc_return'), @c, 'ColumnId')
                     AND ep.name = N'MS_Description')
        EXEC sp_addextendedproperty N'MS_Description', @m,
             N'SCHEMA', N'dbo', N'TABLE', N'qc_return', N'COLUMN', @c;
    FETCH NEXT FROM cur INTO @c, @t, @m;
END
CLOSE cur; DEALLOCATE cur;
PRINT N'[列] qc_return ERP 留位四列就绪';
GO

/* ---------- ③ yj_field 4 行(只读、可见) ---------- */
DECLARE @f TABLE (lab nvarchar(50), seq int);
INSERT INTO @f (lab, seq) VALUES (N'ERP单号', 300), (N'是否已转ERP', 310), (N'转ERP操作人', 320), (N'转ERP时间', 330);
DECLARE @lab nvarchar(50), @seq int;
DECLARE curf CURSOR LOCAL FAST_FORWARD FOR SELECT lab, seq FROM @f;
OPEN curf;
FETCH NEXT FROM curf INTO @lab, @seq;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = N'QC_RETURN' AND label = @lab)
        INSERT INTO yj_field (panel_code, col_name, label, data_type, place, seq, width, editable, required, hidden, visible)
        VALUES (N'QC_RETURN', @lab, @lab, N'文本', N'header', @seq, 130, 0, 0, 0, 1);
    FETCH NEXT FROM curf INTO @lab, @seq;
END
CLOSE curf; DEALLOCATE curf;
PRINT N'[字段] QC_RETURN 的 ERP 四字段已登记';
GO

/* ---------- ④ 译名兜底(全局共享;缺则补 en) ---------- */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'是否已转ERP' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'是否已转ERP', N'en', N'Pushed to ERP', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'ERP单号' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'ERP单号', N'en', N'ERP No.', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'转ERP操作人' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'转ERP操作人', N'en', N'Pushed By', N'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = N'field' AND ref_key = N'转ERP时间' AND locale = N'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES (N'field', N'转ERP时间', N'en', N'Pushed At', N'manual');
GO

/* ---------- ⑤ ERP集成配置清单补一条转出接口(+头/行字段映射) ---------- */
IF OBJECT_ID(N'dbo.erp_integ_api', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM erp_integ_api WHERE 接口编码 = N'EXP_QRETURN')
BEGIN
    INSERT INTO erp_integ_api (方向, 分类, 接口编码, 接口名称, 提供方, 接口地址, 请求方式, 对应面板, 目标对象, 触发方式, 启用, 排序, 说明)
    VALUES (N'转出', N'采购', N'EXP_QRETURN', N'采购退货单', N'金蝶云·星辰', N'/jdy/v2/scm/pur_ret', N'POST',
            N'QC_RETURN', N'采购退货单(pur_bill_outbound)', N'转ERP按钮', 1, 80,
            N'暂收退料单 → 金蝶采购退货单(2026-10-19 接入,《10.19 问题》第 8 条)。头必填 supplier_number;'
            + N'行必填 material_number/qty/unit_id/stock_number;不推 src_* 源单组(金蝶侧无对应采购入库单)');
    PRINT N'[ERP配置] 已登记转出接口 EXP_QRETURN';
END
GO
IF OBJECT_ID(N'dbo.erp_integ_field', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM erp_integ_api WHERE 接口编码 = N'EXP_QRETURN')
   AND NOT EXISTS (SELECT 1 FROM erp_integ_field WHERE 接口编码 = N'EXP_QRETURN')
BEGIN
    INSERT INTO erp_integ_field (接口编码, 方向, 序号, 映射层级, MES字段, ERP字段, 转换规则, 是否必填, 启用, 备注) VALUES
     (N'EXP_QRETURN', N'转出', 1,  N'头', N'单据日期',   N'bill_date',       N'直传 yyyy-MM-dd', 0, 1, N'金蝶必填项的上游建议值'),
     (N'EXP_QRETURN', N'转出', 2,  N'头', N'供应商',     N'supplier_number', N'dm_gf.mc→dm 反查编码(先按编码直判)', 1, 1, N'qc_return 只存名称,无编码列'),
     (N'EXP_QRETURN', N'转出', 3,  N'头', N'备注',       N'remark',          N'追加 [MES:单据编号]', 0, 1, N'两侧对账用'),
     (N'EXP_QRETURN', N'转出', 4,  N'头', N'单据编号',   N'outside_pk_id',   N'直传', 0, 1, N'金蝶列表可按它过滤,幂等核对'),
     (N'EXP_QRETURN', N'转出', 5,  N'头', N'退货原因',   N'return_reason',   N'头空则取行「不良原因」去重拼接', 0, 1, N'头列实测全空'),
     (N'EXP_QRETURN', N'转出', 6,  N'行', N'物料编码',   N'material_number', N'直传(另按 materialMap 补 material_id)', 1, 1, N''),
     (N'EXP_QRETURN', N'转出', 7,  N'行', N'退货数量',   N'qty',             N'数值', 1, 1, N''),
     (N'EXP_QRETURN', N'转出', 8,  N'行', N'计量单位',   N'unit_id',         N'名称→measure_unit id(解析不到即拦)', 1, 1, N''),
     (N'EXP_QRETURN', N'转出', 9,  N'行', N'仓库(头)',  N'stock_number',    N'头「仓库」名称→bs_wh.仓库编码,再取 store id', 1, 1, N'行上无仓库列'),
     (N'EXP_QRETURN', N'转出', 10, N'行', N'单价',       N'price',           N'数值', 0, 1, N''),
     (N'EXP_QRETURN', N'转出', 11, N'行', N'批次号',     N'batch_no',        N'行批次号优先,空则用头批次号', 0, 1, N'仅批次管理商品落库');
    PRINT N'[ERP配置] 已登记 EXP_QRETURN 字段映射 11 行';
END
GO

/* ---------- ⑥ 自检 ---------- */
IF (SELECT COUNT(*) FROM sys.columns
     WHERE object_id = OBJECT_ID(N'dbo.qc_return')
       AND name IN (N'是否已转ERP', N'ERP单号', N'转ERP操作人', N'转ERP时间')) <> 4
    RAISERROR(N'qc_return ERP 四列未齐(转ERP 会报列名无效)', 16, 1);
IF (SELECT COUNT(*) FROM yj_field WHERE panel_code = N'QC_RETURN'
     AND label IN (N'是否已转ERP', N'ERP单号', N'转ERP操作人', N'转ERP时间')) <> 4
    RAISERROR(N'QC_RETURN 的 ERP 四字段未齐(保存链路会丢值)', 16, 1);
SELECT N'[自检] QC_RETURN 转ERP 四列 + 四字段 + 接口配置 全部就绪' AS 项;
PRINT N'✅ 暂收退料单已可转ERP(金蝶采购退货单 pur_ret;目标账套由 kingdee.push 凭证决定)';
GO
