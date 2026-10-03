# dump db=HSDZ_MES
PANEL	PURCHASE_IN	采购入库单	Purchase Receiving Order	库存核算	doc	bd_purchase_in	bl_purchase_in	单据编号	单据日期	PI	50	items	库存核算
PANEL	QC_INSP	来料检验单	null	采购管理	doc	qc_insp	qc_insp_detail	单据编号	单据日期	IJ	20	items	智能供应链
PANEL	QC_RECV	送料暂收单	Temporary Material Receipt	库存核算	doc	sl_recv	sl_recv_detail	单据编号	单据日期	SL	20	items	库存核算
PANEL	QC_RETURN	暂收退回单	null	采购管理	doc	qc_return	qc_return_detail	单据编号	单据日期	TH	20	items	库存核算

===== QC_RECV =====
-- yj_field (place, seq)
FIELD	detail	10	单号	单据编号	文本	150	---V		GFDA	mc	mc					9364
FIELD	detail	30	采购单号	采购单号	参照	140	E--V		GFDA	mc	mc					9376
FIELD	detail	40	采购订单行号	采购订单行号	文本	110	E--V		GFDA	mc	mc					9488
FIELD	detail	50	物料名称	物料名称	参照	160	E--V		GFDA	mc	mc					9366
FIELD	detail	60	规格型号	规格型号	文本	140	E--V		GFDA	mc	mc					9367
FIELD	detail	70	批次号	批次号	文本	150	---V									11461
FIELD	detail	80	物料描述	物料描述	文本	200	E--V		GFDA	mc	mc					9368
FIELD	detail	90	单价	单价	小数	90	E--V		GFDA	mc	mc					9372
FIELD	detail	100	数量	数量	小数	100	E--V		GFDA	mc	mc					9369
FIELD	detail	110	计量单位	计量单位	文本	90	E--V		GFDA	mc	mc					11166
FIELD	detail	120	数量2	数量2	小数	90	E--V		GFDA	mc	mc					9599
FIELD	detail	130	计量单位2	计量单位2	文本	90	E--V		GFDA	mc	mc					9600
FIELD	detail	140	金额	金额	小数	100	E--V		GFDA	mc	mc					9374
FIELD	detail	150	日期	日期	日期	110	E--V		GFDA	mc	mc					9370
FIELD	detail	160	税率%	税率%	小数	80	E--V		GFDA	mc	mc					9601
FIELD	detail	170	含税单价	含税单价	小数	100	E--V		GFDA	mc	mc					9602
FIELD	detail	180	税额	税额	小数	90	E--V		GFDA	mc	mc					9383
FIELD	detail	190	含税金额	含税金额	小数	100	E--V		GFDA	mc	mc					9603
FIELD	detail	200	折扣	折扣	小数	80	E-H-		GFDA	mc	mc					9373
FIELD	detail	210	供应商	供应商	参照	160	E-H-		GFDA	mc	mc					9371
FIELD	detail	220	入库数量	入库数量	小数	100	E-H-		GFDA	mc	mc					9377
FIELD	detail	230	入库单号	入库单号	文本	130	E-H-		GFDA	mc	mc					9378
FIELD	detail	240	领料单号	领料单号	文本	130	E-H-		GFDA	mc	mc					9379
FIELD	detail	250	结案	结案	下拉框	80	E-H-		GFDA	mc	mc		SELECT v FROM (VALUES (N'是'),(N'否')) AS t(v)			9380
FIELD	detail	260	税别代码	税别代码	文本	100	E-H-		GFDA	mc	mc					9381
FIELD	detail	270	税别说明	税别说明	文本	120	E-H-		GFDA	mc	mc					9382
FIELD	detail	280	总金额	总金额	小数	100	E-H-		GFDA	mc	mc					9384
FIELD	detail	290	订单号	订单号	参照	140	E-H-		GFDA	mc	mc					9385
FIELD	detail	300	箱数	箱数	小数	80	E-H-		GFDA	mc	mc					9386
FIELD	detail	310	部门	部门	参照	100	E-H-		GFDA	mc	mc					9387
FIELD	detail	320	部门名称	部门名称	文本	100	E-H-		GFDA	mc	mc					9388
FIELD	detail	330	折扣%	折扣%	小数	80	E--V		GFDA	mc	mc					9604
FIELD	detail	340	预计到货日期	预计到货日期	日期	120	E--V		GFDA	mc	mc					9605
FIELD	detail	350	备注	备注	文本	200	E--V		GFDA	mc	mc					9375
FIELD	detail	360	现存量	现存量	小数	90	E-H-		GFDA	mc	mc					9606
FIELD	detail	370	仓库	仓库	文本	120	E-H-		GFDA	mc	mc					9608
FIELD	detail	380	折扣金额	折扣金额	小数	100	E-H-		GFDA	mc	mc					9595
FIELD	detail	400	发货数量	发货数量	小数	100	E-H-		GFDA	mc	mc					9591
FIELD	detail	410	剩余数量	剩余数量	小数	100	E-H-		GFDA	mc	mc					9592
FIELD	detail	420	退料数量	退料数量	小数	100	E-H-		GFDA	mc	mc					9593
FIELD	detail	430	报废数量	报废数量	小数	100	E-H-		GFDA	mc	mc					9594
FIELD	detail	440	制单号	制单号	文本	130	E-H-		GFDA	mc	mc					9596
FIELD	detail	450	品质复核人	品质复核人	参照	100	E-H-		GFDA	mc	mc					9597
FIELD	detail	460	品质复核时间	品质复核时间	文本	140	E-H-		GFDA	mc	mc					9598
FIELD	header	60	金额	金额	小数	100	E-H-		GFDA	mc	mc					9585
FIELD	header	70	税额	税额	小数	100	E-H-		GFDA	mc	mc					9586
FIELD	header	80	总金额	总金额	小数	100	E-H-		GFDA	mc	mc					9587
FIELD	header	100	部门	部门	参照	120	E--V		GFDA	mc	mc					9355
FIELD	header	120	部门名称	部门名称	文本	120	E-H-		GFDA	mc	mc					9356
FIELD	header	140	数量	数量	小数	100	E-H-		GFDA	mc	mc					9357
FIELD	header	150	附件1	附件1	附件	220	E--V		GFDA	mc	mc					9358
FIELD	header	160	附件2	附件2	附件	220	E--V		GFDA	mc	mc					9359
FIELD	header	170	附件3	附件3	附件	220	E--V		GFDA	mc	mc					9360
FIELD	header	180	附件4	附件4	附件	220	E--V		GFDA	mc	mc					9361
FIELD	header	190	附件5	附件5	附件	220	E--V		GFDA	mc	mc					9362
FIELD	header	200	附件6	附件6	附件	220	E--V		GFDA	mc	mc					9363
FIELD	header	220	审核人	审核人	参照	100	---V		GFDA	mc	mc					9588
FIELD	header	230	审核时间	审核时间	文本	140	---V		GFDA	mc	mc					9589
FIELD	header	240	批次键	批次键	整数	80	--H-		GFDA	mc	mc					9609
FIELD	query,detail	20	物料编码	物料编码	参照	130	ER-V		GFDA	mc	mc					9365
FIELD	query,detail	390	条码	条码	文本	140	E-H-		GFDA	mc	mc					9590
FIELD	query,header	10	单号	单据编号	文本	140	-R-V		GFDA	mc	mc					9350
FIELD	query,header	20	单据日期	单据日期	日期	120	ER-V		GFDA	mc	mc					9351
FIELD	query,header	30	业务员	业务员	参照	100	E--V		GFDA	mc	mc					9352
FIELD	query,header	40	供应商代码	供应商代码	参照	130	E--V		GFDA	dm	mc					9353
FIELD	query,header	50	供应商	供应商	参照	180	E--V		GFDA	mc	mc					9354
FIELD	query,header	90	来料性质	来料性质	文本	110	E--V		GFDA	mc	mc					9583
FIELD	query,header	110	仓库	仓库	参照	150	E-H-		GFDA	mc	mc					9584
FIELD	query,header	130	批次号	批次号	文本	160	E--V									11460
FIELD	query,header	210	采购订单号	采购订单号	文本	150	E--V		GFDA	mc	mc					9487
-- config.json -> QC_RECV.config.json len=0
COL	sl_recv	id	int(4)	NOT NULL	
COL	sl_recv	单据编号	nvarchar(120)	NOT NULL	
COL	sl_recv	单据日期	nvarchar(40)	null	
COL	sl_recv	业务员	nvarchar(100)	null	
COL	sl_recv	供应商代码	nvarchar(200)	null	
COL	sl_recv	供应商	nvarchar(400)	null	
COL	sl_recv	部门	nvarchar(200)	null	
COL	sl_recv	部门名称	nvarchar(200)	null	
COL	sl_recv	数量	decimal(9)	null	
COL	sl_recv	附件1	nvarchar(1000)	null	
COL	sl_recv	附件2	nvarchar(1000)	null	
COL	sl_recv	附件3	nvarchar(1000)	null	
COL	sl_recv	附件4	nvarchar(1000)	null	
COL	sl_recv	附件5	nvarchar(1000)	null	
COL	sl_recv	附件6	nvarchar(1000)	null	
COL	sl_recv	备注	nvarchar(1000)	null	
COL	sl_recv	单据状态	nvarchar(20)	NOT NULL	
COL	sl_recv	审核人	nvarchar(100)	null	
COL	sl_recv	审核时间	nvarchar(60)	null	
COL	sl_recv	审批人	nvarchar(100)	null	
COL	sl_recv	审批时间	nvarchar(60)	null	
COL	sl_recv	asp_user1	nvarchar(100)	null	
COL	sl_recv	asp_time1	datetime2(8)	null	
COL	sl_recv	asp_user2	nvarchar(100)	null	
COL	sl_recv	asp_time2	datetime2(8)	null	
COL	sl_recv	asp_cancel	char(1)	null	
COL	sl_recv	采购订单号	nvarchar(1000)	null	来源采购订单号(链路带入,转ERP 用)
COL	sl_recv	批次号	nvarchar(100)	null	送料批次号:供应商编码去掉 YJ- 前缀 + - + 生单当天 yyyyMMdd(如 YJ-TX、2026-09-10 ⇒ TX-20260910);采购订单→送料暂收单生单时写入,下游检验/入库/退回逐站继承;仅本单草稿态单头可人工修改,审核后整链只读;明细行随单头一致
COL	sl_recv	来料性质	nvarchar(100)	null	来料性质(免检/检验、来料/退料的分流依据;参照库品检系字段)
COL	sl_recv	仓库	nvarchar(200)	null	仓库(暂收目标仓,参照仓库档案 WH,存仓库名称)
COL	sl_recv	金额	decimal(9)	null	金额(头汇总,未税金额合计)
COL	sl_recv	税额	decimal(9)	null	税额(头汇总)
COL	sl_recv	总金额	decimal(9)	null	总金额(头汇总,含税金额合计)
COL	sl_recv	批次键	int(4)	null	批次键:批次台账 yj_doc_batch.id;采购入库单审核时顺键回填本单批次号,取号前为空
COL	sl_recv	备用1	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用2	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用3	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用4	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用5	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用6	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用7	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用8	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用9	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用10	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用11	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用12	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用13	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用14	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用15	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用16	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用17	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用18	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用19	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv	备用20	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	id	int(4)	NOT NULL	
COL	sl_recv_detail	单据编号	nvarchar(120)	NOT NULL	
COL	sl_recv_detail	物料编码	nvarchar(200)	null	
COL	sl_recv_detail	物料名称	nvarchar(400)	null	
COL	sl_recv_detail	规格型号	nvarchar(400)	null	规格型号(2026-09-21 由「型号」更名:全链统一为规格型号,与采购订单/检验单/入库单/退料单同名直通)
COL	sl_recv_detail	物料描述	nvarchar(1000)	null	
COL	sl_recv_detail	数量	decimal(9)	null	
COL	sl_recv_detail	日期	nvarchar(40)	null	
COL	sl_recv_detail	供应商	nvarchar(400)	null	
COL	sl_recv_detail	单价	decimal(9)	null	
COL	sl_recv_detail	折扣	decimal(9)	null	
COL	sl_recv_detail	金额	decimal(9)	null	
COL	sl_recv_detail	备注	nvarchar(1000)	null	
COL	sl_recv_detail	采购单号	nvarchar(120)	null	
COL	sl_recv_detail	入库数量	decimal(9)	null	
COL	sl_recv_detail	入库单号	nvarchar(120)	null	
COL	sl_recv_detail	领料单号	nvarchar(120)	null	
COL	sl_recv_detail	结案	nvarchar(20)	null	
COL	sl_recv_detail	税别代码	nvarchar(80)	null	
COL	sl_recv_detail	税别说明	nvarchar(200)	null	
COL	sl_recv_detail	税额	decimal(9)	null	
COL	sl_recv_detail	总金额	decimal(9)	null	
COL	sl_recv_detail	订单号	nvarchar(120)	null	
COL	sl_recv_detail	箱数	decimal(9)	null	
COL	sl_recv_detail	部门	nvarchar(200)	null	
COL	sl_recv_detail	部门名称	nvarchar(200)	null	
COL	sl_recv_detail	asp_user1	nvarchar(100)	null	
COL	sl_recv_detail	asp_time1	datetime2(8)	null	
COL	sl_recv_detail	asp_user2	nvarchar(100)	null	
COL	sl_recv_detail	asp_time2	datetime2(8)	null	
COL	sl_recv_detail	asp_cancel	char(1)	null	
COL	sl_recv_detail	采购订单行号	nvarchar(1000)	null	对应采购订单行号(链路带入)
COL	sl_recv_detail	计量单位	nvarchar(100)	null	
COL	sl_recv_detail	批次号	nvarchar(100)	null	送料批次号(明细):随单头一致,由 BatchService.syncBatchNo 每次保存/审核按单头覆盖写入,不可手工修改
COL	sl_recv_detail	发货数量	decimal(9)	null	发货数量(供应商实际发货量,与暂收量/入库量比对)
COL	sl_recv_detail	剩余数量	decimal(9)	null	剩余数量(本行暂收后可入库/退回的余量;参照库存储式字段)
COL	sl_recv_detail	退料数量	decimal(9)	null	退料数量(与暂收退回单互证)
COL	sl_recv_detail	报废数量	decimal(9)	null	报废数量(不合格中作报废处理的部分)
COL	sl_recv_detail	条码	nvarchar(200)	null	条码(材料二维码/供应商标签条码,扫码收货与批号追溯用)
COL	sl_recv_detail	制单号	nvarchar(120)	null	制单号(制单来源编号留痕;参照库同名字段,语义待业务确认)
COL	sl_recv_detail	折扣金额	decimal(9)	null	折扣金额(折让金额;与折扣率列分列)
COL	sl_recv_detail	品质复核人	nvarchar(100)	null	品质复核人(参照职员档案 EMP)
COL	sl_recv_detail	品质复核时间	nvarchar(60)	null	品质复核时间(参照库同族字段另有「品质审核时间」)
COL	sl_recv_detail	数量2	decimal(9)	null	辅助数量(采购订单行同名带入)
COL	sl_recv_detail	计量单位2	nvarchar(200)	null	辅助计量单位(采购订单行同名带入)
COL	sl_recv_detail	税率%	decimal(9)	null	税率(采购订单行同名带入)
COL	sl_recv_detail	含税单价	decimal(9)	null	含税单价(采购订单行同名带入)
COL	sl_recv_detail	含税金额	decimal(9)	null	含税金额(采购订单行同名带入)
COL	sl_recv_detail	折扣%	decimal(9)	null	折扣率(采购订单行同名带入)
COL	sl_recv_detail	预计到货日期	date(3)	null	预计到货日期(采购订单行同名带入)
COL	sl_recv_detail	现存量	decimal(9)	null	现存量(采购订单行同名带入,默认隐藏)
COL	sl_recv_detail	仓库	nvarchar(200)	null	仓库(采购订单行同名带入,行级仓库沿链 暂收→检验→入库 贯通)
COL	sl_recv_detail	备用1	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用2	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用3	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用4	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用5	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用6	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用7	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用8	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用9	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用10	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用11	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用12	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用13	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用14	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用15	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用16	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用17	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用18	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用19	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	sl_recv_detail	备用20	nvarchar(1000)	null	预留扩展字段(未绑定)

