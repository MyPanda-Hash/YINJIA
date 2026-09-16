// kingdee-extra-fields.mjs — 全并集自动映射表(生成器产出,勿手改)
//   runCore 在 mapArchive/mapHead 之后合并:c=列 a=接口键 t=dec(解密)/join(数组拼接)/str
export const EXTRA = {
  "BD_SETTLE": [],
  "BD_CUSGRP": [],
  "BD_SUPGRP": [],
  "BD_MATGRP": [],
  "BD_CUR": [
    {
      "c": "创建人id",
      "a": "creator_id",
      "t": "str"
    },
    {
      "c": "修改人id",
      "a": "modifier_id",
      "t": "str"
    }
  ],
  "BD_UOM": [
    {
      "c": "创建人",
      "a": "creator_id",
      "t": "str"
    },
    {
      "c": "修改人",
      "a": "modifier_id",
      "t": "str"
    }
  ],
  "BD_DEPT": [
    {
      "c": "上级id",
      "a": "parent_id",
      "t": "str"
    }
  ],
  "BD_EMP": [
    {
      "c": "部门id",
      "a": "department_id",
      "t": "str"
    },
    {
      "c": "结算账户id",
      "a": "settle_bank_id",
      "t": "str"
    },
    {
      "c": "结算类型id",
      "a": "settle_type_id",
      "t": "str"
    }
  ],
  "BD_STORE": [
    {
      "c": "分类id",
      "a": "group_id",
      "t": "str"
    },
    {
      "c": "仓库管理员id",
      "a": "storekeeper_id",
      "t": "str"
    }
  ],
  "BD_MATERIAL": [
    {
      "c": "parent_name",
      "a": "parent_name",
      "t": "str"
    },
    {
      "c": "商品类别编码",
      "a": "parent_number",
      "t": "str"
    },
    {
      "c": "is_show_aux_barcode",
      "a": "is_show_aux_barcode",
      "t": "str"
    },
    {
      "c": "品牌id",
      "a": "brand_id",
      "t": "str"
    },
    {
      "c": "商品计量单位id",
      "a": "base_unit_id",
      "t": "str"
    },
    {
      "c": "默认仓库_stock_id",
      "a": "stock_id",
      "t": "str"
    },
    {
      "c": "采购单位",
      "a": "purchase_unit_id",
      "t": "str"
    },
    {
      "c": "辅助单位1,启动多单位，才需要传递",
      "a": "fix_unit_id1",
      "t": "str"
    },
    {
      "c": "换算率1",
      "a": "coefficient1",
      "t": "str"
    },
    {
      "c": "换算单位1",
      "a": "conversion_unit_id1",
      "t": "str"
    },
    {
      "c": "辅助单位2",
      "a": "fix_unit_id2",
      "t": "str"
    },
    {
      "c": "换算率2",
      "a": "coefficient2",
      "t": "str"
    },
    {
      "c": "换算单位2",
      "a": "conversion_unit_id2",
      "t": "str"
    },
    {
      "c": "辅助单位3",
      "a": "fix_unit_id3",
      "t": "str"
    },
    {
      "c": "换算率3",
      "a": "coefficient3",
      "t": "str"
    },
    {
      "c": "换算单位3",
      "a": "conversion_unit_id3",
      "t": "str"
    },
    {
      "c": "销售单位",
      "a": "sale_unit_id",
      "t": "str"
    },
    {
      "c": "库存单位",
      "a": "store_unit_id",
      "t": "str"
    },
    {
      "c": "报表辅助单位",
      "a": "aux_unit_id",
      "t": "str"
    },
    {
      "c": "辅助属性",
      "a": "aux_entity",
      "t": "join"
    },
    {
      "c": "商品条码",
      "a": "barcode_entity",
      "t": "join"
    },
    {
      "c": "税收分类编码",
      "a": "fetch_category_id",
      "t": "str"
    },
    {
      "c": "默认仓位",
      "a": "space_id",
      "t": "str"
    },
    {
      "c": "默认供应商",
      "a": "vender_id",
      "t": "str"
    },
    {
      "c": "采购员",
      "a": "purchase_id",
      "t": "str"
    },
    {
      "c": "重量单位",
      "a": "weight_unit_id",
      "t": "str"
    },
    {
      "c": "商品图片",
      "a": "images",
      "t": "join"
    },
    {
      "c": "套装信息对象",
      "a": "bom_entity",
      "t": "join"
    },
    {
      "c": "附件地址",
      "a": "attachments_url",
      "t": "join"
    },
    {
      "c": "默认生产车间id",
      "a": "product_department_id",
      "t": "str"
    },
    {
      "c": "倒冲仓库id",
      "a": "backflushed_stock_id",
      "t": "str"
    },
    {
      "c": "倒冲仓位id",
      "a": "backflushed_space_id",
      "t": "str"
    },
    {
      "c": "倒冲仓位编码",
      "a": "backflushed_space_number",
      "t": "str"
    }
  ],
  "BD_CUSTOMER": [
    {
      "c": "价格等级-id",
      "a": "c_level_id",
      "t": "str"
    },
    {
      "c": "国家-id",
      "a": "country_id",
      "t": "str"
    },
    {
      "c": "省-id",
      "a": "province_id",
      "t": "str"
    },
    {
      "c": "市-id",
      "a": "city_id",
      "t": "str"
    },
    {
      "c": "区-id",
      "a": "district_id",
      "t": "str"
    },
    {
      "c": "部门-id",
      "a": "sale_dept_id",
      "t": "str"
    },
    {
      "c": "类别-id",
      "a": "group_id",
      "t": "str"
    },
    {
      "c": "业务员-id",
      "a": "saler_id",
      "t": "str"
    },
    {
      "c": "结算期限id",
      "a": "setting_term_id",
      "t": "str"
    },
    {
      "c": "结算客户id",
      "a": "settle_customer_id",
      "t": "str"
    }
  ],
  "BD_SUPPLIER": [
    {
      "c": "group_id",
      "a": "group_id",
      "t": "str"
    }
  ],
  "SO_ORDER": [
    {
      "c": "整单折扣额",
      "a": "bill_dis_amount",
      "t": "str"
    },
    {
      "c": "创建时间",
      "a": "create_time",
      "t": "str"
    },
    {
      "c": "结算状态",
      "a": "settle_status",
      "t": "str"
    },
    {
      "c": "交货方式",
      "a": "delivery_type",
      "t": "str"
    },
    {
      "c": "客户id",
      "a": "customer_id",
      "t": "str"
    },
    {
      "c": "业务员id",
      "a": "emp_id",
      "t": "str"
    },
    {
      "c": "业务员编码",
      "a": "emp_number",
      "t": "str"
    },
    {
      "c": "应收金额",
      "a": "total_amount",
      "t": "str"
    },
    {
      "c": "商品组合",
      "a": "material_group",
      "t": "str"
    },
    {
      "c": "商品数量",
      "a": "material_qty",
      "t": "str"
    },
    {
      "c": "折前价税合计",
      "a": "bill_dis_before_amount",
      "t": "str"
    },
    {
      "c": "实际出入库状态",
      "a": "real_io_status",
      "t": "str"
    },
    {
      "c": "出入库状态",
      "a": "io_status",
      "t": "str"
    },
    {
      "c": "单据关闭状态",
      "a": "bill_close_state",
      "t": "str"
    },
    {
      "c": "部门id",
      "a": "dept_id",
      "t": "str"
    },
    {
      "c": "部门编码",
      "a": "dept_number",
      "t": "str"
    },
    {
      "c": "审核日期",
      "a": "audit_date",
      "t": "str"
    },
    {
      "c": "客户联系电话",
      "a": "contact_phone",
      "t": "dec"
    },
    {
      "c": "客户国家id",
      "a": "contact_country_id",
      "t": "str"
    },
    {
      "c": "客户国家名称",
      "a": "contact_country_name",
      "t": "str"
    },
    {
      "c": "客户国家编码",
      "a": "contact_country_number",
      "t": "str"
    },
    {
      "c": "客户省份id",
      "a": "contact_province_id",
      "t": "str"
    },
    {
      "c": "客户省份名称",
      "a": "contact_province_name",
      "t": "str"
    },
    {
      "c": "客户省份编码",
      "a": "contact_province_number",
      "t": "str"
    },
    {
      "c": "客户市区id",
      "a": "contact_city_id",
      "t": "str"
    },
    {
      "c": "客户市区名称",
      "a": "contact_city_name",
      "t": "str"
    },
    {
      "c": "客户市区编码",
      "a": "contact_city_number",
      "t": "str"
    },
    {
      "c": "客户区县id",
      "a": "contact_district_id",
      "t": "str"
    },
    {
      "c": "客户区县名称",
      "a": "contact_district_name",
      "t": "str"
    },
    {
      "c": "客户区县编码",
      "a": "contact_district_number",
      "t": "str"
    },
    {
      "c": "联系信息",
      "a": "contact_info",
      "t": "dec"
    },
    {
      "c": "联系地址",
      "a": "contact_address",
      "t": "dec"
    },
    {
      "c": "发货国家id",
      "a": "dispatcher_country_id",
      "t": "str"
    },
    {
      "c": "发货国家名称",
      "a": "dispatcher_country_name",
      "t": "str"
    },
    {
      "c": "发货国家编码",
      "a": "dispatcher_country_number",
      "t": "str"
    },
    {
      "c": "发货省份id",
      "a": "dispatcher_province_id",
      "t": "str"
    },
    {
      "c": "发货省份名称",
      "a": "dispatcher_province_name",
      "t": "str"
    },
    {
      "c": "发货省份编码",
      "a": "dispatcher_province_number",
      "t": "str"
    },
    {
      "c": "发货市区id",
      "a": "dispatcher_city_id",
      "t": "str"
    },
    {
      "c": "发货市区名称",
      "a": "dispatcher_city_name",
      "t": "str"
    },
    {
      "c": "发货市区编码",
      "a": "dispatcher_city_number",
      "t": "str"
    },
    {
      "c": "发货区县id",
      "a": "dispatcher_district_id",
      "t": "str"
    },
    {
      "c": "发货区县名称",
      "a": "dispatcher_district_name",
      "t": "str"
    },
    {
      "c": "发货区县编码",
      "a": "dispatcher_district_number",
      "t": "str"
    },
    {
      "c": "发货详细地址",
      "a": "dispatcher_address",
      "t": "dec"
    },
    {
      "c": "发货人",
      "a": "dispatcher_linkman",
      "t": "str"
    },
    {
      "c": "发货联系电话",
      "a": "dispatcher_phone",
      "t": "dec"
    },
    {
      "c": "发货地址",
      "a": "recevice_delivery",
      "t": "str"
    },
    {
      "c": "付款信息单据体",
      "a": "payment_entry",
      "t": "join"
    },
    {
      "c": "未核销金额",
      "a": "total_un_settle_amount",
      "t": "str"
    },
    {
      "c": "附件个数",
      "a": "attachments",
      "t": "str"
    },
    {
      "c": "附件地址",
      "a": "attachments_url",
      "t": "join"
    },
    {
      "c": "审核人id",
      "a": "auditor_id",
      "t": "str"
    },
    {
      "c": "审核人编码",
      "a": "auditor_number",
      "t": "str"
    },
    {
      "c": "应收款余额",
      "a": "all_debt",
      "t": "str"
    },
    {
      "c": "物流公司id",
      "a": "f_logistics_id",
      "t": "str"
    },
    {
      "c": "销售费用",
      "a": "cost_fee",
      "t": "str"
    },
    {
      "c": "预收款金额",
      "a": "subsist_info",
      "t": "str"
    },
    {
      "c": "上次欠款",
      "a": "last_debt",
      "t": "str"
    },
    {
      "c": "折扣率",
      "a": "bill_dis_rate",
      "t": "str"
    },
    {
      "c": "修改时间",
      "a": "modify_time",
      "t": "str"
    },
    {
      "c": "创建人id",
      "a": "creator_id",
      "t": "str"
    },
    {
      "c": "创建人名称",
      "a": "creator_name",
      "t": "str"
    },
    {
      "c": "创建人编码",
      "a": "creator_number",
      "t": "str"
    },
    {
      "c": "修改人id",
      "a": "modifier_id",
      "t": "str"
    },
    {
      "c": "修改人名称",
      "a": "modifier_name",
      "t": "str"
    },
    {
      "c": "修改人编码",
      "a": "modifier_number",
      "t": "str"
    },
    {
      "c": "单据标签",
      "a": "mulbill_label",
      "t": "join"
    },
    {
      "c": "业务模式",
      "a": "biz_mode",
      "t": "str"
    },
    {
      "c": "结算日期",
      "a": "due_date",
      "t": "str"
    },
    {
      "c": "结算期限id",
      "a": "setting_term_id",
      "t": "str"
    },
    {
      "c": "结算期限编码",
      "a": "setting_term_number",
      "t": "str"
    },
    {
      "c": "交货方式id",
      "a": "delivery_type_id",
      "t": "str"
    },
    {
      "c": "本次定金",
      "a": "total_deposit",
      "t": "str"
    },
    {
      "c": "累计预收",
      "a": "total_pre_settle_amount",
      "t": "str"
    },
    {
      "c": "发票类型",
      "a": "ivc_type",
      "t": "str"
    },
    {
      "c": "客户承担费用单据体",
      "a": "cus_bear_fee_entry",
      "t": "join"
    },
    {
      "c": "费用信息单据体",
      "a": "cost_fee_entity",
      "t": "str"
    },
    {
      "c": "结算客户id",
      "a": "settle_customer_id",
      "t": "str"
    },
    {
      "c": "开票状态",
      "a": "ivc_status",
      "t": "str"
    },
    {
      "c": "已执行金额",
      "a": "io_amount",
      "t": "str"
    },
    {
      "c": "未执行金额",
      "a": "un_io_amount",
      "t": "str"
    },
    {
      "c": "累计预收状态",
      "a": "total_pre_settle_status",
      "t": "str"
    }
  ],
  "PU_ORDER": [
    {
      "c": "创建时间",
      "a": "create_time",
      "t": "str"
    },
    {
      "c": "关闭状态",
      "a": "bill_close_state",
      "t": "str"
    },
    {
      "c": "供应商id",
      "a": "supplier_id",
      "t": "str"
    },
    {
      "c": "业务员id",
      "a": "emp_id",
      "t": "str"
    },
    {
      "c": "业务员名称",
      "a": "emp_name",
      "t": "str"
    },
    {
      "c": "业务员编码",
      "a": "emp_number",
      "t": "str"
    },
    {
      "c": "入库状态Z部分入库，C全部入库，A未入库",
      "a": "io_status",
      "t": "str"
    },
    {
      "c": "实际出入库状态",
      "a": "real_io_status",
      "t": "str"
    },
    {
      "c": "delivery_type_id",
      "a": "delivery_type_id",
      "t": "str"
    },
    {
      "c": "交货方式",
      "a": "delivery_type_name",
      "t": "str"
    },
    {
      "c": "delivery_type_number",
      "a": "delivery_type_number",
      "t": "str"
    },
    {
      "c": "修改时间",
      "a": "modify_time",
      "t": "str"
    },
    {
      "c": "创建人id",
      "a": "creator_id",
      "t": "str"
    },
    {
      "c": "创建人名称",
      "a": "creator_name",
      "t": "str"
    },
    {
      "c": "创建人编码",
      "a": "creator_number",
      "t": "str"
    },
    {
      "c": "修改人id",
      "a": "modifier_id",
      "t": "str"
    },
    {
      "c": "修改人名称",
      "a": "modifier_name",
      "t": "str"
    },
    {
      "c": "修改人编码",
      "a": "modifier_number",
      "t": "str"
    },
    {
      "c": "审核人id",
      "a": "auditor_id",
      "t": "str"
    },
    {
      "c": "审核人编码",
      "a": "auditor_number",
      "t": "str"
    },
    {
      "c": "业务类型",
      "a": "trans_type",
      "t": "str"
    },
    {
      "c": "部门id",
      "a": "dept_id",
      "t": "str"
    },
    {
      "c": "部门名称",
      "a": "dept_name",
      "t": "str"
    },
    {
      "c": "部门编码",
      "a": "dept_number",
      "t": "str"
    },
    {
      "c": "客户id",
      "a": "customer_id",
      "t": "str"
    },
    {
      "c": "客户名称",
      "a": "customer_name",
      "t": "str"
    },
    {
      "c": "客户编码",
      "a": "customer_number",
      "t": "str"
    },
    {
      "c": "联系信息-联系方式",
      "a": "contact_phone",
      "t": "dec"
    },
    {
      "c": "供应商发货地址国家id",
      "a": "contact_country_id",
      "t": "str"
    },
    {
      "c": "供应商发货地址国家名称",
      "a": "contact_country_name",
      "t": "str"
    },
    {
      "c": "供应商发货地址国家编码",
      "a": "contact_country_number",
      "t": "str"
    },
    {
      "c": "供应商发货地址省份id",
      "a": "contact_province_id",
      "t": "str"
    },
    {
      "c": "供应商发货地址省份名称",
      "a": "contact_province_name",
      "t": "str"
    },
    {
      "c": "供应商发货地址省份编码",
      "a": "contact_province_number",
      "t": "str"
    },
    {
      "c": "供应商发货地址市区id",
      "a": "contact_city_id",
      "t": "str"
    },
    {
      "c": "供应商发货地址市区名称",
      "a": "contact_city_name",
      "t": "str"
    },
    {
      "c": "供应商发货地址市区编码",
      "a": "contact_city_number",
      "t": "str"
    },
    {
      "c": "供应商发货地址区县id",
      "a": "contact_district_id",
      "t": "str"
    },
    {
      "c": "供应商发货地址区县名称",
      "a": "contact_district_name",
      "t": "str"
    },
    {
      "c": "供应商发货地址区县编码",
      "a": "contact_district_number",
      "t": "str"
    },
    {
      "c": "联系地址",
      "a": "contact_address",
      "t": "dec"
    },
    {
      "c": "发送状态",
      "a": "send_status",
      "t": "str"
    },
    {
      "c": "附件个数",
      "a": "attachments",
      "t": "str"
    },
    {
      "c": "附件地址",
      "a": "attachments_url",
      "t": "join"
    },
    {
      "c": "结算日期",
      "a": "due_date",
      "t": "str"
    },
    {
      "c": "结算期限id",
      "a": "setting_term_id",
      "t": "str"
    },
    {
      "c": "结算期限编码",
      "a": "setting_term_number",
      "t": "str"
    },
    {
      "c": "收货地址人",
      "a": "dispatcher_linkman",
      "t": "str"
    },
    {
      "c": "收货地址联系电话",
      "a": "dispatcher_phone",
      "t": "dec"
    },
    {
      "c": "收货地址-详细地址",
      "a": "dispatcher_address",
      "t": "dec"
    },
    {
      "c": "收货地址国家id",
      "a": "dispatcher_country_id",
      "t": "str"
    },
    {
      "c": "收货地址国家名称",
      "a": "dispatcher_country_name",
      "t": "str"
    },
    {
      "c": "收货地址国家编码",
      "a": "dispatcher_country_number",
      "t": "str"
    },
    {
      "c": "收货地址-省ID",
      "a": "dispatcher_province_id",
      "t": "str"
    },
    {
      "c": "收货地址省份名称",
      "a": "dispatcher_province_name",
      "t": "str"
    },
    {
      "c": "收货地址省份编码",
      "a": "dispatcher_province_number",
      "t": "str"
    },
    {
      "c": "收货地址-市ID",
      "a": "dispatcher_city_id",
      "t": "str"
    },
    {
      "c": "收货地址市区名称",
      "a": "dispatcher_city_name",
      "t": "str"
    },
    {
      "c": "收货地址区编码",
      "a": "dispatcher_city_number",
      "t": "str"
    },
    {
      "c": "收货地址-区ID",
      "a": "dispatcher_district_id",
      "t": "str"
    },
    {
      "c": "收货地址区县名称",
      "a": "dispatcher_district_name",
      "t": "str"
    },
    {
      "c": "收货地址区县编码",
      "a": "dispatcher_district_number",
      "t": "str"
    },
    {
      "c": "采购费用明细",
      "a": "cost_fee_entity",
      "t": "str"
    },
    {
      "c": "累计预付",
      "a": "total_pre_settle_amount",
      "t": "str"
    },
    {
      "c": "累计预付本位币",
      "a": "total_pre_settle_amount_for",
      "t": "str"
    }
  ]
};
