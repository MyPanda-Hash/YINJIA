-- migrate-fix-all-english-and-visibility.sql — 全面板:英文标签/id字段 统一处理 + 显隐重设计
SET NOCOUNT ON;

-- ══ 1) 纯英文列名 sp_rename ══
DECLARE @ren TABLE(old nvarchar(100), new nvarchar(100), tbl nvarchar(50));
INSERT INTO @ren VALUES
('customer_id',N'客户id','bd_purchase_in'),('contact_country_id',N'联系人国家id','bd_purchase_in'),
('contact_province_id',N'联系人省份id','bd_purchase_in'),('contact_city_id',N'联系人市区id','bd_purchase_in'),
('contact_district_id',N'联系人区县id','bd_purchase_in'),('edit_pay_type_id',N'付款方式id','bd_purchase_in'),
('edit_pay_account_id',N'付款账户id','bd_purchase_in'),('delivery_type_id',N'交货方式id','bd_purchase_in'),
('dispatcher_country_id',N'发货国家id','bd_purchase_in'),('dispatcher_province_id',N'发货省份id','bd_purchase_in'),
('dispatcher_city_id',N'发货市区id','bd_purchase_in'),('dispatcher_district_id',N'发货区县id','bd_purchase_in'),
('bill_stock_id',N'仓库id','bd_purchase_in'),('bill_sp_id',N'仓位id','bd_purchase_in'),
('setting_term_id',N'结算期限id','bd_purchase_in'),('creator_id',N'创建人id','bd_purchase_in'),
('modifier_id',N'修改人id','bd_purchase_in'),('auditor_id',N'审核人id','bd_purchase_in'),
('dept_id',N'部门id','bd_purchase_in'),('supplier_id',N'供应商id','bd_purchase_in'),
('emp_id',N'经手人id','bd_purchase_in'),('currency_id',N'币种id','bd_purchase_in'),
('setting_term_id',N'结算期限id','bd_sale_out'),('dispatcher_province_id',N'发货省份id','bd_sale_out'),
('dispatcher_city_id',N'发货市区id','bd_sale_out'),('dispatcher_district_id',N'发货区县id','bd_sale_out'),
('f_logistics_id',N'物流公司id','bd_sale_out'),('contact_country_id',N'联系人国家id','bd_sale_out'),
('contact_province_id',N'联系人省份id','bd_sale_out'),('contact_city_id',N'联系人市区id','bd_sale_out'),
('contact_district_id',N'联系人区县id','bd_sale_out'),('delivery_type_id',N'交货方式id','bd_sale_out'),
('dept_id',N'部门id','bd_sale_out'),('creator_id',N'创建人id','bd_sale_out'),
('modifier_id',N'修改人id','bd_sale_out'),('auditor_id',N'审核人id','bd_sale_out'),
('dispatcher_country_id',N'发货国家id','bd_sale_out'),('customer_id',N'客户id','bd_sale_out'),
('emp_id',N'经手人id','bd_sale_out'),('currency_id',N'币种id','bd_sale_out');
DECLARE @o nvarchar(100), @n nvarchar(100), @t nvarchar(50);
DECLARE rc CURSOR LOCAL FAST_FORWARD FOR SELECT old, new, tbl FROM @ren;
OPEN rc;
FETCH NEXT FROM rc INTO @o, @n, @t;
WHILE @@FETCH_STATUS = 0 BEGIN
  -- 2026-09-23 合并守卫:目标中文列已存在(本地库当年直接建中文列,未走改名路径)时跳过——
  -- sp_rename 撞已存在目标列会报「列名在 COLUMN 子句中重复」;英文原列留作无害遗留。
  -- 守卫对改名过的库(源列已不存在)同样幂等。
  DECLARE @sql nvarchar(max) = N'IF COL_LENGTH(''dbo.' + @t + ''', ''' + @o + ''') IS NOT NULL AND COL_LENGTH(''dbo.' + @t + ''', ''' + @n + ''') IS NULL EXEC sp_rename ''dbo.' + @t + '.' + @o + ''', N''' + @n + ''', ''COLUMN'';';
  EXEC(@sql);
  UPDATE yj_field SET col_name = @n, label = @n WHERE panel_code IN ('PURCHASE_IN','SALE_OUT') AND col_name = @o;
  -- 幂等守卫:目标词条已存在(先前链上已建同中文键)时跳过改名,防 UPDATE 撞 uq_translation
  UPDATE yj_translation SET ref_key = @n WHERE scope = 'field' AND ref_key = @o
    AND NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = @n);
  FETCH NEXT FROM rc INTO @o, @n, @t;
END
CLOSE rc; DEALLOCATE rc;

-- ══ 2) 全面板:所有 id 类字段统一隐藏 ══
UPDATE yj_field SET hidden=1, visible=0
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT','KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
  AND (col_name LIKE '%id' OR col_name LIKE '%ID' OR col_name LIKE '%-id'
    OR col_name LIKE '%[_]id%'
    OR col_name IN (N'图片url','kf_period','is_show_aux_barcode','parent_name','group_id','QQ'));

-- ══ 3) 长标签清理 ══
UPDATE yj_field SET label=N'入库状态' WHERE panel_code='PU_ORDER' AND label LIKE N'入库状态%';
UPDATE yj_field SET label=col_name WHERE panel_code IN ('SO_ORDER','PU_ORDER') AND col_name IN ('delivery_type_id','delivery_type_number','kf_period');

GO
SELECT panel_code, COUNT(*) AS 总,
  SUM(CASE WHEN ISNULL(hidden,0)=0 AND ISNULL(visible,1)=1 THEN 1 ELSE 0 END) AS 显示
FROM yj_field
WHERE panel_code IN ('SO_ORDER','PU_ORDER','PURCHASE_IN','SALE_OUT','KHDA','GFDA','INV','EMP','DEPT','WH','UOM','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR')
GROUP BY panel_code ORDER BY panel_code;
GO
PRINT N'英文标签+id字段统一处理完成';
GO