===== QC_INSP =====
-- yj_field (place, seq)
FIELD	detail	20	物料名称	物料名称	参照	160	E--V		GFDA	mc	mc			Material Name		1777
FIELD	detail	30	规格型号	规格型号	文本	140	E--V		GFDA	mc	mc			Specification		1778
FIELD	detail	40	采购订单行号	采购订单行号	文本	110	E--V		GFDA	mc	mc					7540
FIELD	detail	50	单位	单位	参照	70	E-H-		GFDA	mc	mc			UOM		1779
FIELD	detail	60	单价	单价	小数	100	E--V		GFDA	mc	mc			Unit Price		7543
FIELD	detail	70	计量单位	计量单位	参照	90	E--V		GFDA	mc	mc			Unit of measurement		7542
FIELD	detail	80	送检数量	送检数量	小数	100	E--V		GFDA	mc	mc					1780
FIELD	detail	90	合格数量	合格数量	小数	100	ER-V		GFDA	mc	mc					1781
FIELD	detail	100	不合格数量	不合格数量	小数	100	E--V		GFDA	mc	mc					1782
FIELD	detail	110	报废数量	报废数量	小数	100	E-H-		GFDA	mc	mc					7627
FIELD	detail	120	损耗	损耗	小数	90	E--V		GFDA	mc	mc					7628
FIELD	detail	130	损耗率	损耗率	小数	90	E--V		GFDA	mc	mc					7629
FIELD	detail	140	生产日期	生产日期	日期	120	E--V		GFDA	mc	mc					7632
FIELD	detail	150	批次号	批次号	文本	150	---V									11463
FIELD	detail	160	处置方式	处置方式	下拉框	100	E-H-		GFDA	mc	mc		SELECT v FROM (VALUES (N'入库'),(N'退货'),(N'让步入库')) AS t(v)			1783
FIELD	detail	180	成品编号	成品编号	文本	130	E-H-		GFDA	mc	mc					7631
FIELD	detail	190	物料描述	物料描述	文本	160	E-H-		GFDA	mc	mc					7436
FIELD	detail	200	箱数	箱数	小数	80	E-H-		GFDA	mc	mc					7437
FIELD	detail	210	日期	日期	文本	100	E-H-		GFDA	mc	mc			Date		7438
FIELD	detail	220	结案	结案	文本	80	E-H-		GFDA	mc	mc					7439
FIELD	detail	230	部门	部门	参照	100	E-H-		GFDA	mc	mc			Department		7440
FIELD	detail	250	部门名称	部门名称	文本	100	E-H-		GFDA	mc	mc			Department Name		7441
FIELD	detail	260	入库单号	入库单号	文本	130	---V		GFDA	mc	mc			Receipt No.		7442
FIELD	detail	270	仓库代码	仓库代码	文本	120	E-H-		GFDA	mc	mc			Warehouse Code		7694
FIELD	header	30	业务员	业务员	参照	100	E--V		GFDA	mc	mc			Salesperson		7692
FIELD	header	90	部门	部门	参照	140	E--V		DEPT	部门名称	部门名称					11588
FIELD	header	100	部门编码	部门编码	参照	140	E--V		DEPT	部门编码	部门名称					11589
FIELD	header	110	检验员	检验员	参照	100	E--V		GFDA	mc	mc					1768
FIELD	header	120	检验日期	检验日期	日期	120	E--V		GFDA	mc	mc					1769
FIELD	header	140	检验方案	检验方案	参照	140	E--V		GFDA	mc	mc			Inspection Plan		1770
FIELD	header	160	检验类型	检验类型	下拉框	100	E--V		GFDA	mc	mc		SELECT v FROM (VALUES (N'全检'),(N'抽检'),(N'免检')) AS t(v)			7626
FIELD	header	180	附件1	附件1	附件	220	E--V		GFDA	mc	mc					9531
FIELD	header	190	附件2	附件2	附件	220	E--V		GFDA	mc	mc					9532
FIELD	header	200	附件3	附件3	附件	220	E--V		GFDA	mc	mc					9533
FIELD	header	210	附件4	附件4	附件	220	E--V		GFDA	mc	mc					9534
FIELD	header	220	附件5	附件5	附件	220	E--V		GFDA	mc	mc					9535
FIELD	header	230	附件6	附件6	附件	220	E--V		GFDA	mc	mc					9536
FIELD	header	260	审核人	审核人	参照	90	---V		GFDA	mc	mc			Approved by		1774
FIELD	header	270	审核时间	审核时间	文本	140	---V		GFDA	mc	mc			Approved at		1775
FIELD	header	280	批次键	批次键	整数	80	--H-		GFDA	mc	mc					7696
FIELD	header,detail	240	备注	备注	文本	220	E-H-		GFDA	mc	mc			Remark		1772
FIELD	query,detail	10	物料编码	物料编码	参照	120	ER-V		GFDA	mc	mc			Material Code		1776
FIELD	query,detail	170	条码	条码	文本	140	E-H-		GFDA	mc	mc					7630
FIELD	query,header	10	单据编号	单据编号	文本	140	-R-V		GFDA	mc	mc			Document Number		1764
FIELD	query,header	20	单据日期	单据日期	日期	120	ER-V		GFDA	mc	mc			Document Date		1765
FIELD	query,header	40	暂收单号	暂收单号	参照	140	E--V		GFDA	mc	mc					1766
FIELD	query,header	50	采购订单号	采购订单号	文本	150	E--V		GFDA	mc	mc			Purchase Order Number		7539
FIELD	query,header	60	批次号	批次号	文本	160	---V									11462
FIELD	query,header	70	供应商	供应商	参照	180	E--V		GFDA	mc	mc			Vendor		1767
FIELD	query,header	80	供应商代码	供应商代码	文本	130	E--V		GFDA	dm	mc					7691
FIELD	query,header	130	检验编号	检验编号	文本	130	E--V		GFDA	mc	mc					7624
FIELD	query,header	150	执行标准	执行标准	文本	180	E--V		GFDA	mc	mc					7625
FIELD	query,header	170	总结论	总结论	下拉框	100	E--V		GFDA	mc	mc		SELECT v FROM (VALUES (N'合格'),(N'不合格'),(N'让步接收')) AS t(v)			1771
FIELD	query,header	240	单据状态	单据状态	文本	90	--H-		GFDA	mc	mc			Doc status		1773
-- config.json -> QC_INSP.config.json len=0
COL	qc_insp	id	int(4)	NOT NULL	
COL	qc_insp	单据编号	nvarchar(120)	NOT NULL	单号(面板字段列)
COL	qc_insp	单据日期	nvarchar(40)	null	
COL	qc_insp	暂收单号	nvarchar(120)	null	
COL	qc_insp	供应商	nvarchar(400)	null	
COL	qc_insp	检验员	nvarchar(100)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	检验日期	nvarchar(40)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	检验方案	nvarchar(200)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	总结论	nvarchar(40)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	备注	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	单据状态	nvarchar(20)	NOT NULL	
COL	qc_insp	审核人	nvarchar(100)	null	审核人(流程)(面板字段列)
COL	qc_insp	审核时间	nvarchar(60)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	审批人	nvarchar(100)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	审批时间	nvarchar(60)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	asp_user1	nvarchar(100)	null	
COL	qc_insp	asp_time1	datetime2(8)	null	
COL	qc_insp	asp_user2	nvarchar(100)	null	
COL	qc_insp	asp_time2	datetime2(8)	null	
COL	qc_insp	asp_cancel	char(1)	null	
COL	qc_insp	业务员	nvarchar(100)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	供应商代码	nvarchar(100)	null	
COL	qc_insp	部门	nvarchar(100)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	部门名称	nvarchar(100)	null	
COL	qc_insp	数量	float(8)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp	采购订单号	nvarchar(1000)	null	来源采购订单号(链路带入)
COL	qc_insp	附件1	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_insp	附件2	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_insp	附件3	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_insp	附件4	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_insp	附件5	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_insp	附件6	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_insp	批次号	nvarchar(100)	null	送料批次号:随链从送料暂收单继承(生单时带入),不重新取号、不可修改;明细行随单头一致
COL	qc_insp	检验编号	nvarchar(120)	null	检验编号(单据级检验流水号,与单据编号 IJ 分离;参照库品检系同名字段)
COL	qc_insp	执行标准	nvarchar(400)	null	执行标准(检验依据文本;检验方案 QC_PLAN 缺失时的兜底)
COL	qc_insp	检验类型	nvarchar(100)	null	检验类型(全检/抽检/免检;与检验方案的检验方式语义重叠,可留空)
COL	qc_insp	批次键	int(4)	null	批次键:批次台账 yj_doc_batch.id;由送料暂收单逐站带下,采购入库单审核时顺键回填批次号
COL	qc_insp	备用1	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用2	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用3	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用4	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用5	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用6	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用7	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用8	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用9	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用10	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用11	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用12	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用13	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用14	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用15	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用16	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用17	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用18	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用19	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	备用20	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp	部门编码	nvarchar(200)	null	部门编码(表头,2026-10-05 补:参照部门档案 bs_dept 的 部门编码,选部门时随参照带回;转 ERP 取 dept_number 用)
COL	qc_insp_detail	id	int(4)	NOT NULL	
COL	qc_insp_detail	单据编号	nvarchar(120)	NOT NULL	单号(面板字段列)
COL	qc_insp_detail	物料编码	nvarchar(200)	null	
COL	qc_insp_detail	物料名称	nvarchar(400)	null	
COL	qc_insp_detail	规格型号	nvarchar(400)	null	
COL	qc_insp_detail	单位	nvarchar(100)	null	
COL	qc_insp_detail	送检数量	decimal(9)	null	
COL	qc_insp_detail	合格数量	decimal(9)	null	
COL	qc_insp_detail	不合格数量	decimal(9)	null	
COL	qc_insp_detail	处置方式	nvarchar(40)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp_detail	批号	nvarchar(60)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp_detail	备注	nvarchar(400)	null	
COL	qc_insp_detail	asp_user1	nvarchar(100)	null	
COL	qc_insp_detail	asp_time1	datetime2(8)	null	
COL	qc_insp_detail	asp_user2	nvarchar(100)	null	
COL	qc_insp_detail	asp_time2	datetime2(8)	null	
COL	qc_insp_detail	asp_cancel	char(1)	null	
COL	qc_insp_detail	型号	nvarchar(200)	null	
COL	qc_insp_detail	数量	float(8)	null	
COL	qc_insp_detail	仓库代码	nvarchar(100)	null	
COL	qc_insp_detail	物料描述	nvarchar(2000)	null	物料描述(送料暂收单同步)
COL	qc_insp_detail	箱数	float(8)	null	箱数(送料暂收单同步)
COL	qc_insp_detail	日期	nvarchar(80)	null	单据日期(面板字段列)
COL	qc_insp_detail	结案	nvarchar(40)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp_detail	部门	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp_detail	部门名称	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_insp_detail	入库单号	nvarchar(100)	null	生成的采购入库单号(审核生单回填,作废释放置空)
COL	qc_insp_detail	不良数量	decimal(9)	null	不良数量(计算列=不合格数量,退料生单只读)
COL	qc_insp_detail	采购订单行号	nvarchar(1000)	null	对应采购订单行号(链路带入)
COL	qc_insp_detail	计量单位	nvarchar(100)	null	
COL	qc_insp_detail	单价	decimal(9)	null	
COL	qc_insp_detail	批次号	nvarchar(100)	null	送料批次号(明细):随单头一致,不可手工修改
COL	qc_insp_detail	报废数量	decimal(9)	null	报废数量(不合格中作报废处理的部分,与退供应商分开记账)
COL	qc_insp_detail	损耗	decimal(9)	null	损耗(检验过程损耗数量)
COL	qc_insp_detail	损耗率	decimal(9)	null	损耗率(损耗/送检数量,按 0~1 小数存)
COL	qc_insp_detail	条码	nvarchar(200)	null	条码(材料二维码/供应商标签条码,扫码全检的载体)
COL	qc_insp_detail	成品编号	nvarchar(120)	null	成品编号(件级成品/半成品编号,供扫码追溯)
COL	qc_insp_detail	生产日期	nvarchar(40)	null	生产日期(供应商生产/制造日期)
COL	qc_insp_detail	特采	bit(1)	NOT NULL	特采:勾选=该行走特采(让步接收)——检验审核不直接生成入库/退料,改为生成特采单;特采单审核通过后全部数量进采购入库单(不走退料)
COL	qc_insp_detail	备用1	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用2	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用3	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用4	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用5	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用6	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用7	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用8	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用9	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用10	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用11	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用12	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用13	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用14	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用15	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用16	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用17	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用18	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用19	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_insp_detail	备用20	nvarchar(1000)	null	预留扩展字段(未绑定)

