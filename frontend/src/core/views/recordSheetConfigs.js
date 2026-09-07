/**
 * recordSheetConfigs.js — 文书面板配置(数据记录表 7 张 + 实验室使用记录表 4 张)
 * 按各 Excel 原表逐表复刻;key = yj_field 的 label(中文数据键),由 RecordSheetPanels.vue 统一渲染。
 * 结构:
 *   headMode —— 'report'(默认:公司名+大标题+右侧信息块的报告头) | 'plain'(标题条+副标题行的登记表版式)
 *   grid —— 整页共用列网格(Excel 原表各列宽度 px):报告头/条件区/数据表全部用这套列宽,竖线全页对齐
 *   head {title, infoLabel, infoValue} —— report 版式报告头三段列跨度(大标题|信息标签|信息值),合计 = grid 列数
 *   info —— report 版式右侧信息块行(缺省=密级/适用范围/测试负责人/报告编号;委托单自定义 文件管理人/密级/文件使用范围)
 *   docNoDefault —— 文档编号缺省(默认 YJ-PD-01;委托单 YJ-RIR001)
 *   titleFromKey/titleSuffix —— 标题由头字段派生(如 申请单类型+'-测试申请单')
 *   plainTitle/plainTitleW —— plain 版式标题条文字与表格总宽(列宽取 cols.w 之和)
 *   subtitle {label,key,type,options} —— plain 版式副标题行(如 测试项目：/设备名称：/仪器名称/型号：)
 *   variantKey/variants —— 动态列变体:按头字段值切换列集(加标水 3 种测试项目/委托单 2 种类型)
 *   sections[{bar, rows[]}] —— row: {label,key,type:'text|area'} 或 {label,cells:[{key,ph,span}](多值格)}
 *   waterColspans(碱性) —— 原水水质条 6 指标格各自跨的网格列数(Excel C:D/E/F:H/I:J/K:L/M:N)
 *   soakColspans(浸泡安全) —— 特例块值区跨度(Excel D/E/F:G)
 *   dataTables[{bar,subHeads[],cols[{key,label,span,group,area,w}],charts,footerNote}] —— 数据记录表(两级表头:同 group 合并)
 *   conclusion{bar,key} —— 结论区(Excel 无结论区的表不配置)
 *   seedRows(浸泡安全) —— 标准卫生项目 17 行(新增草稿自动预填)
 */
import { SPEC_TEST_LIB } from './specTestLib'

