/* migrate-iface-column-comments-20261017.sql — 给 49 个金蝶接口镜像列补中文注明(体检 03 项)

   【问题】数据库规范体检 03 项:49 列「拼音/英文列名缺 MS_Description」。
   全部集中在采购入库/销售出库两张头的金蝶接口字段上(另有 1 列在采购入库行表):
     bd_purchase_in 27 列 / bd_sale_out 21 列 / bl_purchase_in 1 列

   【这些列是什么】2026-10 对齐金蝶云·星辰接口时按「面板字段 ∪ 接口字段全并集」批量补的镜像列
   (建列见 tools/migrate-inbound-outbound-fields.sql,生成器 tools/archive/_gen-inbound-outbound.mjs)。
   生成器把 _id / _for / edit_pay / attachments 等归为「默认隐藏」(yj_field.hidden=1),
   即**界面不显示、只随同步原样存下来**的接口 ID/金额/附件列。

   【注明口径 —— 按语义逐条写,不臆造】
   含义取自生成器的 LABEL 字典(_gen-inbound-outbound.mjs 第 39-97 行)与同名成对列
   (如 contact_city_id ↔ contact_city_name=联系人市区名称),统一写成:
     「金蝶接口字段 · <中文义>(<列名>;接口同名镜像,界面隐藏,仅随单据同步存储)」
   其中 total_unsettle_amount_for / cur_settle_amount_for 取自 LABEL 的
   total_unsettle_amount=未结算金额、cur_settle_amount=本次结算金额 + _for 后缀(本位币)。

   【幂等】已有 MS_Description 的列一个字都不动;列不存在的环境跳过。两账套均执行。
*/
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