===== QC_RETURN =====
-- yj_field (place, seq)
FIELD	detail	30	物料名称	物料名称	参照	160	E--V		INV	存货名称	存货名称			Material Name		1796
FIELD	detail	40	规格型号	规格型号	文本	140	E--V							Specification		1797
FIELD	detail	60	单位	单位	参照	70	E-H-		UOM	计量单位名称	计量单位名称			UOM		1798
FIELD	detail	70	单价	单价	小数	90	E--V							Unit Price		7547
FIELD	detail	80	退货数量	退货数量	小数	100	ER-V									1799
FIELD	detail	85	送检数量	送检数量	小数	100	---V									11585
FIELD	detail	88	特采	特采	是否	60	E--V									11587
FIELD	detail	90	计量单位	计量单位	参照	90	E--V		UOM	计量单位名称	计量单位名称			Unit of measurement		7546
FIELD	detail	100	采购订单行号	采购订单行号	文本	110	E--V									7545
FIELD	detail	120	报废数量	报废数量	小数	100	E-H-									7654
FIELD	detail	130	剩余数量	剩余数量	小数	100	E-H-									7655
FIELD	detail	206	批次号	批次号	文本	150	---V									11465
FIELD	header	70	退货类型	退货类型	下拉框	110	E--V						SELECT v FROM (VALUES (N'退供应商'),(N'报废'),(N'让步接收')) AS t(v)			7651
FIELD	header	90	退货原因	退货原因	文本	260	E--V							Reason for return		1789
FIELD	header	100	经手人	经手人	参照	100	E--V		EMP	员工名称	员工名称			Person in charge		1790
FIELD	header	120	审核人	审核人	参照	90	---V		EMP	员工名称	员工名称			Approved by		1793
FIELD	header	130	审核时间	审核时间	文本	140	---V							Approved at		1794
FIELD	header	150	附件1	附件1	附件	220	E--V									9537
FIELD	header	160	附件2	附件2	附件	220	E--V									9538
FIELD	header	170	附件3	附件3	附件	220	E--V									9539
FIELD	header	180	附件4	附件4	附件	220	E--V									9540
FIELD	header	190	附件5	附件5	附件	220	E--V									9541
FIELD	header	200	附件6	附件6	附件	220	E--V									9542
FIELD	header,detail	140	备注	备注	文本	220	E--V							Remark		1791
FIELD	query,detail	20	物料编码	物料编码	参照	120	ER-V		INV	存货编码	存货名称			Material Code		1795
FIELD	query,detail	110	不良原因	不良原因	参照	150	E--V		REJECT	不合格原因	不合格原因					7653
FIELD	query,header	10	单据编号	单据编号	文本	140	-R-V							Document Number		1785
FIELD	query,header	20	单据日期	单据日期	日期	120	ER-V							Document Date		1786
FIELD	query,header	30	检验单号	检验单号	参照	140	E--V		QC_INSP	单据编号	单据编号					1787
FIELD	query,header	40	采购订单号	采购订单号	文本	150	E--V							Purchase Order Number		7544
FIELD	query,header	50	批次号	批次号	文本	160	---V									11464
FIELD	query,header	60	供应商	供应商	参照	180	E--V		GFDA	mc	mc			Vendor		1788
FIELD	query,header	80	仓库	仓库	参照	150	E--V		WH	仓库名称	仓库名称			Warehouse		7652
FIELD	query,header	110	单据状态	单据状态	文本	90	---V							Doc status		1792
-- config.json -> QC_RETURN.config.json len=0
COL	qc_return	id	int(4)	NOT NULL	
COL	qc_return	单据编号	nvarchar(120)	NOT NULL	单号(面板字段列)
COL	qc_return	单据日期	nvarchar(40)	null	
COL	qc_return	检验单号	nvarchar(120)	null	检验单号(来源来料检验单单号,审核自动生单/选单带入;2026-09-30 补列回补溯源)
COL	qc_return	供应商	nvarchar(400)	null	
COL	qc_return	退货原因	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_return	经手人	nvarchar(100)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_return	备注	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_return	单据状态	nvarchar(20)	NOT NULL	
COL	qc_return	审核人	nvarchar(100)	null	审核人(流程)(面板字段列)
COL	qc_return	审核时间	nvarchar(60)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_return	审批人	nvarchar(100)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_return	审批时间	nvarchar(60)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_return	asp_user1	nvarchar(100)	null	
COL	qc_return	asp_time1	datetime2(8)	null	
COL	qc_return	asp_user2	nvarchar(100)	null	
COL	qc_return	asp_time2	datetime2(8)	null	
COL	qc_return	asp_cancel	char(1)	null	
COL	qc_return	采购订单号	nvarchar(1000)	null	来源采购订单号(链路带入:采购订单→送料暂收→来料检验→暂收退回)
COL	qc_return	附件1	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_return	附件2	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_return	附件3	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_return	附件4	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_return	附件5	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_return	附件6	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	qc_return	批次号	nvarchar(100)	null	送料批次号:随链从来料检验单继承(退回单生单时带入),不重新取号、不可修改
COL	qc_return	退货类型	nvarchar(100)	null	退货类型(退供应商/报废/让步接收;与来料检验单行「处置方式」闭环)
COL	qc_return	仓库	nvarchar(200)	null	仓库(退回出库仓,参照仓库档案 WH,存仓库名称)
COL	qc_return	备用1	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用2	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用3	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用4	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用5	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用6	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用7	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用8	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用9	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用10	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用11	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用12	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用13	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用14	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用15	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用16	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用17	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用18	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用19	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return	备用20	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	id	int(4)	NOT NULL	
COL	qc_return_detail	单据编号	nvarchar(120)	NOT NULL	单号(面板字段列)
COL	qc_return_detail	物料编码	nvarchar(200)	null	
COL	qc_return_detail	物料名称	nvarchar(400)	null	
COL	qc_return_detail	规格型号	nvarchar(400)	null	
COL	qc_return_detail	单位	nvarchar(100)	null	
COL	qc_return_detail	退货数量	decimal(9)	null	
COL	qc_return_detail	批号	nvarchar(60)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	qc_return_detail	备注	nvarchar(400)	null	
COL	qc_return_detail	asp_user1	nvarchar(100)	null	
COL	qc_return_detail	asp_time1	datetime2(8)	null	
COL	qc_return_detail	asp_user2	nvarchar(100)	null	
COL	qc_return_detail	asp_time2	datetime2(8)	null	
COL	qc_return_detail	asp_cancel	char(1)	null	
COL	qc_return_detail	采购订单行号	nvarchar(1000)	null	对应采购订单行号(链路带入)
COL	qc_return_detail	计量单位	nvarchar(100)	null	计量单位(自检验行带入)
COL	qc_return_detail	单价	decimal(9)	null	单价(自检验行带入)
COL	qc_return_detail	批次号	nvarchar(100)	null	送料批次号(明细):随单头一致,不可手工修改
COL	qc_return_detail	不良原因	nvarchar(200)	null	不良原因(行级原因归类,参照不合格原因档案 REJECT;头「退货原因」为整单说明)
COL	qc_return_detail	报废数量	decimal(9)	null	报废数量(不合格中就地报废的量;与「退货数量」=退供应商分开记账)
COL	qc_return_detail	剩余数量	decimal(9)	null	剩余数量(本行退货后仍余的量;参照库入库行同名存储式字段)
COL	qc_return_detail	备用1	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用2	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用3	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用4	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用5	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用6	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用7	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用8	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用9	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用10	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用11	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用12	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用13	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用14	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用15	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用16	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用17	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用18	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用19	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	备用20	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	qc_return_detail	送检数量	decimal(9)	null	送检数量:来料检验单明细的送检数量(检验单审核自动生成本退料单时随链带入,只读);特采按钮按它填特采单「总数量」
COL	qc_return_detail	特采	bit(1)	NOT NULL	特采:勾选=该行做特采(让步接收)。本退料单**审核/审批通过**时,勾了的行逐行生成特采单(总数量=本行送检数量、不合格品数量=本行退货数量);特采单审批通过后全部数量进采购入库单(不走退料)

