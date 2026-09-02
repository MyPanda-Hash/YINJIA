/* 研发管理全部面板+字段的英文翻译 */
USE HSDZ_MES;
SET NOCOUNT ON;
GO
-- 面板名翻译
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'panel', p.panel_name, 'en',
  CASE p.panel_name
    WHEN N'功能性滤效' THEN N'Filtration Efficiency'
    WHEN N'碱性' THEN N'Alkalinity'
    WHEN N'矿化' THEN N'Mineralization'
    WHEN N'抑菌' THEN N'Antibacterial'
    WHEN N'阻垢性能' THEN N'Scale Inhibition'
    WHEN N'RO保护' THEN N'RO Protection'
    WHEN N'浸泡安全' THEN N'Soaking Safety'
    WHEN N'压降精度' THEN N'Pressure Drop & Precision'
    WHEN N'产品信息表' THEN N'Product Information'
    WHEN N'成型工艺清单' THEN N'Molding Process List'
    WHEN N'成型配方' THEN N'Molding Formula'
    WHEN N'规格书' THEN N'Specification'
    WHEN N'组装BOM表' THEN N'Assembly BOM'
    WHEN N'组装工艺清单' THEN N'Assembly Process List'
    WHEN N'出货检验计划表' THEN N'Outgoing Inspection Plan'
    WHEN N'加标水配置记录表' THEN N'Spike Water Preparation'
    WHEN N'委托测试申请单' THEN N'Domestic Test Request'
    WHEN N'设备使用登记表' THEN N'Equipment Usage Log'
    WHEN N'仪器使用记录表' THEN N'Instrument Usage Log'
    WHEN N'工序派工单' THEN N'Process Dispatch'
    ELSE p.panel_name
  END, 'manual'