DECLARE @c TABLE (tbl sysname, col sysname, note nvarchar(300));
INSERT INTO @c (tbl, col, note) VALUES
    (N'bd_purchase_in', N'auditor_id', N'金蝶接口字段 · 审核人标识(auditor_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'auditor_number', N'金蝶接口字段 · 审核人编码(auditor_number;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'bill_sp_id', N'金蝶接口字段 · 仓位标识(bill_sp_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'bill_stock_id', N'金蝶接口字段 · 仓库标识(bill_stock_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'contact_city_id', N'金蝶接口字段 · 联系人市区标识(contact_city_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'contact_country_id', N'金蝶接口字段 · 联系人国家标识(contact_country_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'contact_district_id', N'金蝶接口字段 · 联系人区县标识(contact_district_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'contact_province_id', N'金蝶接口字段 · 联系人省份标识(contact_province_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'creator_id', N'金蝶接口字段 · 创建人标识(creator_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'creator_number', N'金蝶接口字段 · 创建人编码(creator_number;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'customer_id', N'金蝶接口字段 · 客户标识(customer_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'delivery_type_id', N'金蝶接口字段 · 交货方式标识(delivery_type_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'dept_id', N'金蝶接口字段 · 部门标识(dept_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'dispatcher_city_id', N'金蝶接口字段 · 发货市区标识(dispatcher_city_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'dispatcher_country_id', N'金蝶接口字段 · 发货国家标识(dispatcher_country_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'dispatcher_district_id', N'金蝶接口字段 · 发货区县标识(dispatcher_district_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'dispatcher_province_id', N'金蝶接口字段 · 发货省份标识(dispatcher_province_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'edit_pay_account_id', N'金蝶接口字段 · 付款账户标识(edit_pay_account_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'edit_pay_account_number', N'金蝶接口字段 · 付款账户编码(edit_pay_account_number;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'edit_pay_type_id', N'金蝶接口字段 · 付款方式标识(edit_pay_type_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'edit_pay_type_number', N'金蝶接口字段 · 付款方式编码(edit_pay_type_number;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'emp_id', N'金蝶接口字段 · 经手人标识(emp_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'modifier_id', N'金蝶接口字段 · 修改人标识(modifier_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'modifier_number', N'金蝶接口字段 · 修改人编码(modifier_number;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'setting_term_id', N'金蝶接口字段 · 结算期限标识(结算方式)(setting_term_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'supplier_id', N'金蝶接口字段 · 供应商标识(supplier_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_purchase_in', N'total_unsettle_amount_for', N'金蝶接口字段 · 未结算金额(本位币)(total_unsettle_amount_for;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'attachments', N'金蝶接口字段 · 附件(金蝶接口原样镜像)(attachments;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'auditor_id', N'金蝶接口字段 · 审核人标识(auditor_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'auditor_number', N'金蝶接口字段 · 审核人编码(auditor_number;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'contact_city_id', N'金蝶接口字段 · 联系人市区标识(contact_city_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'contact_country_id', N'金蝶接口字段 · 联系人国家标识(contact_country_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'contact_district_id', N'金蝶接口字段 · 联系人区县标识(contact_district_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'contact_province_id', N'金蝶接口字段 · 联系人省份标识(contact_province_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'creator_id', N'金蝶接口字段 · 创建人标识(creator_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'creator_number', N'金蝶接口字段 · 创建人编码(creator_number;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'customer_id', N'金蝶接口字段 · 客户标识(customer_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'delivery_type_id', N'金蝶接口字段 · 交货方式标识(delivery_type_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'dept_id', N'金蝶接口字段 · 部门标识(dept_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'dispatcher_city_id', N'金蝶接口字段 · 发货市区标识(dispatcher_city_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'dispatcher_country_id', N'金蝶接口字段 · 发货国家标识(dispatcher_country_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'dispatcher_district_id', N'金蝶接口字段 · 发货区县标识(dispatcher_district_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'dispatcher_province_id', N'金蝶接口字段 · 发货省份标识(dispatcher_province_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'emp_id', N'金蝶接口字段 · 经手人标识(emp_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'f_logistics_id', N'金蝶接口字段 · 物流公司标识(f_logistics_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'modifier_id', N'金蝶接口字段 · 修改人标识(modifier_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'modifier_number', N'金蝶接口字段 · 修改人编码(modifier_number;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bd_sale_out', N'setting_term_id', N'金蝶接口字段 · 结算期限标识(结算方式)(setting_term_id;接口同名镜像,界面隐藏,仅随单据同步存储)'),
    (N'bl_purchase_in', N'cur_settle_amount_for', N'金蝶接口字段 · 本次结算金额(本位币)(cur_settle_amount_for;接口同名镜像,界面隐藏,仅随单据同步存储)');

DECLARE @tbl sysname, @col sysname, @note nvarchar(300), @added int = 0, @skip int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT tbl, col, note FROM @c ORDER BY tbl, col;
OPEN cur;
FETCH NEXT FROM cur INTO @tbl, @col, @note;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF COL_LENGTH(N'dbo.' + @tbl, @col) IS NULL
        SET @skip = @skip + 1;                                  -- 列不存在(换环境):跳过
    ELSE IF EXISTS (SELECT 1 FROM sys.extended_properties ep
                     WHERE ep.major_id = OBJECT_ID(N'dbo.' + @tbl) AND ep.name = N'MS_Description'
                       AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + @tbl), @col, 'ColumnId'))
        SET @skip = @skip + 1;                                  -- 已有注明:一个字都不动
    ELSE
    BEGIN
        EXEC sp_addextendedproperty N'MS_Description', @note, N'SCHEMA', N'dbo',
             N'TABLE', @tbl, N'COLUMN', @col;
        SET @added = @added + 1;
    END
    FETCH NEXT FROM cur INTO @tbl, @col, @note;
END
CLOSE cur; DEALLOCATE cur;
DECLARE @db sysname = DB_NAME();
RAISERROR(N'[OK] %s 补列注明 %d 条,跳过(已有/列不存在) %d 条', 10, 1, @db, @added, @skip);
GO

/* ===== 自检:这 49 列必须都有 MS_Description ===== */
DECLARE @check TABLE (tbl sysname, col sysname);
INSERT INTO @check (tbl, col) SELECT tbl, col FROM (VALUES
    (N'bd_purchase_in', N'auditor_id'),
    (N'bd_purchase_in', N'auditor_number'),
    (N'bd_purchase_in', N'bill_sp_id'),
    (N'bd_purchase_in', N'bill_stock_id'),
    (N'bd_purchase_in', N'contact_city_id'),
    (N'bd_purchase_in', N'contact_country_id'),
    (N'bd_purchase_in', N'contact_district_id'),
    (N'bd_purchase_in', N'contact_province_id'),
    (N'bd_purchase_in', N'creator_id'),
    (N'bd_purchase_in', N'creator_number'),
    (N'bd_purchase_in', N'customer_id'),
    (N'bd_purchase_in', N'delivery_type_id'),
    (N'bd_purchase_in', N'dept_id'),
    (N'bd_purchase_in', N'dispatcher_city_id'),
    (N'bd_purchase_in', N'dispatcher_country_id'),
    (N'bd_purchase_in', N'dispatcher_district_id'),
    (N'bd_purchase_in', N'dispatcher_province_id'),
    (N'bd_purchase_in', N'edit_pay_account_id'),
    (N'bd_purchase_in', N'edit_pay_account_number'),
    (N'bd_purchase_in', N'edit_pay_type_id'),
    (N'bd_purchase_in', N'edit_pay_type_number'),
    (N'bd_purchase_in', N'emp_id'),
    (N'bd_purchase_in', N'modifier_id'),
    (N'bd_purchase_in', N'modifier_number'),
    (N'bd_purchase_in', N'setting_term_id'),
    (N'bd_purchase_in', N'supplier_id'),
    (N'bd_purchase_in', N'total_unsettle_amount_for'),
    (N'bd_sale_out', N'attachments'),
    (N'bd_sale_out', N'auditor_id'),
    (N'bd_sale_out', N'auditor_number'),
    (N'bd_sale_out', N'contact_city_id'),
    (N'bd_sale_out', N'contact_country_id'),
    (N'bd_sale_out', N'contact_district_id'),
    (N'bd_sale_out', N'contact_province_id'),
    (N'bd_sale_out', N'creator_id'),
    (N'bd_sale_out', N'creator_number'),
    (N'bd_sale_out', N'customer_id'),
    (N'bd_sale_out', N'delivery_type_id'),
    (N'bd_sale_out', N'dept_id'),
    (N'bd_sale_out', N'dispatcher_city_id'),
    (N'bd_sale_out', N'dispatcher_country_id'),
    (N'bd_sale_out', N'dispatcher_district_id'),
    (N'bd_sale_out', N'dispatcher_province_id'),
    (N'bd_sale_out', N'emp_id'),
    (N'bd_sale_out', N'f_logistics_id'),
    (N'bd_sale_out', N'modifier_id'),
    (N'bd_sale_out', N'modifier_number'),
    (N'bd_sale_out', N'setting_term_id'),
    (N'bl_purchase_in', N'cur_settle_amount_for')
) AS v(tbl, col);

DECLARE @miss TABLE (tbl sysname, col sysname);
INSERT INTO @miss (tbl, col)
SELECT k.tbl, k.col FROM @check k
 WHERE COL_LENGTH(N'dbo.' + k.tbl, k.col) IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                    WHERE ep.major_id = OBJECT_ID(N'dbo.' + k.tbl) AND ep.name = N'MS_Description'
                      AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID(N'dbo.' + k.tbl), k.col, 'ColumnId'));
IF EXISTS (SELECT 1 FROM @miss)
BEGIN
    DECLARE @msg nvarchar(400) = N'[FAIL] 仍缺注明的列:';
    SELECT @msg = @msg + N' ' + tbl + N'.' + col FROM @miss;
    RAISERROR(@msg, 16, 1);
END
ELSE PRINT N'[OK] 49 列注明齐备';
GO