export const recordSheetConfigs = {
  RD_ALKALINE: {
    titlePlaceholder: '伊可普碱性寿命测试',
    grid: [115, 80, 93, 98, 84, 90, 90, 90, 90, 70, 70, 85, 128],
    head: { title: 11, infoLabel: 1, infoValue: 1 },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '测试时间', key: '测试时间', type: 'text' },
        { label: '炭棒尺寸', key: '炭棒尺寸', type: 'text' },
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '测试仪器', key: '测试仪器', type: 'text' },
        { label: '测试装置及工位', key: '测试装置及工位', type: 'area' },
        { label: '测试方式', key: '测试方式', type: 'area' },
      ], waterStrip: true },
    ],
    waterColspans: [2, 1, 3, 2, 2, 2],
    dataTables: [
      { bar: '3.测试数据', subHeads: [
          { label: '浸泡24H口感测试(浸泡水量15.8ml）', span: 9 },
          { label: '离子分析（mg/L)', span: 4 },
        ], cols: [
          { key: '测试时间', label: '测试时间' },
          { key: '测试流速（L/min）', label: '测试流速\n（L/min）' },
          { key: '杯数(接水量100ml)', label: '杯数(接水量100ml)' },
          { key: '水温（℃）', label: '水温℃' },
          { key: 'RO水PH', label: 'RO水PH' },
          { key: 'RO水TDS', label: 'RO水TDS' },
          { key: '滤芯出水PH', label: '滤芯出水PH' },
          { key: '滤芯出水TDS', label: '滤芯出水TDS' },
          { key: 'PH提升值', label: 'PH提升值' },
          { key: '钠', label: '钠' },
          { key: '镁', label: '镁' },
          { key: '钾', label: '钾' },
          { key: '钙', label: '钙' },
        ]},
    ],
  },

  RD_MINERAL: {
    titlePlaceholder: '伊可普 RO后置矿化滤芯 纯水寿命测试',
    grid: [170, 170, 170, 170, 170],
    head: { title: 3, infoLabel: 1, infoValue: 1 },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '产品规格', key: '产品规格', type: 'text' },
        { label: '本次试验目的', key: '本次试验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '测试仪器', key: '测试仪器', type: 'text' },
        { label: '测试装置', key: '测试装置', type: 'area' },
        { label: '测试标准', key: '测试标准', type: 'text' },
        { label: '测试方法', key: '测试方法', type: 'area' },
      ]},
    ],
    // 矿化:4 个指标块共用一个明细表(指标字段区分),每块右侧复刻 Excel 散点图
    dataTables: [
      { bar: '3.数据记录表', metric: '锶 mg/L', cols: [
          { key: '指标', label: '锶 mg/L', hiddenCol: true },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量L', label: '累计流量L' },
          { key: 'RO出水', label: 'RO出水', group: '锶 mg/L' },
          { key: '浸泡30min', label: '浸泡30min', group: '锶 mg/L' },
          { key: '浸泡30min煮沸晾凉', label: '浸泡30min煮沸晾凉', group: '锶 mg/L' },
        ], charts: true },
      { bar: '', metric: '偏硅酸 mg/L', cols: [
          { key: '指标', label: '偏硅酸 mg/L', hiddenCol: true },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量L', label: '累计流量L' },
          { key: 'RO出水', label: 'RO出水', group: '偏硅酸 mg/L' },
          { key: '浸泡30min', label: '浸泡30min', group: '偏硅酸 mg/L' },
          { key: '浸泡30min煮沸晾凉', label: '浸泡30min煮沸晾凉', group: '偏硅酸 mg/L' },
        ], charts: true },
      { bar: '', metric: 'PH', cols: [
          { key: '指标', label: 'PH', hiddenCol: true },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量L', label: '累计流量L' },
          { key: 'RO出水', label: 'RO出水', group: 'PH' },
          { key: '浸泡30min', label: '浸泡30min', group: 'PH' },
          { key: '浸泡30min煮沸晾凉', label: '浸泡30min煮沸晾凉', group: 'PH' },
        ], charts: true },
      { bar: '', metric: 'TDS', cols: [
          { key: '指标', label: 'TDS', hiddenCol: true },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量L', label: '累计流量L' },
          { key: 'RO出水', label: 'RO出水', group: 'TDS' },
          { key: '浸泡30min', label: '浸泡30min', group: 'TDS' },
          { key: '浸泡30min煮沸晾凉', label: '浸泡30min煮沸晾凉', group: 'TDS' },
        ], charts: true },
    ],
  },

  RD_ANTIBACT: {
    titlePlaceholder: '集芈（康立根抑菌项目）',
    grid: [117, 117, 117, 117, 117, 117, 93, 102],
    head: { title: 6, infoLabel: 1, infoValue: 1 },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '测试标准', key: '测试标准', type: 'text' },
        { label: '测试时间', key: '测试时间', type: 'text' },
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '试验用水', key: '试验用水', type: 'text' },
        { label: '测试装置/设备', key: '测试装置/设备', type: 'text' },
        { label: '冲水方式', key: '冲水方式', type: 'text' },
        { label: '测试方法', key: '测试方法', type: 'area' },
      ]},
    ],
    dataTables: [
      { bar: '3.数据记录表', cols: [
          { key: '测试日期', label: '测试日期' },
          { key: '样品信息', label: '样品信息', span: 3, area: true },
          { key: '累计流量（L）', label: '累计流量\n（L）' },
          { key: '原液浓度（cfu/ml）', label: '原液浓度\n（cfu/ml）' },
          { key: '活性氧化铝（cfu/ml）', label: '活性氧化铝\n（cfu/ml）' },
          { key: '去除率（%）', label: '去除率\n（%）' },
        ]},
    ],
    conclusion: { bar: '4.测试结论', key: '数据结论' },
  },

  RD_SCALE: {
    titlePlaceholder: '阻垢炭棒阻垢率测试',
    grid: [125, 125, 125, 125, 125, 125, 125, 125, 125, 125, 125],
    head: { title: 6, infoLabel: 1, infoValue: 4 },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '炭棒尺寸', key: '炭棒尺寸', type: 'text' },
        { label: '特殊配方', cells: [
          { key: '特殊配方1', ph: '1#HPφ0.8mm-8g(1:2)', span: 3 },
          { key: '特殊配方2', ph: '2#HPφ0.8mm-8g(1.1:1)', span: 3 },
          { key: '特殊配方3', ph: '3#HPφ1.2mm-12g(1.1:1)', span: 4 },
        ]},
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '加标水配置', key: '加标水配置', type: 'area' },
        { label: '测试方法', key: '测试方法', type: 'area' },
      ]},
    ],
    dataTables: [
      { bar: '3.数据记录表', cols: [
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量（L）', label: '累计流量（L）' },
          { key: '水温（℃）', label: '水温（℃）' },
          { key: '加标水硬度H0', label: '加标水硬度\nH0' },
          { key: '加标水烧开后硬度H1', label: '加标水烧开后硬度 H1' },
          { key: '出水硬度（0.8mm-8g(1:2)）', label: '0.8mm-8g(1:2)', group: '过滤后出水烧开后硬度H2' },
          { key: '出水硬度（0.8mm-8g(1.1:1)）', label: '0.8mm-8g(1.1:1)', group: '过滤后出水烧开后硬度H2' },
          { key: '出水硬度（1.2mm-12g(1.1:1)）', label: '1.2mm-12g(1.1:1)', group: '过滤后出水烧开后硬度H2' },
          { key: '阻垢率（0.8mm-8g(1:2)）', label: '0.8mm-8g(1:2)', group: '阻垢率（%）' },
          { key: '阻垢率（0.8mm-8g(1.1:1)）', label: '0.8mm-8g(1.1:1)', group: '阻垢率（%）' },
          { key: '阻垢率（1.2mm-12g(1.1:1)）', label: '1.2mm-12g(1.1:1)', group: '阻垢率（%）' },
        ]},
    ],
  },

  RD_RO_PROTECT: {
    titlePlaceholder: '桌面机RO保护测试',
    grid: [158, 78, 106, 78, 78, 78, 78, 78, 78, 78],
    head: { title: 6, infoLabel: 2, infoValue: 2 },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试背景/目的', key: '测试背景/目的', type: 'area' },
        { label: '项目名称', key: '项目名称', type: 'text' },
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '试验用水', key: '试验用水', type: 'text' },
        { label: '测试装置/设备', key: '测试装置/设备', type: 'area', tall: true },
        { label: '测试方法', key: '测试方法', type: 'area' },
        { label: '冲水方式', key: '冲水方式', type: 'area' },
      ]},
      { bar: '3.测试对象信息', rows: [
        { label: '产品名/规格', key: '产品名/规格', type: 'text' },
        { label: '配方/工艺', key: '配方/工艺', type: 'area' },
      ]},
    ],
    dataTables: [
      { bar: '4.数据记录表', cols: [
          { key: '样品', label: '样品' },
          { key: '测试日期', label: '测试日期' },
          { key: '累计流量（L）', label: '累计流量\n（L）' },
          { key: '膜前压（MPa）', label: '膜前压（MPa）' },
          { key: '纯水流速(mL/min)', label: '纯水流速(mL/min)', group: '流速衰减' },
          { key: '废水流速(L/min)', label: '废水流速(L/min)', group: '流速衰减' },
          { key: '衰减率', label: '衰减率', group: '流速衰减' },
          { key: '原水（tds）', label: '原水\n（tds）', group: '脱盐率' },
          { key: '纯水（tds）', label: '纯水\n(tds)', group: '脱盐率' },
          { key: '脱盐率', label: '脱盐率', group: '脱盐率' },
        ]},
    ],
    conclusion: { bar: '5.测试结论', key: '测试结论' },
  },

  RD_SOAK: {
    titlePlaceholder: '伊可普高品质冰箱炭棒项目浸泡安全测试',
    grid: [177, 164, 204, 206, 200, 209],
    head: { title: 4, infoLabel: 1, infoValue: 1 },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '测试标准', key: '测试标准', type: 'area' },
        { label: '测试时间', key: '测试时间', type: 'text' },
        { label: '本次实验目的', key: '本次实验目的', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '浸泡水配置', key: '浸泡水配置', type: 'area' },
        { label: '测试方法', key: '测试方法', type: 'area', tall: true },
      ], soakBlocks: true },
    ],
    soakColspans: [1, 1, 2],
    dataTables: [
      { bar: '3.数据记录表', cols: [
          { key: '序号', label: '序号' },
          { key: '项目', label: '项目' },
          { key: '卫生要求', label: '卫生要求' },
          { key: '需求2（30*10*113）增加/改变值', label: '需求2（30*10*113）\n增加/改变值' },
          { key: '需求2（35*13*107）增加/改变值', label: '需求2（35*13*107）\n增加/改变值' },
          { key: '需求4（40.5*10*114）增加/改变值', label: '需求4（40.5*10*114）\n增加/改变值' },
        ]},
    ],
    conclusion: { bar: '4.实验结论', key: '实验结论' },
    // GB/T17219 标准 17 项卫生项目(Excel 预填;新增草稿明细为空时自动带出)
    seedRows: [
      { 序号: '1', 项目: '浑浊度', 卫生要求: '增加量≤0.2NTU' },
      { 序号: '2', 项目: '臭和味', 卫生要求: '浸泡后水无异臭、异味' },
      { 序号: '3', 项目: '肉眼可见物', 卫生要求: '浸泡后水不产生任何肉眼可见的碎片杂物等' },
      { 序号: '4', 项目: 'PH', 卫生要求: '改变量≤0.5' },
      { 序号: '5', 项目: '溶解性总固体', 卫生要求: '/' },
      { 序号: '6', 项目: '耗氧量（以O2计）', 卫生要求: '增加量≤1 mg/L' },
      { 序号: '7', 项目: '砷', 卫生要求: '增加量≤0.001 mg/L' },
      { 序号: '8', 项目: '铬', 卫生要求: '增加量≤0.005 mg/L' },
      { 序号: '9', 项目: '铝', 卫生要求: '增加量≤0.02  mg/L' },
      { 序号: '10', 项目: '铅', 卫生要求: '增加量≤0.001 mg/L' },
      { 序号: '11', 项目: '汞', 卫生要求: '增加量≤0.0001  mg/L' },
      { 序号: '12', 项目: '铁', 卫生要求: '增加量≤0.06  mg/L' },
      { 序号: '13', 项目: '锰', 卫生要求: '增加量≤0.02  mg/L' },
      { 序号: '14', 项目: '铜', 卫生要求: '增加量≤0.2  mg/L' },
      { 序号: '15', 项目: '锌', 卫生要求: '增加量≤0.2  mg/L' },
      { 序号: '16', 项目: '镍', 卫生要求: '增加量≤0.002  mg/L' },
      { 序号: '17', 项目: '银', 卫生要求: '增加量≤0.005  mg/L' },
    ],
  },

  RD_DROP_PREC: {
    titlePlaceholder: '伊可普冰箱滤芯（需求3）压降、一级精度测试',
    grid: [157, 280, 120, 100, 106, 106, 116, 116, 127, 116, 165],
    head: { title: 9, infoLabel: 1, infoValue: 1 },
    sections: [
      { bar: '1.基本信息', rows: [
        { label: '测试目的/背景', key: '测试目的/背景', type: 'area' },
        { label: '炭棒尺寸', key: '炭棒尺寸', type: 'text' },
        { label: '测试要求', key: '测试要求', type: 'area' },
      ]},
      { bar: '2.测试条件', rows: [
        { label: '测试装置及编号', key: '测试装置及编号', type: 'text' },
        { label: '测试方法', key: '测试方法', type: 'area', tall: true },
        { label: '测试用仪器/检出限', key: '测试用仪器/检出限', type: 'text' },
      ]},
    ],
    dataTables: [
      { bar: '3.数据记录表', cols: [
          { key: '测试时间', label: '测试时间' },
          { key: '配方', label: '配方', area: true },
          { key: '样品编号', label: '样品编号' },
          { key: '密度', label: '密度' },
          { key: '测试水温（℃）', label: '测试水温（℃）' },
          { key: '测试流速（L/min）', label: '测试流速（L/min）' },
          { key: '前压（kpa)', label: '前压（kpa)', group: '冲水10分钟后压降' },
          { key: '后压（kpa)', label: '后压（kpa)', group: '冲水10分钟后压降' },
          { key: '压差（kpa)', label: '压差（kpa)', group: '冲水10分钟后压降' },
          { key: '0.5-1μm颗粒物去除率-2min（%）', label: '0.5-1μm颗粒物去除率-2min（%）' },
          { key: '备注', label: '备注' },
        ]},
    ],
  },

  // ═══════════ 实验室使用记录表 4 面板(《3.实验室使用记录表》) ═══════════

  // 加标水配置记录表:3 种测试项目(除铅/除汞/除VOC)动态切换列集,明细为全字段并集
  RD_SPIKE_WATER: {
    headMode: 'plain',
    plainTitle: '加标水配置记录表',
    variantKey: '测试项目',
    variantOptions: [
      { value: 'NSF 53-除铅（PH8.5）', variant: '除铅' },
      { value: 'NSF 53-除汞（PH8.5）', variant: '除汞' },
      { value: 'NSF 53-除VOC', variant: '除VOC' },
    ],
    subtitle: { label: '测试项目：', key: '测试项目', type: 'select' },
    variants: {
      除铅: { cols: [
          { key: '测试日期', label: '测试日期', w: 90, rowspan: 2 },
          { key: '项目名称', label: '项目名称', w: 110, rowspan: 2 },
          { key: '测试装置', label: '测试装置', w: 100, rowspan: 2 },
          { key: '测试工位', label: '测试工位', w: 90, rowspan: 2 },
          { key: '配水量', label: '配水量\n（L）', w: 80, rowspan: 2 },
          { key: '配置用水', label: '配置用水', w: 90, rowspan: 2 },
          { key: '硫酸镁', label: '硫酸镁', w: 90, group: '试剂用量（g）' },
          { key: '二水氯化钙', label: '二水氯化钙', w: 100, group: '试剂用量（g）' },
          { key: '碳酸氢钠', label: '碳酸氢钠', w: 90, group: '试剂用量（g）' },
          { key: '4%次氯酸钠', label: '4%次氯酸钠', w: 110, group: '试剂用量（g）' },
          { key: '盐酸或氢氧化钠', label: '盐酸或氢氧化钠', w: 120, group: '试剂用量（g）' },
          { key: '可溶性铅', label: '可溶性铅', w: 90, group: '试剂用量（g）' },
          { key: '不可溶性铅', label: '不可溶性铅', w: 100, group: '试剂用量（g）' },
          { key: 'PH', label: 'PH\n8.5±0.25', w: 90, group: '加标水水质指标' },
          { key: 'TDS', label: 'TDS\n（mg/L）', w: 90, group: '加标水水质指标' },
          { key: '水温', label: '水温（℃）\n20±2.5℃', w: 100, group: '加标水水质指标' },
          { key: '负责人', label: '负责人', w: 70, rowspan: 2 },
      ]},
      除汞: { cols: [
          { key: '测试日期', label: '测试日期', w: 90, rowspan: 2 },
          { key: '项目名称', label: '项目名称', w: 120, rowspan: 2 },
          { key: '测试装置', label: '测试装置', w: 110, rowspan: 2 },
          { key: '测试工位', label: '测试工位', w: 100, rowspan: 2 },
          { key: '配水量', label: '配水量\n（L）', w: 90, rowspan: 2 },
          { key: '配置用水', label: '配置用水', w: 110, rowspan: 2 },
          { key: '碳酸氢钠', label: '碳酸氢钠', w: 100, group: '试剂用量（g）' },
          { key: '二水氯化钙', label: '二水氯化钙', w: 110, group: '试剂用量（g）' },
          { key: '盐酸或氢氧化钠', label: '盐酸或氢氧化钠', w: 130, group: '试剂用量（g）' },
          { key: '汞标准溶液', label: '汞标准溶液 \n1000mg/L', w: 130, group: '试剂用量（g）' },
          { key: 'PH', label: 'PH\n8.5±0.25', w: 90, group: '加标水水质指标' },
          { key: 'TDS', label: 'TDS（mg/L）\n200-500mg/L', w: 120, group: '加标水水质指标' },
          { key: '水温', label: '水温（℃）\n20±2.5℃', w: 100, group: '加标水水质指标' },
          { key: '浊度值', label: '浊度值（NTU）\n＜1NTU', w: 110, group: '加标水水质指标' },
          { key: '负责人', label: '负责人', w: 80, rowspan: 2 },
      ]},
      除VOC: { cols: [
          { key: '测试日期', label: '测试日期', w: 90, rowspan: 2 },
          { key: '项目名称', label: '项目名称', w: 120, rowspan: 2 },
          { key: '测试装置', label: '测试装置', w: 110, rowspan: 2 },
          { key: '测试工位', label: '测试工位', w: 100, rowspan: 2 },
          { key: '配水量', label: '配水量\n（L）', w: 90, rowspan: 2 },
          { key: '配置用水', label: '配置用水', w: 110, rowspan: 2 },
          { key: '氯化钠', label: '氯化钠（g）', w: 110, group: '试剂用量' },
          { key: '三氯甲烷储备液', label: '三氯甲烷储备液\n（1000mg/L）', w: 150, group: '试剂用量' },
          { key: 'PH', label: 'PH\n7.5±0.5', w: 90, group: '加标水水质指标' },
          { key: 'TDS', label: 'TDS（mg/L)\n200-500mg/L', w: 120, group: '加标水水质指标' },
          { key: '水温', label: '水温（℃）\n20.0±2.5℃', w: 100, group: '加标水水质指标' },
          { key: '浊度值', label: '浊度值（NTU）\n＜1NTU', w: 110, group: '加标水水质指标' },
          { key: '负责人', label: '负责人', w: 80, rowspan: 2 },
      ]},
    },
    dataTables: [{}],
  },

  // 内部委托测试申请单:开发性/品质委托 2 变体;报告头信息块=文件管理人/密级/文件使用范围
  RD_DOM_TEST: {
    headMode: 'report',
    docNoDefault: 'YJ-RIR001',
    info: [
      { label: '文件管理人', key: '文件管理人', type: 'text' },
      { label: '密级', key: '密级', type: 'select' },
      { label: '文件使用范围', key: '文件使用范围', type: 'select' },
    ],
    titleFromKey: '申请单类型',
    titleSuffix: '-测试申请单',
    variantKey: '申请单类型',
    variants: {
      '开发性': {
        grid: [45, 90, 90, 70, 200, 90, 110, 60, 260, 120, 120, 140, 140, 130, 60],
        head: { title: 12, infoLabel: 1, infoValue: 2 },
        cols: [
          { key: '序号', label: '序号', rowspan: 2 },
          { key: '日期', label: '日期', rowspan: 2 },
          { key: '申请人', label: '申请人', rowspan: 2 },
          { key: '背景/目的', label: '测试（检测）背景/目的', rowspan: 2, area: true },
          { key: '尺寸', label: '尺寸', group: '测试（检测）样品信息' },
          { key: '配方', label: '配方', group: '测试（检测）样品信息' },
          { key: '密度', label: '密度', group: '测试（检测）样品信息' },
          { key: '方法', label: '测试（检测）方法', rowspan: 2, area: true },
          { key: '标准', label: '测试（检测）标准', rowspan: 2 },
          { key: '目标', label: '测试（检测）目标', rowspan: 2 },
          { key: '组装方式', label: '组装方式', rowspan: 2 },
          { key: '样品处理', label: '测完后样品样品处理', rowspan: 2 },
          { key: '期望完成日期', label: '期望完成日期', rowspan: 2 },
          { key: '备注', label: '备注', rowspan: 2 },
        ],
      },
      '品质委托': {
        grid: [45, 90, 90, 70, 200, 90, 110, 90, 260, 120, 120, 140, 140, 80, 100, 100, 60],
        head: { title: 14, infoLabel: 1, infoValue: 2 },
        cols: [
          { key: '序号', label: '序号', rowspan: 2 },
          { key: '日期', label: '日期', rowspan: 2 },
          { key: '申请人', label: '申请人', rowspan: 2 },
          { key: '背景/目的', label: '测试（检测）背景/目的', rowspan: 2, area: true },
          { key: '产品编号', label: '产品编号', group: '测试（检测）样品信息' },
          { key: '产品名称', label: '产品名称', group: '测试（检测）样品信息' },
          { key: '生产批次', label: '生产批次', group: '测试（检测）样品信息' },
          { key: '方法', label: '测试（检测）方法', rowspan: 2, area: true },
          { key: '标准', label: '测试（检测）标准', rowspan: 2 },
          { key: '目标', label: '测试（检测）目标', rowspan: 2 },
          { key: '组装方式', label: '组装方式', rowspan: 2 },
          { key: '样品处理', label: '测完后样品样品处理', rowspan: 2 },
          { key: '紧急程度', label: '紧急程度', rowspan: 2 },
          { key: '期望完成日期', label: '期望完成日期', rowspan: 2 },
          { key: '预计完成日期', label: '预计完成日期', rowspan: 2 },
          { key: '备注', label: '备注', rowspan: 2 },
        ],
      },
    },
    dataTables: [{}],
  },

  // 设备使用登记表:7 台加标测试系统共用一版式,设备名称下拉
  RD_EQUIP_USE: {
    headMode: 'plain',
    plainTitle: '测试设备使用登记表',
    subtitle: { label: '设备名称：', key: '设备名称', type: 'select' },
    dataTables: [
      { cols: [
          { key: '使用日期', label: '使用日期', w: 100 },
          { key: '测试项目', label: '测试项目', w: 150 },
          { key: '测试标准', label: '测试标准', w: 130 },
          { key: '使用工位', label: '使用工位', w: 110 },
          { key: '设备状态', label: '设备状态\n（检查管路、阀门、启动是否正常）', w: 220 },
          { key: '使用人', label: '使用人', w: 100 },
          { key: '备注', label: '备注', w: 110 },
        ]},
    ],
  },

  // 仪器使用记录表:仪器名称/型号副标题 + 页脚须知
  RD_INSTR_USE: {
    headMode: 'plain',
    plainTitle: '实验室仪器使用记录表',
    subtitle: { label: '仪器名称/型号：', key: '仪器名称/型号', type: 'text' },
    dataTables: [
      { cols: [
          { key: '使用日期', label: '使用日期', w: 110 },
          { key: '起止时间', label: '起止时间', w: 120 },
          { key: '仪器状态', label: '仪器状态\n√/×', w: 90 },
          { key: '是否内校', label: '是否内校\n√/-', w: 90 },
          { key: '项目名称/内容', label: '项目名称/内容', w: 300 },
          { key: '用途', label: '用途', w: 120 },
          { key: '样品数量', label: '样品数量', w: 90 },
          { key: '使用人', label: '使用人', w: 100 },
          { key: '备注', label: '备注', w: 120 },
        ],
        footerNote: '请各位实验人员知悉：\n1.不进行使用登记人员，一经发现实验室负责人将不给与使用该仪器权限。\n2.态度恶劣者，实验室负责人将拒接该人员进入实验室。',
      },
    ],
  },

  // ═══════════ 产品文件 6 面板(《2.产品文件》) ═══════════

  // 成型工艺清单(炭棒工艺管控清单):纯表单——全页 11 列网格(A..K),所有行显式声明跨度
  // 结构:标题+右侧信息块(4行) / 产品基本信息(标签行+值行) / ·备注条 / 工序(双列表头+灌料0合并+长度|重量列标题+脱模) / 检验要求
  RD_MOLD_PROC: {
    headMode: 'report',
    staticTitle: '炭棒工艺管控清单',
    info: [
      { label: '表单管理人', key: '表单管理人', type: 'text' },
      { label: '密级', key: '密级', type: 'select' },
      { label: '使用范围', key: '使用范围', type: 'select' },
      { label: '版本号', key: '版本号', type: 'text' },
    ],
    grid: [150, 130, 80, 120, 90, 90, 60, 120, 80, 60, 60],
    head: { title: 7, infoLabel: 2, infoValue: 2 },
    sections: [
      { bar: '产品基本信息', rows: [
        { grid: [
          { label: '产品编号', span: 2 },
          { label: '产品名称', span: 2 },
          { label: '炭棒规格', span: 3 },
          { label: '产品管控类型', span: 2 },
          { label: '外观要求' },
          { label: '生产车间' },
        ]},
        { grid: [
          { key: '产品编号', span: 2 },
          { key: '产品名称', span: 2 },
          { key: '炭棒规格1' },
          { key: '炭棒规格2' },
          { key: '炭棒规格3' },
          { key: '产品管控类型', type: 'select', span: 2 },
          { key: '外观要求', type: 'select' },
          { key: '生产车间', type: 'select' },
        ]},
        { grid: [{ fixed: '·', span: 11 }] },
      ]},
      { bar: '工序', rows: [
        { grid: [
          { label: '工序', cap: true },
          { label: '工序管控要求', cap: true, span: 10 },
        ]},
        { grid: [
          { label: '灌料', rowspan: 5 },
          { label: '理论最低灌料重量g', span: 2 },
          { key: '理论最低灌料重量g', span: 4 },
          { fixed: '0', span: 4, rowspan: 4 },
        ]},
        { grid: [
          { label: '理论灌料中间值g', span: 2 },
          { key: '理论灌料中间值g', span: 4 },
        ]},
        { grid: [
          { label: '理论最高灌料重量g', span: 2 },
          { key: '理论最高灌料重量g', span: 4 },
        ]},
        { grid: [
          { label: '理论水分', span: 2 },
          { key: '理论水分', span: 4 },
        ]},
        { grid: [
          { label: '实际灌料重量计算公式', span: 2 },
          { key: '实际灌料重量计算公式', span: 9 },
        ]},
        { grid: [
          { label: '烧结' },
          { label: '烧结炉参数', span: 2 },
          { key: '烧结炉参数', span: 4 },
          { label: '烧结时间/调速器参数' },
          { key: '烧结时间调速器参数', span: 3 },
        ]},
        { grid: [
          { label: '热压' },
          { label: '热压要求', span: 2 },
          { key: '热压要求', span: 8 },
        ]},
        { grid: [
          { label: '冷却' },
          { label: '冷却参数设置', span: 2 },
          { key: '冷却参数设置', span: 8 },
        ]},
        { grid: [
          { label: '脱模', rowspan: 4 },
          { label: '长度要求', cap: true, span: 6 },
          { label: '重量要求', cap: true, span: 4 },
        ]},
        { grid: [
          { label: '最短长度mm', span: 2 },
          { key: '最短长度mm', span: 4 },
          { label: '最低重量g', span: 2 },
          { key: '最低重量g', span: 2 },
        ]},
        { grid: [
          { label: '中间值mm', span: 2 },
          { key: '中间值mm', span: 4 },
          { label: '中间值g', span: 2 },
          { key: '中间值g', span: 2 },
        ]},
        { grid: [
          { label: '最长长度mm', span: 2 },
          { key: '最长长度mm', span: 4 },
          { label: '最高重量g', span: 2 },
          { key: '最高重量g', span: 2 },
        ]},
      ]},
      { bar: '检验要求', rows: [
        { grid: [
          { label: '炭棒尺寸', rowspan: 2 },
          { label: '外径mm', span: 2 },
          { label: '内径mm', span: 4 },
          { label: '内孔要求', span: 4 },
        ]},
        { grid: [
          { key: '外径mm' },
          { key: '外径公差' },
          { key: '内径mm' },
          { key: '内径公差', span: 3 },
          { key: '内孔要求', span: 4 },
        ]},
        { grid: [
          { label: '密度管控', rowspan: 2 },
          { label: '管控要求', span: 2 },
          { label: '实际密度管控下限', span: 4 },
          { label: '实际密度管控上限', span: 4 },
        ]},
        { grid: [
          { key: '密度管控要求', span: 2, ph: '密度范围：~' },
          { key: '实际密度管控下限', span: 4 },
          { key: '实际密度管控上限', span: 4 },
        ]},
        { grid: [
          { label: '跌落强度', rowspan: 2 },
          { label: '高度cm', span: 2 },
          { label: '跌落次数', span: 4 },
          { label: '要求', span: 4 },
        ]},
        { grid: [
          { key: '跌落高度cm', span: 2 },
          { key: '跌落次数', span: 4 },
          { key: '跌落要求', span: 4 },
        ]},
        { grid: [
          { label: '抗压强度', rowspan: 2 },
          { label: '测试间距mm', span: 2 },
          { label: '压头下降速度mm/min', span: 4 },
          { label: '强度要求kgf', span: 4 },
        ]},
        { grid: [
          { key: '测试间距mm', span: 2 },
          { key: '压头下降速度', span: 4 },
          { key: '强度要求kgf', span: 4 },
        ]},
        { grid: [
          { label: '压降', rowspan: 2 },
          { label: '测试管路', span: 2 },
          { label: '测试流速L/min', span: 4 },
          { label: '压降标准kpa', span: 4 },
        ]},
        { grid: [
          { key: '压降测试管路', span: 2 },
          { key: '压降测试流速', span: 4 },
          { key: '压降标准kpa', span: 4 },
        ]},
      ]},
    ],
    dataTables: [],
  },
  // 成型配方(炭棒配方管控清单,源=产品工单-配方 12列+配方表13格):标签行/值行两行式
  RD_MOLD_FORMULA: {
    headMode: 'report',
    staticTitle: '炭棒配方管控清单',
    info: [
      { label: '表单管理人', key: '表单管理人', type: 'text' },
      { label: '密级', key: '密级', type: 'select' },
      { label: '使用范围', key: '使用范围', type: 'select' },
      { label: '版本号', key: '版本号', type: 'text' },
    ],
    grid: [101, 60, 109, 85, 44, 44, 68, 146, 64, 64, 121, 77, 57],
    head: { title: 7, infoLabel: 2, infoValue: 3 },
    sections: [
      { bar: '产品基本信息', rows: [
        { grid: [
          { label: '产品编号', span: 2 },
          { label: '产品名称', span: 2 },
          { label: '炭棒规格', span: 3 },
          { label: '产品管控类型' },
          { label: '外观要求', span: 2 },
          { label: '生产车间', span: 2 },
        ]},
        { grid: [
          { key: '产品编号', span: 2 },
          { key: '产品名称', span: 2 },
          { key: '炭棒规格1' },
          { key: '炭棒规格2' },
          { key: '炭棒规格3' },
          { key: '产品管控类型', type: 'select' },
          { key: '外观要求', type: 'select', span: 2 },
          { key: '生产车间', type: 'select', span: 2 },
        ]},
      ]},
    ],
    dataTables: [
      { bar: '配方表', autoSeqBar: true, totalCols: true, cols: [
          { key: '序号', label: 'No.' },
          { key: '物料种类', label: '物料种类', span: 2 },
          { key: '物料编号', label: '物料编号', span: 4 },
          { key: '物料名称', label: '物料名称', span: 3 },
          { key: '实际添加比例', label: '实际添加\n比例%' },
          { key: '单支物料含量', label: '单支\n物料含量g' },
          { key: '设计添加量', label: '设计添加\n量' },
        ]},
    ],
    tailSections: [
      { bar: '配料要求', rows: [
        { label: '配料要求', key: '配料要求', type: 'area' },
      ]},
    ],
  },

  // 组装BOM表(源=组装段BOM和工艺控制.docx):产品基本信息 + 修订记录 + 物料清单(30 种预置);源文档无信息块
  RD_ASM_BOM: {
    headMode: 'report',
    staticTitle: '组装BOM表',
    info: [],
    grid: [130, 390, 130, 390],
    head: { title: 2, infoLabel: 1, infoValue: 1 },
    sections: [
      { bar: '一、产品基本信息', rows: [
        { pairs: [
          { label: '产品编号', key: '产品编号', type: 'text' },
          { label: '产品名称', key: '产品名称', type: 'text' },
        ]},
        { pairs: [
          { label: '产品种类', key: '产品种类', type: 'text' },
          { label: '成品重量', key: '成品重量', type: 'text' },
        ]},
        { pairs: [
          { label: '整体规格（外径）', key: '整体规格外径', type: 'text' },
          { label: '整体规格（长度）', key: '整体规格长度', type: 'text' },
        ]},
      ]},
    ],
    dataTables: [
      { bar: '二、炭棒滤芯组装/包装物料清单', filterKey: '表区', filterVal: '物料清单', seedRows: [
          { 物料名: '炭棒', 物料规格: '外径： mm\n内径： mm\n长度： mm', 外观要求: '清洁、无破损、无压痕，无裂纹、无明显弯曲' },
          { 物料名: '阻垢棒', 物料规格: '外径： mm\n内径： mm\n长度： mm', 外观要求: '无脏污、破损' },
          { 物料名: '炭纤维', 物料规格: '外径： mm\n内径： mm\n长度： mm', 外观要求: '无脏污、破损、布接口无开裂' },
          { 物料名: '陶瓷', 物料规格: '外径： mm\n内径： mm\n长度： mm', 外观要求: '无脏污、破损' },
          { 物料名: '上端盖', 外观要求: '无脏污、破损、变形' },
          { 物料名: '下端盖', 外观要求: '无脏污、破损、变形' },
          { 物料名: '衔接件', 外观要求: '无脏污、破损、变形' },
          { 物料名: '堵塞', 外观要求: '无脏污、破损' },
          { 物料名: '螺丝', 外观要求: '无生锈、油污' },
          { 物料名: '垫片', 外观要求: '无脏污、破损、异色' },
          { 物料名: '密封圈', 外观要求: '无脏污、破损、批锋' },
          { 物料名: '无纺布', 外观要求: '无脏污、破损、褶皱' },
          { 物料名: '尼龙网套', 外观要求: '无脏污、破损、褶皱' },
          { 物料名: 'PP棉', 外观要求: '无脏污、破损' },
          { 物料名: '折叠棉', 外观要求: '无脏污、破损' },
          { 物料名: '防尘塞', 外观要求: '无脏污、破损' },
          { 物料名: '超滤筒', 外观要求: '无破损、无漏密封圈' },
          { 物料名: '说明书', 外观要求: '无脏污、破损' },
          { 物料名: '反冲洗垫片', 外观要求: '无脏污、破损' },
          { 物料名: '纸盒', 外观要求: '无脏污、破损' },
          { 物料名: '卡托', 外观要求: '无脏污、破损' },
          { 物料名: '气泡袋', 外观要求: '无脏污、破损' },
          { 物料名: '纸箱', 外观要求: '无脏污、破损' },
          { 物料名: '刀卡', 外观要求: '无脏污、破损' },
          { 物料名: '平卡', 外观要求: '无脏污、破损' },
          { 物料名: '标签', 外观要求: '无脏污、破损' },
          { 物料名: '复合袋', 外观要求: '无脏污、破损' },
          { 物料名: 'PE袋', 外观要求: '无脏污、破损' },
          { 物料名: 'T 筒', 外观要求: '无脏污、破损' },
        ], cols: [
          { key: '表区', label: '表区', hiddenCol: true, w: 90 },
          { key: '物料名', label: '物料名', w: 140 },
          { key: '物料编号', label: '物料编号', w: 130 },
          { key: '物料规格', label: '物料规格', w: 300, area: true },
          { key: '外观要求', label: '外观要求', w: 340 },
          { key: '用量', label: '用量', w: 130 },
        ]},
      { bar: '修订记录', filterKey: '表区', filterVal: '修订记录', cols: [
          { key: '表区', label: '表区', hiddenCol: true, w: 90 },
          { key: '序号', label: '序号', w: 60 },
          { key: '更改内容', label: '更改内容', w: 300, area: true },
          { key: '更改原因', label: '更改原因', w: 200 },
          { key: '更改时间', label: '更改时间', w: 130 },
          { key: '责任人', label: '责任人', w: 120 },
          { key: '备注', label: '备注', w: 230 },
        ]},
    ],
  },

  // 组装工艺清单:plain 清单(工序/控制内容/管控要求/检查比例);21 道工序预置(源=组装段BOM和工艺控制.docx)
  RD_ASM_PROC: {
    headMode: 'plain',
    plainTitle: '炭棒滤芯组装/包装段-关键工序控制清单',
    dataTables: [
      { seedRows: [
          { 工序: '无黑处理', 工序控制内容: '无黑时间', 管控要求: '将炭棒单层摆车无黑处理，破损、裂纹等不良挑出无黑处理时间：12-24小时', 检查比例: '随机取2支测试黑水' },
          { 工序: '机器除尘', 工序控制内容: '1.机器毛刷松紧度2.除尘后清洁效果', 管控要求: '', 检查比例: '3%' },
          { 工序: '投首', 工序控制内容: '尺寸：长度、内径、外径外观：表面、脱粉、强度', 管控要求: '尺寸：长度66-67mm,外径：56-57mm,内径：20.3-21.3mm切面平整，无锯齿纹，无明显缺角，无残留渣脱粉检查方法;用搓三次炭棒表面后，无继续有粉脱落为合格强度：用手捏炭棒切口，无捏碎、捏裂及疏松为合格', 检查比例: '尺寸：3%外观：3%' },
          { 工序: '手工包布/套网', 工序控制内容: '网/布尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '套网', 工序控制内容: '网尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '机器包布', 工序控制内容: '布尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '套PP棉', 工序控制内容: 'PP棉尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '套折叠棉', 工序控制内容: '折叠棉尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '粘端盖', 工序控制内容: '胶位胶量成品长度粘接歪斜', 管控要求: '1.点胶机温度：180±10度2.胶量:2.5±0.5g3.成品长度：252±0.5mm4.检查整个切面须有胶水粘附5.放台面比较，无歪斜（倾斜度不大于0.5mm)', 检查比例: '1.尺寸：1%2.胶位检查：1%3.外观：3%' },
          { 工序: '装垫片', 工序控制内容: '垫片尺寸、外观', 管控要求: '', 检查比例: '全检' },
          { 工序: '气检', 工序控制内容: '气检参数', 管控要求: '', 检查比例: '30%' },
          { 工序: '气检吹灰', 工序控制内容: '1.内孔2.外表面', 管控要求: '用气枪沿着炭棒内壁吹一圈及外表面一次', 检查比例: '100%' },
          { 工序: '加工超滤', 工序控制内容: '超滤棉与端盖装配合理性端盖/超滤质量', 管控要求: '检查端盖无明显刮花，无变形、破损超滤无漏密封圈、超滤丝无断裂在端盖内柱内边涂抹 一圈硅油，然后将超滤垂直放进胶柱内，超滤须装到位，密封圈不可移位在端盖内柱外缘口与滤滤接触处 轻点一圈302胶水固定，待胶水干燥后摆进箱内', 检查比例: '3%' },
          { 工序: '装防尘塞', 工序控制内容: '堵头质量漏装堵头', 管控要求: '检查防尘塞无破损、批锋每支产品装一个堵头不可漏装防尘塞', 检查比例: '全检' },
          { 工序: '检外观', 工序控制内容: '卫生端盖歪斜炭棒表面质量', 管控要求: '产品无胶丝、头发丝等卫生问题平放在台面上，端盖无歪斜不良炭棒无破损、裂纹、明显炭粉掉落', 检查比例: '全检' },
          { 工序: '塑封/检外观', 工序控制内容: '漏部件塑封质量', 管控要求: '检查防尘塞无漏装、破裂塑封无破洞、褶皱', 检查比例: '全检' },
          { 工序: '折盒子', 工序控制内容: '外观尺寸', 管控要求: '检查盒子无脏污、破损，折好摆在箱子内', 检查比例: '全检' },
          { 工序: '装气泡袋/装盒子', 工序控制内容: '气泡袋外观气泡袋尺寸数量', 管控要求: '将外观合格塑封好的产品装进气泡袋内，1个气泡袋装1支产品将装好气泡袋的产品装入盒子内，每个盒子装2支产品', 检查比例: '全检' },
          { 工序: '放说明书、反冲洗垫片', 工序控制内容: '数量：少装、多装漏部件', 管控要求: '检查每个盒子装2支装好气泡袋的产品检查说明书和垫片无破损、无脏污;每盒放1张说明书和1个反冲洗垫片', 检查比例: '全检' },
          { 工序: '扣盒盖/封胶纸', 工序控制内容: '1.配件数量2.封胶方式', 管控要求: '1.检查产品无漏装堵头、说明书、反冲洗垫片，然后将盒盖扣好2.用透明胶纸：十字交叉方式：盒宽面连接盒底封一圈+盒盖窄面封一条', 检查比例: '全检' },
          { 工序: '封箱', 工序控制内容: '1.装箱方式2.数量', 管控要求: '准备好纸箱，折好刀卡，将外观合格的产品端盖朝上竖放在纸箱内，具体方法：每排装6盒，装4排，每盒2支，每箱装48支，封箱方式为“工”字形', 检查比例: '全检' },
        ], cols: [
          { key: '工序', label: '工序', w: 130 },
          { key: '工序控制内容', label: '工序控制内容', w: 320, area: true },
          { key: '管控要求', label: '管控要求', w: 430, area: true },
          { key: '检查比例', label: '检查比例', w: 120 },
        ]},
    ],
  },

  // 规格书:通用模板(所有产品种类共用一套结构,规格书种类仅作单据分类)——
  // 4 页(规格书细分.xlsx):产品信息 / 修订记录 / 检验项目及标准 / 成品及包装运输
  // 检验项目及标准页:从标准库(测试项目汇总 26 类)勾选组装
  RD_SPEC_DOC: {
    headMode: 'report',
    staticTitle: '产品规格书',
    cover: {
      fields: [
        { label: '名 称', key: '名称' },
        { label: '编  号', key: '编号' },
        { label: '客户名', key: '客户名' },
        { label: '客户料号', key: '客户料号' },
        { label: '版  本', key: '版本' },
        { label: '日  期', key: '日期' },
      ],
      sign: [
        { label: '制订/日期', key: '制订日期' },
        { label: '审核/日期', key: '审核日期' },
        { label: '批准/日期', key: '批准日期' },
      ],
    },

    specTypes: ['飞利浦沐浴阻垢滤芯', '矿化烧结炭棒', '迈博瑞复合滤芯', '除铅炭棒', '抑菌炭棒', 'X14折叠复合滤芯', '碱性炭棒', '矿化炭棒', '多功能炭棒'],
    pages: [
      { title: '产品信息' },
      { title: '修订记录' },
      { title: '检验项目及标准' },
      { title: '成品及包装运输' },
    ],
    // 网格宽 = 真实 A4 纸宽(210mm @96dpi = 794px):封面/修订记录/检验项目及标准/成品及包装运输
    // 全部按 k=网格宽÷各自设计宽 等比缩放,整份规格书以 A4 原比例呈现(字体不出框)
    grid: [69, 207, 69, 166, 69, 69, 69, 76],
    head: { title: 5, infoLabel: 1, infoValue: 2 },
    sections: [
      // 第 2 页(检验项目及标准):1.适用范围 / 2.整体规格参数 / 3.产品主要性能(源 docx 同页,先于 4.检验标准表)
      { page: 2, doc: true, rows: [
          { label: '1.适用范围', key: '适用范围' },
          { label: '2.整体规格参数', key: '整体规格参数' },
          { label: '3.产品主要性能', key: '产品主要性能' },
        ]},
    ],
    // 第 4 页(成品及包装运输):5.关键物料列表(数据表)在上,6-8 章节行在下(tailDoc=数据表之后渲染)
    tailDocSections: [
      { page: 3, doc: true, rows: [
        { label: '6.包装方式', key: '包装方式', area: true },
        { label: '7.运输要求', key: '运输要求', area: true },
        { label: '8.存储环境', key: '存储环境', area: true },
      ]},
    ],
    dataTables: [
      { page: 1, pageTitle: '修订记录', filterKey: '表区', filterVal: '修订记录',
        design: { titleSize: 21, titleTop: 24, titleGap: 61, headerH: 44, rowH: 43, fontSize: 16 },
        cols: [
          { key: '表区', label: '表区', hiddenCol: true, w: 46 },
          { key: '序号', label: '序号', w: 46 },
          { key: '更改内容', label: '更改内容', w: 140 },
          { key: '更改原因', label: '更改原因', w: 108 },
          { key: '更改时间', label: '更改时间', w: 97 },
          { key: '责任人', label: '责任人', w: 72 },
          { key: '备注', label: '备注', w: 161 },
        ]},
      // 检验项目及标准:分组式(序号|检验项目(组+子项目,检验项目表头跨 2 列)|检验要求|检验方法|检验依据)
      // 列宽=设计图 695×1019 画布测量(43/93/73/129/241/83);行高由文本驱动;标准库=测试项目汇总.xlsx 26 组 48 子项
      { page: 2, bar: '4.产品性能检验项目及检验标准', filterKey: '表区', filterVal: '检验要求', lib: true,
        design: { headerH: 32, fontSize: 13, groupCol: true },
        cols: [
          { key: '表区', label: '表区', hiddenCol: true, w: 43 },
          { key: '序号', label: '序号', w: 43, align: 'center' },
          { key: '检验项目', label: '检验项目', w: 93, align: 'center' },
          { key: '检验子项', label: '检验子项', w: 73, align: 'center', groupSub: true },
          { key: '检验要求', label: '检验要求', w: 129, align: 'left', area: true },
          { key: '检验方法', label: '检验方法', w: 241, align: 'left', area: true },
          { key: '检验依据', label: '检验依据', w: 83, align: 'left', area: true },
        ]},
      { page: 3, bar: '5.关键物料列表', filterKey: '表区', filterVal: '物料清单', cols: [
          { key: '表区', label: '表区', hiddenCol: true },
          { key: '序号', label: '序号' },
          { key: '物料编码', label: '物料编码' },
          { key: '物料名称', label: '物料名称', span: 2 },
          { key: '规格参数', label: '规格参数', span: 2, area: true },
          { key: '数量', label: '数量' },
          { key: '备注', label: '备注' },
        ]},
    ],
    // 检验项目标准库(分组):SPEC_TEST_LIB 由 tools/gen-spec-testlib.cjs 从《测试项目汇总.xlsx》生成
    testLib: SPEC_TEST_LIB,
    // 7./8. 通用文案默认预填(《规格书示例》通行文本;新单草稿进入编辑且字段为空时带入)
    sectionDefaults: {
      '运输要求': '产品在运输中应避免冲击、挤压、雨淋、受潮及化学品腐蚀。',
      '存储环境': '产品应贮存在通风良好、干燥的室内，不得与酸、碱及有腐蚀性的物品放置一起。',
    },
  },

  // 出货检验计划表(出货检验项目控制计划):全页共用 10 列网格(与数据表同列)——
  // 产品编号↔控制项目、客户名↔控制标准及要求、版本号↔检测频率/取样方式,上下总宽一致
  RD_INSP_PLAN: {
    headMode: 'report',
    docNoDefault: 'YJ-RD001',
    titlePlaceholder: '伊可普碱性炭棒出货检验项目控制计划',
    info: [
      { label: '版本号', key: '版本号', type: 'text' },
      { label: '密级', key: '密级', type: 'select' },
    ],
    grid: [110, 130, 120, 320, 70, 270, 120, 110, 170, 110],
    head: { title: 6, infoLabel: 2, infoValue: 2 },
    sections: [
      { rows: [
        { pairs: [
          { label: '产品编号', key: '产品编号', type: 'text', vspan: 2 },
          { label: '客户名', key: '客户名', type: 'text', vspan: 2 },
          { label: '管理人', key: '管理人', type: 'text', lspan: 2, vspan: 2 },
        ]},
        { pairs: [
          { label: '主要性能', key: '主要性能', type: 'text', vspan: 2 },
          { label: '滤芯尺寸', key: '滤芯尺寸', type: 'text', vspan: 2 },
          { label: '授权使用人', key: '授权使用人', type: 'text', lspan: 2, vspan: 2 },
        ]},
      ]},
    ],
    dataTables: [
      { bar: '必测项', filterKey: '检验类别', filterVal: '必测项', lib: [
        { 控制项目: '*外观', 质量控制内容: '外观', 检测仪器: '目视', 控制标准及要求: '清洁、无破损无压痕，无裂纹,无倾斜等缺陷；切面平整无锯齿纹路，无明显缺角；切面无残留炭渣', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: '检验炭棒外观是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '*整体尺寸(外包无纺布)', 质量控制内容: '尺寸', 检测仪器: '游标卡尺', 控制标准及要求: '外径：46±0.5mm\n内径：9.5±0.5mm\n长度：23±0.5mm', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: '检验整体尺寸是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '*出货重量', 质量控制内容: '炭棒重量', 检测仪器: '电子秤', 控制标准及要求: '>22g', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: '检验炭棒出货重量是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '*抗压强度（裸棒）', 质量控制内容: '强度', 检测仪器: '普研PY-880', 控制标准及要求: '将炭棒水平放置在水平面板上，设置下压速度5mm/min，按测试键，仪器自动下压，断裂后读取压断时最大力压力值。\n控制标准：>50kgf', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒抗压强度是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '*压降测试', 质量控制内容: '压降', 检测仪器: '数显压力表', 控制标准及要求: '将炭棒组装好装入滤瓶（可旋盖大T），滤瓶进出水用2分管直接连接，测试流速0.24L/min，滤前前后接装压力表，压力表距离滤芯接口位置长度50mm，通水10min后记录压差值（滤芯前压-后压）。\n控制标准：≤25kpa', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒压降是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '*黑水及颗粒物测试（无黑后）', 质量控制内容: '黑水测试', 检测仪器: '烧杯，哈希2100q', 控制标准及要求: '将炭棒组装好装入滤瓶（透明大T），按进水方向通水，测试流速0.24±0.05L/min\n1.用烧杯接第一杯水250ml，观察出水及测试浊度值；\n2.冲水5min后，浸泡24H，陶瓷杯接出水100ml，观察出水情况及测试浊度值；\n控制标准：1.初始：轻微黑水，浊度≤20NTU\n2.浸泡24H：无肉眼可见黑水，浊度≤3NTU', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒黑水测试是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '*黑水及颗粒物测试（无黑后）', 质量控制内容: '浸泡颗粒物', 检测仪器: '烧杯', 控制标准及要求: '将炭棒组装好装入滤瓶（可旋盖大T），按进水方向通水，测试流速0.24±0.05L/min，\n完成黑水测试后，炭棒静置浸泡24H，用陶瓷杯接出水100ml，正常照明下，用肉眼观察杯底部颗粒物，颗粒物≤4颗\n控制标准：浸泡4H颗粒物≤4颗', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒浸泡颗粒物是否符合要求', 控制方法: '常规抽检' },
      ], cols: [
          { key: '表区', label: '表区', hiddenCol: true },
          { key: '检验类别', label: '检验类别', hiddenCol: true },
          { key: '控制项目', label: '控制项目' },
          { key: '质量控制内容', label: '质量控制内容' },
          { key: '检测仪器', label: '检测仪器、工具' },
          { key: '控制标准及要求', label: '控制标准及要求', area: true },
          { key: '检验', label: '检验' },
          { key: '不合格应对措施', label: '不合格应对措施', area: true },
          { key: '检测频率', label: '检测频率' },
          { key: '取样方式', label: '取样方式' },
          { key: '检验内容', label: '检验内容' },
          { key: '控制方法', label: '控制方法' },
        ]},
      { bar: '型式检验或者必测项', filterKey: '检验类别', filterVal: '型式检验', lib: [
        { 控制项目: '*碱性性能测试', 质量控制内容: '*初始PH增加值测试', 检测仪器: 'PH计', 控制标准及要求: '将炭棒组装好装入伊可普工装，按进水方向通RO纯水（水效水500+RO机），测试流速0.24L/min,冲水5min后，浸泡30min后，测试出水PH，接水量为500ml。\n控制标准：初始PH增加值＞3.0', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验炭棒初始PH增加值测试是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '*碱性性能测试', 质量控制内容: '*浸泡24H口感测试', 检测仪器: 'PH计、TDS笔', 控制标准及要求: '将炭棒组装好装入伊可普工装，按进水方向通RO纯水（水效水500+RO机），测试流速0.24L/min,冲水5min后，浸泡24H后，接出水（连续接五杯，接水量为100ml）及原水，测试口感、PH、TDS\n控制标准：1.五杯口感均无异常\n2.第一杯TDS增加值小于150\n3.第一杯出水PH增加值＞4.0', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验浸泡24H口感测试是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '*碱性性能测试', 质量控制内容: '碱性寿命', 检测仪器: 'PH计', 控制标准及要求: '将炭棒组装好装入伊可普工装，全程RO纯水（水效水500+RO机）加标测试控制水温25±3℃、流速0.24L/min，在额定净水0%、25%、50%、75%、100%，浸泡30min后取炭棒滤后水进行测试记录节点流速及炭棒出水PH（寿命1000L，每天冲水约145L，测试周期约为7天）。寿命1000L，PH增加值≥0.5', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '型式检验半年一次', 取样方式: '', 检验内容: '检验炭棒碱性寿命测试是否符合要求', 控制方法: '型式检测报告' },
        { 控制项目: '余氯性能测试', 质量控制内容: '*余氯初始去除率', 检测仪器: '哈希DR3900', 控制标准及要求: '将炭棒组装好装入单筒，滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.24L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，，通入加标水5min后取样测试，计算去除率。\n控制标准：余氯初始去除率≥99%', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '每批次', 取样方式: '1PCS/一个生产批次', 检验内容: '检验初始余氯去除率是否符合要求', 控制方法: '常规抽检' },
        { 控制项目: '余氯性能测试', 质量控制内容: '余氯寿命测试', 检测仪器: '哈希DR3900', 控制标准及要求: '将炭棒组装好装入单筒，滤瓶进出水用2分直接连接，水流方向外进内出，测试流速0.24L/min，采用次氯酸钠原液（有效氯≥10％）稀释后进行余氯去除率的加标试验，余氯浓度控制在2.0±0.2mg/L，在额定净水0%、25%、50%、75%、100%进行取样测试。全程加标，寿命1000L， 去除率≥90%', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '型式检验半年一次', 取样方式: '', 检验内容: '检验炭棒余氯寿命测试是否符合要求', 控制方法: '型式检测报告' },
        { 控制项目: '卫生浸泡', 质量控制内容: '/', 检测仪器: '/', 控制标准及要求: '符合《生活饮用水输配水设备及防护材料卫生安全评价规范》', 检验: 'IQC', 不合格应对措施: '1. 暂停该批次继续生产，隔离已生产不合格品，防止流入下工序\n2. 复核检验方法、量具、标准，确认是否误判\n3. 扩大抽检比例，判定问题是偶发还是批量性', 检测频率: '型式检验半年一次', 取样方式: '', 检验内容: '检验炭棒浸泡安全是否符合要求', 控制方法: '型式检测报告' },
      ], cols: [
          { key: '表区', label: '表区', hiddenCol: true },
          { key: '检验类别', label: '检验类别', hiddenCol: true },
          { key: '控制项目', label: '控制项目' },
          { key: '质量控制内容', label: '质量控制内容' },
          { key: '检测仪器', label: '检测仪器、工具' },
          { key: '控制标准及要求', label: '控制标准及要求', area: true },
          { key: '检验', label: '检验' },
          { key: '不合格应对措施', label: '不合格应对措施', area: true },
          { key: '检测频率', label: '检测频率' },
          { key: '取样方式', label: '取样方式' },
          { key: '检验内容', label: '检验内容' },
          { key: '控制方法', label: '控制方法' },
        ]},
    ],
  },
}