FROM yj_panel p
WHERE (p.module_group = N'研发管理' OR p.panel_code = 'DISPATCH')
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='panel' AND t.ref_key = p.panel_name AND t.locale = 'en');
GO
-- 字段标签翻译(全局共享:已有译名的跳过)
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT DISTINCT 'field', f.label, 'en',
  CASE f.label
    -- 通用
    WHEN N'备注' THEN N'Remarks'
    WHEN N'单位' THEN N'Unit'
    WHEN N'数量' THEN N'Quantity'
    WHEN N'状态' THEN N'Status'
    WHEN N'部门' THEN N'Department'
    WHEN N'项目' THEN N'Project'
    WHEN N'规格型号' THEN N'Specification'
    WHEN N'单据编号' THEN N'Doc No.'
    WHEN N'单据日期' THEN N'Doc Date'
    WHEN N'业务类型' THEN N'Business Type'
    WHEN N'生产车间' THEN N'Workshop'
    WHEN N'经手人' THEN N'Handler'
    WHEN N'计量单位' THEN N'UoM'
    WHEN N'班组' THEN N'Team'
    WHEN N'工人' THEN N'Worker'
    WHEN N'工序编码' THEN N'Process Code'
    WHEN N'工序名称' THEN N'Process Name'
    WHEN N'工作中心' THEN N'Work Center'
    WHEN N'设备' THEN N'Equipment'
    WHEN N'加工单号' THEN N'Work Order No.'
    WHEN N'加工类型' THEN N'Work Type'
    WHEN N'计划数量' THEN N'Plan Qty'
    WHEN N'已派工数量' THEN N'Dispatched Qty'
    WHEN N'派工数量' THEN N'Dispatch Qty'
    WHEN N'派工加工状态' THEN N'Dispatch Status'
    WHEN N'累计汇报数量' THEN N'Reported Qty'
    WHEN N'委外供应商' THEN N'Outsource Supplier'
    WHEN N'预开工日' THEN N'Plan Start'
    WHEN N'预完工日' THEN N'Plan End'
    -- 测试通用
    WHEN N'记录编号' THEN N'Record No.'
    WHEN N'测试日期' THEN N'Test Date'
    WHEN N'样品名称' THEN N'Sample Name'
    WHEN N'样品编号' THEN N'Sample No.'
    WHEN N'测试人员' THEN N'Tester'
    WHEN N'测试介质' THEN N'Test Media'
    WHEN N'测试项目' THEN N'Test Item'
    WHEN N'测试方法' THEN N'Test Method'
    WHEN N'测试时长(h)' THEN N'Test Duration(h)'
    -- 功能性滤效
    WHEN N'滤前浊度(NTU)' THEN N'Turbidity In(NTU)'
    WHEN N'滤后浊度(NTU)' THEN N'Turbidity Out(NTU)'
    WHEN N'滤效率(%)' THEN N'Efficiency(%)'
    WHEN N'流量(L/min)' THEN N'Flow(L/min)'
    WHEN N'压力(MPa)' THEN N'Pressure(MPa)'
    -- 碱性
    WHEN N'初始pH值' THEN N'Initial pH'
    WHEN N'终点pH值' THEN N'Final pH'
    WHEN N'碱度(mg/L)' THEN N'Alkalinity(mg/L)'
    WHEN N'水温(℃)' THEN N'Temp(℃)'
    WHEN N'持续时间(h)' THEN N'Duration(h)'
    -- 矿化
    WHEN N'钙含量(mg/L)' THEN N'Ca(mg/L)'
    WHEN N'镁含量(mg/L)' THEN N'Mg(mg/L)'
    WHEN N'钾含量(mg/L)' THEN N'K(mg/L)'
    WHEN N'锶含量(mg/L)' THEN N'Sr(mg/L)'
    WHEN N'偏硅酸(mg/L)' THEN N'Metasilicic Acid(mg/L)'
    -- 抑菌
    WHEN N'初始菌落(CFU)' THEN N'Initial CFU'
    WHEN N'终点菌落(CFU)' THEN N'Final CFU'
    WHEN N'抑菌率(%)' THEN N'Inhibition Rate(%)'
    WHEN N'菌种类型' THEN N'Bacteria Type'
    WHEN N'培养时间(h)' THEN N'Culture Time(h)'
    -- 阻垢
    WHEN N'阻垢率(%)' THEN N'Scale Rate(%)'
    WHEN N'钙硬度(mg/L)' THEN N'Ca Hardness(mg/L)'
    WHEN N'总碱度(mg/L)' THEN N'Total Alkalinity(mg/L)'
    -- RO保护
    WHEN N'RO膜压差(MPa)' THEN N'RO ΔP(MPa)'
    WHEN N'脱盐率(%)' THEN N'Salt Rejection(%)'
    WHEN N'产水量(L/h)' THEN N'Production(L/h)'
    WHEN N'回收率(%)' THEN N'Recovery(%)'
    -- 浸泡安全
    WHEN N'浸泡时间(h)' THEN N'Soak Time(h)'
    WHEN N'浊度(NTU)' THEN N'Turbidity(NTU)'
    WHEN N'COD(mg/L)' THEN N'COD(mg/L)'
    WHEN N'重金属' THEN N'Heavy Metal'
    WHEN N'色度(度)' THEN N'Chromaticity(deg)'
    -- 压降精度
    WHEN N'压降(MPa)' THEN N'Pressure Drop(MPa)'
    WHEN N'过滤精度(μm)' THEN N'Precision(μm)'
    WHEN N'气泡点(MPa)' THEN N'Bubble Point(MPa)'
    -- 产品信息
    WHEN N'产品编码' THEN N'Product Code'
    WHEN N'产品名称' THEN N'Product Name'
    WHEN N'产品类别' THEN N'Category'
    WHEN N'型号规格' THEN N'Model/Spec'
    WHEN N'材质' THEN N'Material'
    WHEN N'描述' THEN N'Description'
    -- 成型工艺
    WHEN N'工艺编号' THEN N'Process No.'
    WHEN N'工序顺序' THEN N'Sequence'
    WHEN N'设备名称' THEN N'Equipment Name'
    WHEN N'模具编号' THEN N'Mold No.'
    WHEN N'温度(℃)' THEN N'Temp(℃)'
    WHEN N'周期时间(s)' THEN N'Cycle Time(s)'
    WHEN N'材料类型' THEN N'Material Type'
    -- 成型配方
    WHEN N'配方编号' THEN N'Formula No.'
    WHEN N'材料名称' THEN N'Material Name'
    WHEN N'材料编码' THEN N'Material Code'
    WHEN N'配比(%)' THEN N'Ratio(%)'
    WHEN N'重量(g)' THEN N'Weight(g)'
    -- 规格书/检验计划
    WHEN N'文档名称' THEN N'Doc Name'
    WHEN N'版本号' THEN N'Version'
    WHEN N'文件名' THEN N'File Name'
    WHEN N'文件大小(KB)' THEN N'File Size(KB)'
    WHEN N'上传人' THEN N'Uploaded By'
    WHEN N'上传日期' THEN N'Upload Date'
    -- 组装BOM
    WHEN N'BOM编号' THEN N'BOM No.'
    WHEN N'父件编码' THEN N'Parent Code'
    WHEN N'父件名称' THEN N'Parent Name'
    WHEN N'子件编码' THEN N'Child Code'
    WHEN N'子件名称' THEN N'Child Name'
    WHEN N'位置' THEN N'Position'
    -- 组装工艺
    WHEN N'工位' THEN N'Workstation'
    WHEN N'工具/治具' THEN N'Tool/Fixture'
    WHEN N'标准时间(s)' THEN N'Std Time(s)'
    -- 实验室
    WHEN N'配制日期' THEN N'Prep Date'
    WHEN N'加标物名称' THEN N'Spike Name'
    WHEN N'浓度' THEN N'Concentration'
    WHEN N'溶剂' THEN N'Solvent'
    WHEN N'配制体积(mL)' THEN N'Volume(mL)'
    WHEN N'有效期至' THEN N'Expiry Date'
    WHEN N'配制人' THEN N'Preparer'
    WHEN N'申请单号' THEN N'Request No.'
    WHEN N'申请日期' THEN N'Request Date'
    WHEN N'委托部门' THEN N'Requesting Dept'
    WHEN N'申请人' THEN N'Applicant'
    WHEN N'样品数量' THEN N'Sample Qty'
    WHEN N'紧急程度' THEN N'Urgency'
    WHEN N'期望完成日期' THEN N'Expected Date'
    WHEN N'接收人' THEN N'Receiver'
    WHEN N'结果状态' THEN N'Result Status'
    WHEN N'登记编号' THEN N'Registration No.'
    WHEN N'使用日期' THEN N'Usage Date'
    WHEN N'设备编号' THEN N'Equipment No.'
    WHEN N'使用人' THEN N'User'
    WHEN N'开始时间' THEN N'Start Time'
    WHEN N'结束时间' THEN N'End Time'
    WHEN N'使用时长(h)' THEN N'Duration(h)'
    WHEN N'使用目的' THEN N'Purpose'
    WHEN N'使用前状态' THEN N'Condition Before'
    WHEN N'使用后状态' THEN N'Condition After'
    WHEN N'仪器名称' THEN N'Instrument Name'
    WHEN N'仪器型号' THEN N'Instrument Model'
    WHEN N'仪器编号' THEN N'Instrument No.'
    WHEN N'湿度(%RH)' THEN N'Humidity(%RH)'
    ELSE f.label
  END, 'manual'
FROM yj_field f
JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE (p.module_group = N'研发管理' OR p.panel_code = 'DISPATCH')
  AND NOT EXISTS (SELECT 1 FROM yj_translation t WHERE t.scope='field' AND t.ref_key = f.label AND t.locale = 'en');
GO
DECLARE @p int = (SELECT COUNT(*) FROM yj_translation WHERE scope='panel' AND locale='en' AND ref_key IN (SELECT panel_name FROM yj_panel WHERE module_group=N'研发管理' OR panel_code='DISPATCH'));
DECLARE @f int = (SELECT COUNT(*) FROM yj_translation WHERE scope='field' AND locale='en');
PRINT N'翻译完成: 面板=' + CAST(@p AS nvarchar(10)) + N' 字段(累计)=' + CAST(@f AS nvarchar(10));
GO