===== PURCHASE_IN =====
-- yj_field (place, seq)
FIELD	detail	20	存货名称	存货名称	参照	140	ER-V		INV	存货名称	存货名称			Inventory Name		1444
FIELD	detail	30	规格型号	规格型号	文本	140	E--V							Specification		1446
FIELD	detail	40	实收数量	实收数量	小数	110	ER-V							Actual received quantity		1447
FIELD	detail	50	计量单位	计量单位	下拉框	140	ER-V						SELECT v FROM (VALUES (N'件'),(N'kg'),(N'套'),(N'升')) AS t(v)	Unit of measurement		1448
FIELD	detail	60	实收数量2	实收数量2	小数	110	E--V							Paid-in quantity 2		1449
FIELD	detail	70	计量单位2	计量单位2	下拉框	140	E--V						SELECT v FROM (VALUES (N'件'),(N'kg'),(N'套'),(N'升')) AS t(v)	Unit of measurement 2		1450
FIELD	detail	80	单价	单价	小数	110	ER-V							Unit Price		1453
FIELD	detail	90	金额	金额	小数	110	E--V							Amount		1458
FIELD	detail	100	税率%	税率%	小数	110	E--V						SELECT v FROM (VALUES (N'0'),(N'3'),(N'6'),(N'9'),(N'13')) AS t(v)	Tax rate%		1454
FIELD	detail	110	含税单价	含税单价	小数	110	E--V							Unit price including tax		1457
FIELD	detail	120	含税金额	含税金额	小数	110	E--V							Incl. tax amt		1459
FIELD	detail	130	批号	批号	文本	120	E-H-							Lot No.		3898
FIELD	detail	140	是否来料检验	是否来料检验	下拉框	90	---V						SELECT v FROM (VALUES (N'是'),(N'否')) AS t(v)			7534
FIELD	detail	150	特采	特采	下拉框	90	---V						SELECT v FROM (VALUES (N'是'),(N'否')) AS t(v)			7813
FIELD	detail	160	行号	行号	文本	120	E-H-							Line No.		6943
FIELD	detail	170	现存量	现存量	小数	110	E--V							Current inventory		1462
FIELD	detail	180	商品id	商品id	文本	120	E-H-									6944
FIELD	detail	190	仓库	仓库	参照	140	ER-V		WH	仓库名称	仓库名称					11165
FIELD	detail	200	商品是否多单位	商品是否多单位	文本	120	E-H-									6945
FIELD	detail	210	商品是否序列号	商品是否序列号	文本	120	E-H-									6946
FIELD	detail	220	商品是否辅助属性	商品是否辅助属性	文本	120	E-H-									6947
FIELD	detail	230	商品是否保质期	商品是否保质期	文本	120	E-H-									6948
FIELD	detail	240	商品是否批次	商品是否批次	文本	120	E-H-									6949
FIELD	detail	250	仓库id	仓库id	文本	120	E-H-									6950
FIELD	detail	260	仓库启用仓位管理	仓库启用仓位管理	文本	120	E-H-									6952
FIELD	detail	270	仓位id	仓位id	文本	120	E-H-									6953
FIELD	detail	280	仓位名称	仓位名称	文本	120	E-H-									6954
FIELD	detail	290	采购订单行号	源单行号	文本	110	E--V									6997
FIELD	detail	300	辅助属性id	辅助属性id	文本	120	E-H-									6955
FIELD	detail	310	批次号	批次号	文本	150	---V									11467
FIELD	detail	320	辅助属性名称	辅助属性名称	文本	120	E-H-									6956
FIELD	detail	330	辅助属性编码	辅助属性编码	文本	120	E-H-									6957
FIELD	detail	340	辅助属性1id	辅助属性1id	文本	120	E-H-									6958
FIELD	detail	350	辅助属性1名称	辅助属性1名称	文本	120	E-H-									6959
FIELD	detail	360	辅助属性1编码	辅助属性1编码	文本	120	E-H-									6960
FIELD	detail	370	辅助属性2id	辅助属性2id	文本	120	E-H-									6961
FIELD	detail	380	辅助属性2名称	辅助属性2名称	文本	120	E-H-									6962
FIELD	detail	390	辅助属性2编码	辅助属性2编码	文本	120	E-H-									6963
FIELD	detail	400	辅助属性3id	辅助属性3id	文本	120	E-H-									6964
FIELD	detail	410	辅助属性3名称	辅助属性3名称	文本	120	E-H-									6965
FIELD	detail	420	辅助属性3编码	辅助属性3编码	文本	120	E-H-									6966
FIELD	detail	430	条形码	条形码	文本	120	E-H-									6967
FIELD	detail	440	产地	产地	文本	120	E-H-									6968
FIELD	detail	450	注册证号	注册证号	文本	120	E-H-									6969
FIELD	detail	460	生产许可证	生产许可证	文本	120	E-H-									6970
FIELD	detail	470	保质期到期日	保质期到期日	日期	120	E-H-									6971
FIELD	detail	480	有效期至	有效期至	文本	120	E-H-									6972
FIELD	detail	490	保质期类型	保质期类型	文本	120	E-H-									6973
FIELD	detail	500	保质期	保质期	文本	120	E-H-									6974
FIELD	detail	510	序列号清单	序列号清单	文本	120	E-H-									6975
FIELD	detail	520	序列号流转ID	序列号流转ID	文本	120	E-H-									6976
FIELD	detail	530	基本单位id	基本单位id	文本	120	E-H-									6977
FIELD	detail	540	基本单位名称	基本单位名称	文本	120	E-H-									6978
FIELD	detail	550	基本单位编码	基本单位编码	文本	120	E-H-									6979
FIELD	detail	560	单位id	单位id	文本	120	E-H-									6980
FIELD	detail	570	单位编码	单位编码	文本	120	E-H-									6981
FIELD	detail	580	辅助单位id	辅助单位id	文本	120	E-H-									6982
FIELD	detail	590	辅助单位编码	辅助单位编码	文本	120	E-H-									6983
FIELD	detail	600	换算率2	换算率2	文本	120	E-H-									6984
FIELD	detail	610	基本数量	基本数量	文本	120	E-H-									6985
FIELD	detail	620	库存基本数量	库存基本数量	文本	120	E-H-									6986
FIELD	detail	630	默认浮动数量	默认浮动数量	文本	120	E-H-									6987
FIELD	detail	640	辅助换算系数	辅助换算系数	文本	120	E-H-									6988
FIELD	detail	650	换算系数	换算系数	文本	120	E-H-									6989
FIELD	detail	660	折扣额	折扣额	文本	120	E-H-									6990
FIELD	detail	670	源单编号	源单编号	文本	120	E-H-									6991
FIELD	detail	680	源单类型id	源单类型id	文本	120	E-H-									6992
FIELD	detail	690	源单类型名称	源单类型名称	文本	120	E-H-									6993
FIELD	detail	700	源单类型编码	源单类型编码	文本	120	E-H-									6994
FIELD	detail	710	源单内部id	源单内部id	文本	120	E-H-									6995
FIELD	detail	720	源单日期	源单日期	日期	120	E-H-									6996
FIELD	detail	730	源单分录id	源单分录id	文本	120	E-H-									6998
FIELD	detail	740	分录结算状态	分录结算状态	文本	120	E-H-									6999
FIELD	detail	750	折扣率%	折扣率%	文本	120	E-H-									7001
FIELD	detail	760	成本视图	成本视图	文本	120	E-H-									7002
FIELD	detail	770	单位成本视图	单位成本视图	文本	120	E-H-									7003
FIELD	detail	780	退货数量	退货数量	文本	120	E-H-									7004
FIELD	detail	790	价税合计本位币	价税合计本位币	文本	120	E-H-									7005
FIELD	detail	800	是否赠品	是否赠品	文本	120	E-H-									7006
FIELD	detail	810	送检数量	送检数量	小数	100	--H-									7687
FIELD	detail	820	部门名称	部门名称	文本	120	--H-							Department Name		7688
FIELD	detail	830	生产日期	生产日期	日期	110	--H-									7689
FIELD	detail	840	仓库名称_sp_name	仓库名称_sp_name	文本	120	E-H-									9217
FIELD	detail	850	换算率_conversion_rate	换算率_conversion_rate	文本	120	E-H-									9218
FIELD	detail	860	本次结算金额本位币	本次结算金额本位币	文本	120	E-H-									7000
FIELD	detail	870	备注	备注	文本	200	---V									9607
FIELD	header	40	汇率	汇率	小数	110	E--V							Exchange rate		1431
FIELD	header	90	附件1	附件1	附件	220	E--V									9525
FIELD	header	100	附件2	附件2	附件	220	E--V									9526
FIELD	header	110	附件3	附件3	附件	220	E--V									9527
FIELD	header	120	附件4	附件4	附件	220	E--V									9528
FIELD	header	130	附件5	附件5	附件	220	E--V									9529
FIELD	header	140	附件6	附件6	附件	220	E--V									9530
FIELD	header	160	采购订单号	采购订单号	文本	140	E--V							Purchase Order Number		7533
FIELD	header	180	创建时间	创建时间	日期	130	E--V							Created at		6858
FIELD	header	200	单据关闭状态	单据关闭状态	文本	130	E-H-									6860
FIELD	header	220	经手人编码	经手人编码	文本	130	E-H-							Handler code		6863
FIELD	header	230	交货方式	交货方式	文本	130	E--V									6865
FIELD	header	240	交货方式编码	交货方式编码	文本	130	E-H-									6866
FIELD	header	250	结算状态	结算状态	文本	130	E--V									6867
FIELD	header	260	修改时间	修改时间	日期	130	E-H-									6868
FIELD	header	270	创建人	创建人	文本	130	E-H-									6871
FIELD	header	280	修改人	修改人	文本	130	E-H-									6874
FIELD	header	300	ERP单号	ERP单号	文本	120	---V									7222
FIELD	header	310	转ERP操作人	转ERP操作人	文本	100	---V									7223
FIELD	header	320	转ERP时间	转ERP时间	日期	130	---V									7224
FIELD	header	330	是否已转ERP	是否已转ERP	文本	80	--H-									7228
FIELD	header	340	部门	部门	参照	130	E-H-		DEPT	部门名称	部门名称			Department		6881
FIELD	header	350	部门编码	部门编码	参照	130	E-H-		DEPT	部门编码	部门名称			Department Code		6882
FIELD	header	360	客户	客户	文本	130	E-H-							Customer		6884
FIELD	header	370	客户编码	客户编码	文本	130	E-H-							Customer Code		6885
FIELD	header	380	联系人电话	联系人电话	文本	130	E--V									6886
FIELD	header	390	联系人国家名称	联系人国家名称	文本	130	E-H-									6888
FIELD	header	400	联系人国家编码	联系人国家编码	文本	130	E-H-									6889
FIELD	header	410	联系人省份名称	联系人省份名称	文本	130	E-H-									6891
FIELD	header	420	联系人省份编码	联系人省份编码	文本	130	E-H-									6892
FIELD	header	430	联系人市区名称	联系人市区名称	文本	130	E-H-									6894
FIELD	header	440	联系人市区编码	联系人市区编码	文本	130	E-H-									6895
FIELD	header	450	联系人区县名称	联系人区县名称	文本	130	E-H-									6897
FIELD	header	460	联系人区县编码	联系人区县编码	文本	130	E-H-									6898
FIELD	header	470	联系地址	联系地址	文本	130	E-H-									6899
FIELD	header	480	付款方式	付款方式	文本	130	E-H-							Payment Method		6905
FIELD	header	490	预付金额	预付金额	文本	130	E-H-									6907
FIELD	header	500	付款账户	付款账户	文本	130	E-H-									6910
FIELD	header	510	保险金额	保险金额	文本	130	E-H-									6913
FIELD	header	520	到期日	到期日	日期	130	E--V									6916
FIELD	header	530	结算期限编码	结算期限编码	文本	130	E-H-									6918
FIELD	header	540	结算期限	结算期限	文本	130	E-H-									6919
FIELD	header	550	发货人	发货人	文本	130	E-H-							Shipper		6920
FIELD	header	560	发货电话	发货电话	文本	130	E-H-									6921
FIELD	header	570	发货地址	发货地址	文本	130	E-H-									6922
FIELD	header	580	发货国家名称	发货国家名称	文本	130	E-H-									6924
FIELD	header	590	发货国家编码	发货国家编码	文本	130	E-H-									6925
FIELD	header	600	发货省份名称	发货省份名称	文本	130	E-H-									6927
FIELD	header	610	发货省份编码	发货省份编码	文本	130	E-H-									6928
FIELD	header	620	发货市区名称	发货市区名称	文本	130	E-H-									6930
FIELD	header	630	发货市区编码	发货市区编码	文本	130	E-H-									6931
FIELD	header	640	发货区县名称	发货区县名称	文本	130	E-H-									6933
FIELD	header	650	发货区县编码	发货区县编码	文本	130	E-H-									6934
FIELD	header	660	仓库编码	仓库编码	参照	130	E-H-		WH	仓库编码	仓库名称			Warehouse Code		6939
FIELD	header	670	仓位	仓位	文本	130	E-H-									6941
FIELD	header	680	仓位编码	仓位编码	文本	130	E-H-									6942
FIELD	header	690	批次键	批次键	整数	80	--H-									7697
FIELD	header	700	单据状态_bill_status	单据状态_bill_status	文本	130	E-H-									9177
FIELD	header	710	审核时间_audit_time	审核时间_audit_time	日期	130	E-H-									9181
FIELD	header	730	创建人编码	创建人编码	文本	130	E-H-									6872
FIELD	header	730	创建人编码	创建人编码	文本	130	E-H-									9183
FIELD	header	750	修改人编码	修改人编码	文本	130	E-H-									6875
FIELD	header	750	修改人编码	修改人编码	文本	130	E-H-									9185
FIELD	header	760	审核人_auditor_name	审核人_auditor_name	文本	130	E-H-									9187
FIELD	header	780	审核人编码	审核人编码	文本	130	E-H-									6878
FIELD	header	780	审核人编码	审核人编码	文本	130	E-H-									9188
FIELD	header	800	未结算金额本位币	未结算金额本位币	文本	130	E-H-									6901
FIELD	header	800	未结算金额本位币	未结算金额本位币	文本	130	E-H-									9197
FIELD	header	820	付款方式编码	付款方式编码	文本	130	E-H-									6906
FIELD	header	820	付款方式编码	付款方式编码	文本	130	E-H-									9201
FIELD	header	840	付款账户编码	付款账户编码	文本	130	E-H-									6911
FIELD	header	840	付款账户编码	付款账户编码	文本	130	E-H-									9204
FIELD	query,detail	10	存货编码	存货编码	参照	120	ER-V		INV	存货编码	存货名称			Inventory Code		351
FIELD	query,header	10	单据日期	单据日期	日期	140	ER-V							Document Date		1427
FIELD	query,header	20	单据编号	单据编号	文本	140	ER-V							Document Number		1428
FIELD	query,header	30	入库类别	入库类别	下拉框	110	E--V						SELECT v FROM (VALUES (N'采购入库'),(N'其他入库')) AS t(v)	In type		8853
FIELD	query,header	50	供应商编码	供应商编码	参照	140	E--V		GFDA	dm	mc			Vendor code		1432
FIELD	query,header	60	供应商	供应商	参照	140	ER-V		GFDA	mc	mc			Vendor		1433
FIELD	query,header	70	匹配来源单号	匹配来源单号	文本	130	E-H-							Matched source no.		8812
FIELD	query,header	80	经手人	经手人	参照	140	E--V		EMP	员工名称	员工名称			Person in charge		1435
FIELD	query,header	150	验货人	验货人	参照	100	E-H-		EMP	员工名称	员工名称			Inspector		8811
FIELD	query,header	170	来源单据	来源单据	文本	110	E-H-							Source doc		8813
FIELD	query,header	190	来源单号	来源单号	文本	120	E-H-							Source no.		8814
FIELD	query,header	210	销售订单号	销售订单号	文本	130	E-H-							Sales order no.		8815
FIELD	query,header	290	批次号	批次号	文本	160	---V									11466
-- config.json -> PURCHASE_IN.config.json len=0
COL	bd_purchase_in	id	int(4)	NOT NULL	
COL	bd_purchase_in	单据日期	date(3)	null	
COL	bd_purchase_in	单据编号	nvarchar(400)	null	单号(面板字段列)
COL	bd_purchase_in	业务类型	nvarchar(200)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	币种	nvarchar(200)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	汇率	decimal(9)	null	
COL	bd_purchase_in	供应商编码	nvarchar(400)	null	
COL	bd_purchase_in	供应商	nvarchar(400)	null	
COL	bd_purchase_in	供应商简称	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	经手人	nvarchar(400)	null	
COL	bd_purchase_in	项目	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	外部单据号	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	采购订单号	nvarchar(400)	null	
COL	bd_purchase_in	合同号	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	资金批次	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	采购类型	nvarchar(200)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	合同号最新	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	备注	nvarchar(1000)	null	
COL	bd_purchase_in	单据状态	nvarchar(20)	NOT NULL	
COL	bd_purchase_in	审核人	nvarchar(100)	null	审核人(流程)(面板字段列)
COL	bd_purchase_in	审核时间	datetime2(8)	null	
COL	bd_purchase_in	审批人	nvarchar(100)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	审批时间	datetime2(8)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	asp_user1	nvarchar(100)	null	
COL	bd_purchase_in	asp_time1	datetime2(8)	null	
COL	bd_purchase_in	asp_user2	nvarchar(100)	null	
COL	bd_purchase_in	asp_time2	datetime2(8)	null	
COL	bd_purchase_in	asp_cancel	char(1)	null	
COL	bd_purchase_in	验货人	nvarchar(200)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	匹配来源单号	nvarchar(200)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	来源单据	nvarchar(200)	null	
COL	bd_purchase_in	来源单号	nvarchar(200)	null	
COL	bd_purchase_in	销售订单号	nvarchar(200)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	入库类别	nvarchar(200)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	金额	nvarchar(1000)	null	
COL	bd_purchase_in	创建时间	nvarchar(1000)	null	
COL	bd_purchase_in	单据状态2	nvarchar(1000)	null	
COL	bd_purchase_in	单据关闭状态	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	供应商id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	经手人id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	经手人编码	nvarchar(1000)	null	
COL	bd_purchase_in	交货方式id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	交货方式	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	交货方式编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	结算状态	nvarchar(1000)	null	
COL	bd_purchase_in	修改时间	nvarchar(1000)	null	
COL	bd_purchase_in	审核时间2	nvarchar(1000)	null	
COL	bd_purchase_in	创建人id	nvarchar(1000)	null	采购入库单头表连接键(v_stock_movement 第1路)
COL	bd_purchase_in	创建人	nvarchar(1000)	null	
COL	bd_purchase_in	创建人编码	nvarchar(1000)	null	
COL	bd_purchase_in	修改人id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	修改人	nvarchar(1000)	null	
COL	bd_purchase_in	修改人编码	nvarchar(1000)	null	
COL	bd_purchase_in	审核人id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	审核人2	nvarchar(1000)	null	审核人(业务)(面板字段列)
COL	bd_purchase_in	审核人编码	nvarchar(1000)	null	
COL	bd_purchase_in	交易类型	nvarchar(1000)	null	
COL	bd_purchase_in	部门id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	部门	nvarchar(1000)	null	
COL	bd_purchase_in	部门编码	nvarchar(1000)	null	
COL	bd_purchase_in	客户id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	客户	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	客户编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人电话	nvarchar(1000)	null	
COL	bd_purchase_in	联系人国家id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人国家名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人国家编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人省份id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人省份名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人省份编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人市区id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人市区名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人市区编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人区县id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人区县名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系人区县编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	联系地址	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	未结算金额	nvarchar(1000)	null	
COL	bd_purchase_in	未结算金额本位币	nvarchar(1000)	null	
COL	bd_purchase_in	应收款余额	nvarchar(1000)	null	
COL	bd_purchase_in	上次欠款	nvarchar(1000)	null	
COL	bd_purchase_in	付款方式id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	付款方式	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	付款方式编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	预付金额	nvarchar(1000)	null	
COL	bd_purchase_in	整单折扣额	nvarchar(1000)	null	
COL	bd_purchase_in	付款账户id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	付款账户	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	付款账户编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	整单折扣率%	nvarchar(1000)	null	
COL	bd_purchase_in	保险金额	nvarchar(1000)	null	
COL	bd_purchase_in	商品分录	nvarchar(1000)	null	
COL	bd_purchase_in	币种id	nvarchar(1000)	null	
COL	bd_purchase_in	到期日	nvarchar(1000)	null	
COL	bd_purchase_in	结算期限id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	结算期限编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	结算期限	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货人	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货电话	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货地址	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货国家id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货国家名称	nvarchar(1000)	null	
COL	bd_purchase_in	发货国家编码	nvarchar(1000)	null	
COL	bd_purchase_in	发货省份id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货省份名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货省份编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货市区id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货市区名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货市区编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货区县id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货区县名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	发货区县编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	采购费用分录	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	付款信息分录	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	附件地址	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	仓库id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	仓库编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	仓位id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	仓位	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	仓位编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	ERP单号	nvarchar(200)	null	
COL	bd_purchase_in	转ERP操作人	nvarchar(100)	null	
COL	bd_purchase_in	转ERP时间	nvarchar(60)	null	
COL	bd_purchase_in	是否已转ERP	nvarchar(20)	null	
COL	bd_purchase_in	附件1	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	bd_purchase_in	附件2	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	bd_purchase_in	附件3	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	bd_purchase_in	附件4	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	bd_purchase_in	附件5	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	bd_purchase_in	附件6	nvarchar(1000)	null	单据附件列位(与送料暂收单同款:页面单格聚合,上传按序占位,文件实体存 yj_attachment)
COL	bd_purchase_in	批次号	nvarchar(100)	null	送料批次号:随链从送料暂收单/来料检验单继承(生单时带入),不重新取号、不可修改;库存台账 kucun.lot_no 按它记批号
COL	bd_purchase_in	批次键	int(4)	null	批次键:批次台账 yj_doc_batch.id;采购入库单审核时凭它取号并回填全链批次号
COL	bd_purchase_in	单据状态_bill_status	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	supplier_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	emp_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	delivery_type_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	审核时间_audit_time	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	creator_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	creator_number	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	modifier_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	modifier_number	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	auditor_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	审核人_auditor_name	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	auditor_number	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	dept_id	nvarchar(1000)	null	所属部门(关联 yj_dept.id)
COL	bd_purchase_in	customer_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	contact_country_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	contact_province_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	contact_city_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	contact_district_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	total_unsettle_amount_for	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	edit_pay_type_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	edit_pay_type_number	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	edit_pay_account_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	edit_pay_account_number	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	setting_term_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	dispatcher_country_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	dispatcher_province_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	dispatcher_city_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	dispatcher_district_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	bill_stock_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	bill_sp_id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bd_purchase_in	备用1	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用2	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用3	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用4	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用5	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用6	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用7	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用8	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用9	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用10	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用11	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用12	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用13	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用14	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用15	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用16	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用17	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用18	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用19	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bd_purchase_in	备用20	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	id	int(4)	NOT NULL	
COL	bl_purchase_in	单据编号	nvarchar(200)	null	单号(面板字段列)
COL	bl_purchase_in	存货名称	nvarchar(200)	null	
COL	bl_purchase_in	存货图片	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	规格型号	nvarchar(400)	null	
COL	bl_purchase_in	实收数量	decimal(9)	null	
COL	bl_purchase_in	计量单位	nvarchar(200)	null	
COL	bl_purchase_in	实收数量2	decimal(9)	null	
COL	bl_purchase_in	计量单位2	nvarchar(200)	null	
COL	bl_purchase_in	计量单位组合	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	换算率	decimal(9)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	单价	decimal(9)	null	
COL	bl_purchase_in	税率%	decimal(9)	null	
COL	bl_purchase_in	单价2	decimal(9)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	含税单价2	decimal(9)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	含税单价	decimal(9)	null	
COL	bl_purchase_in	金额	decimal(9)	null	
COL	bl_purchase_in	含税金额	decimal(9)	null	
COL	bl_purchase_in	费用调整	decimal(9)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	费用金额	decimal(9)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	现存量	decimal(9)	null	
COL	bl_purchase_in	现存量说明	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	产成品图片	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	备注	nvarchar(1000)	null	
COL	bl_purchase_in	asp_user1	nvarchar(100)	null	
COL	bl_purchase_in	asp_time1	datetime2(8)	null	
COL	bl_purchase_in	asp_cancel	char(1)	null	
COL	bl_purchase_in	asp_user2	nvarchar(100)	null	
COL	bl_purchase_in	asp_time2	datetime2(8)	null	
COL	bl_purchase_in	批号	nvarchar(60)	null	
COL	bl_purchase_in	存货编码	nvarchar(200)	null	
COL	bl_purchase_in	行号	nvarchar(1000)	null	
COL	bl_purchase_in	商品id	nvarchar(1000)	null	
COL	bl_purchase_in	商品是否多单位	nvarchar(1000)	null	
COL	bl_purchase_in	商品是否序列号	nvarchar(1000)	null	
COL	bl_purchase_in	商品是否辅助属性	nvarchar(1000)	null	
COL	bl_purchase_in	商品是否保质期	nvarchar(1000)	null	
COL	bl_purchase_in	商品是否批次	nvarchar(1000)	null	
COL	bl_purchase_in	仓库id	nvarchar(1000)	null	
COL	bl_purchase_in	仓库编码	nvarchar(1000)	null	
COL	bl_purchase_in	仓库启用仓位管理	nvarchar(1000)	null	
COL	bl_purchase_in	仓位id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	仓库名称_sp_name	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	仓位编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性1id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性1名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性1编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性2id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性2名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性2编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性3id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性3名称	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助属性3编码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	条形码	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	产地	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	注册证号	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	生产许可证	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	保质期到期日	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	有效期至	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	保质期类型	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	保质期	nvarchar(1000)	null	
COL	bl_purchase_in	序列号清单	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	序列号流转ID	nvarchar(1000)	null	
COL	bl_purchase_in	基本单位id	nvarchar(1000)	null	
COL	bl_purchase_in	基本单位名称	nvarchar(1000)	null	
COL	bl_purchase_in	基本单位编码	nvarchar(1000)	null	
COL	bl_purchase_in	单位id	nvarchar(1000)	null	
COL	bl_purchase_in	单位编码	nvarchar(1000)	null	
COL	bl_purchase_in	辅助单位id	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	辅助单位编码	nvarchar(1000)	null	
COL	bl_purchase_in	换算率2	nvarchar(1000)	null	
COL	bl_purchase_in	基本数量	nvarchar(1000)	null	
COL	bl_purchase_in	库存基本数量	nvarchar(1000)	null	
COL	bl_purchase_in	默认浮动数量	nvarchar(1000)	null	
COL	bl_purchase_in	辅助换算系数	nvarchar(1000)	null	
COL	bl_purchase_in	换算系数	nvarchar(1000)	null	
COL	bl_purchase_in	折扣额	nvarchar(1000)	null	
COL	bl_purchase_in	源单编号	nvarchar(1000)	null	
COL	bl_purchase_in	源单类型id	nvarchar(1000)	null	
COL	bl_purchase_in	源单类型名称	nvarchar(1000)	null	
COL	bl_purchase_in	源单类型编码	nvarchar(1000)	null	
COL	bl_purchase_in	源单内部id	nvarchar(1000)	null	
COL	bl_purchase_in	源单日期	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	源单行号	nvarchar(1000)	null	采购订单行号(链路带入;金蝶同步时落 src_seq;转ERP 推送为 src_seq)
COL	bl_purchase_in	源单分录id	nvarchar(1000)	null	
COL	bl_purchase_in	分录结算状态	nvarchar(1000)	null	
COL	bl_purchase_in	本次结算金额本位币	nvarchar(1000)	null	
COL	bl_purchase_in	折扣率%	nvarchar(1000)	null	
COL	bl_purchase_in	成本视图	nvarchar(1000)	null	
COL	bl_purchase_in	单位成本视图	nvarchar(1000)	null	
COL	bl_purchase_in	退货数量	nvarchar(1000)	null	
COL	bl_purchase_in	价税合计本位币	nvarchar(1000)	null	
COL	bl_purchase_in	是否赠品	nvarchar(1000)	null	
COL	bl_purchase_in	仓位名称	nvarchar(400)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	是否来料检验	nvarchar(20)	null	是否来料检验(本地MES维护;金蝶按商品档案检验方式自行触发,不推接口)
COL	bl_purchase_in	批次号	nvarchar(100)	null	送料批次号(明细):随单头一致,不可手工修改
COL	bl_purchase_in	送检数量	decimal(9)	null	送检数量(来源来料检验单,2026-09-21 补齐)
COL	bl_purchase_in	部门名称	nvarchar(400)	null	部门名称(来源来料检验单,2026-09-21 补齐)
COL	bl_purchase_in	生产日期	nvarchar(40)	null	生产日期(来源来料检验单,2026-09-21 补齐)
COL	bl_purchase_in	特采	nvarchar(20)	null	特采:是=本行由特采单(QC_TC_IN)审批通过后生成 —— 即来料检验判定为特采(让步接收)的物料,全部数量入库;否=普通来料检验合格入库或免检直达。来源:检验单明细「特采」开关经 特采单 闸门带下,生单时写入,只读
COL	bl_purchase_in	换算率_conversion_rate	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	cur_settle_amount_for	nvarchar(1000)	null	历史遗留英文列:无面板字段引用、本表该列全空(2026-09-28 体检)——见《数据库规范》阶段 3 清理候选
COL	bl_purchase_in	仓库	nvarchar(2000)	null	
COL	bl_purchase_in	备用1	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用2	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用3	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用4	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用5	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用6	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用7	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用8	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用9	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用10	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用11	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用12	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用13	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用14	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用15	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用16	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用17	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用18	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用19	nvarchar(1000)	null	预留扩展字段(未绑定)
COL	bl_purchase_in	备用20	nvarchar(1000)	null	预留扩展字段(未绑定)
