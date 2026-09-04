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
      ['1', '浑浊度', '增加量≤0.2NTU'],
      ['2', '臭和味', '浸泡后水无异臭、异味'],
      ['3', '肉眼可见物', '浸泡后水不产生任何肉眼可见的碎片杂物等'],
      ['4', 'PH', '改变量≤0.5'],
      ['5', '溶解性总固体', '/'],
      ['6', '耗氧量（以O2计）', '增加量≤1 mg/L'],
      ['7', '砷', '增加量≤0.001 mg/L'],
      ['8', '铬', '增加量≤0.005 mg/L'],
      ['9', '铝', '增加量≤0.02  mg/L'],
      ['10', '铅', '增加量≤0.001 mg/L'],
      ['11', '汞', '增加量≤0.0001  mg/L'],
      ['12', '铁', '增加量≤0.06  mg/L'],
      ['13', '锰', '增加量≤0.02  mg/L'],
      ['14', '铜', '增加量≤0.2  mg/L'],
      ['15', '锌', '增加量≤0.2  mg/L'],
      ['16', '镍', '增加量≤0.002  mg/L'],
      ['17', '银', '增加量≤0.005  mg/L'],
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
          { label: '' },
          { label: '长度要求', cap: true, span: 6 },
          { label: '重量要求', cap: true, span: 4 },
        ]},
        { grid: [
          { label: '脱模', rowspan: 3 },
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
          { key: '实际密度管控下限', span: 4 },
          { label: '实际密度管控上限', span: 4 },
        ]},
        { grid: [
          { label: '·密度范围：0.575~0.595', span: 2 },
          { key: '密度管控要求', span: 4 },
          { fixed: '', span: 4 },
        ]},
        { grid: [
          { label: '跌落强度', rowspan: 2 },
          { label: '高度cm', span: 2 },
          { key: '跌落次数', span: 4 },
          { label: '要求', span: 4 },
        ]},
        { grid: [
          { key: '跌落高度cm', span: 2 },
          { key: '跌落要求', span: 9 },
        ]},
        { grid: [
          { label: '抗压强度', rowspan: 2 },
          { label: '测试间距mm', span: 2 },
          { key: '压头下降速度', span: 4 },
          { label: '强度要求kgf', span: 4 },
        ]},
        { grid: [
          { key: '测试间距mm', span: 2 },
          { key: '强度要求kgf', span: 9 },
        ]},
        { grid: [
          { label: '压降', rowspan: 2 },
          { label: '测试管路', span: 2 },
          { key: '压降测试流速', span: 4 },
          { label: '压降标准kpa', span: 4 },
        ]},
        { grid: [
          { key: '压降测试管路', span: 2 },
          { key: '压降标准kpa', span: 9 },
        ]},
      ]},
    ],
    dataTables: [],
  },
  // 成型配方(炭棒配方管控清单):产品基本信息 + 配方表(动态行+合计) + 配料要求
  RD_MOLD_FORMULA: {
    headMode: 'report',
    staticTitle: '炭棒配方管控清单',
    info: [
      { label: '表单管理人', key: '表单管理人', type: 'text' },
      { label: '密级', key: '密级', type: 'select' },
      { label: '使用范围', key: '使用范围', type: 'select' },
      { label: '版本号', key: '版本号', type: 'text' },
    ],
    grid: [130, 180, 130, 200, 130, 90, 90, 90],
    head: { title: 5, infoLabel: 1, infoValue: 2 },
    sections: [
      { bar: '产品基本信息', rows: [
        { pairs: [
          { label: '产品编号', key: '产品编号', type: 'text' },
          { label: '产品名称', key: '产品名称', type: 'text' },
          { label: '炭棒规格', cells: [{ key: '炭棒规格1' }, { key: '炭棒规格2' }, { key: '炭棒规格3' }] },
        ]},
        { pairs: [
          { label: '产品管控类型', key: '产品管控类型', type: 'select' },
          { label: '外观要求', key: '外观要求', type: 'select' },
          { label: '生产车间', key: '生产车间', type: 'select', vspan: 3 },
        ]},
      ]},
    ],
    dataTables: [
      { bar: '配方表', autoSeqBar: true, totalCols: true, cols: [
          { key: '序号', label: 'No.' },
          { key: '物料种类', label: '物料种类' },
          { key: '物料编号', label: '物料编号' },
          { key: '物料名称', label: '物料名称', span: 2 },
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

  // 组装BOM表:plain 清单(物料名/编号/规格/外观/用量)
  RD_ASM_BOM: {
    headMode: 'plain',
    plainTitle: '炭棒滤芯组装/包装物料清单',
    dataTables: [
      { cols: [
          { key: '物料名', label: '物料名', w: 150 },
          { key: '物料编号', label: '物料编号', w: 130 },
          { key: '物料规格', label: '物料规格', w: 330, area: true },
          { key: '外观要求', label: '外观要求', w: 330, area: true },
          { key: '用量', label: '用量', w: 80 },
        ]},
    ],
  },

  // 组装工艺清单:plain 清单(工序/控制内容/管控要求/检查比例)
  RD_ASM_PROC: {
    headMode: 'plain',
    plainTitle: '炭棒滤芯组装/包装段-关键工序控制清单',
    dataTables: [
      { cols: [
          { key: '工序', label: '工序', w: 130 },
          { key: '工序控制内容', label: '工序控制内容', w: 320, area: true },
          { key: '管控要求', label: '管控要求', w: 430, area: true },
          { key: '检查比例', label: '检查比例', w: 120 },
        ]},
    ],
  },

  // 规格书:8 种类型(类型Tab 切换单据分类) + 5 页结构(页签翻页)——封面/修订与范围/检验/物料/包装运输
  RD_SPEC_DOC: {
    headMode: 'report',
    titleFromKey: '名称',
    titlePrefix: '产品规格书·',
    titlePlaceholder: '矿化后置烧结矿化棒',
    specTypes: ['飞利浦沐浴阻垢滤芯', '矿化烧结炭棒', '除铅炭棒', '抑菌炭棒', 'X14折叠复合滤芯', '碱性炭棒', '矿化炭棒', '多功能炭棒'],
    pages: [
      { title: '封面' },
      { title: '修订与范围' },
      { title: '检验要求' },
      { title: '关键物料' },
      { title: '包装运输' },
    ],
    grid: [100, 300, 100, 240, 100, 100, 100, 110],
    head: { title: 5, infoLabel: 1, infoValue: 2 },
    sections: [
      // P1 封面:类型 + 编号/客户/料号/版本/日期 + 制订/审核/批准(名称在大标题)
      { page: 0, rows: [
        { pairs: [
          { label: '规格书种类', key: '规格书种类', type: 'select', vspan: 3 },
          { label: '编号', key: '编号', type: 'text', vspan: 3 },
        ]},
        { pairs: [
          { label: '客户名', key: '客户名', vspan: 1 },
          { label: '客户料号', key: '客户料号', vspan: 5 },
        ]},
        { pairs: [
          { label: '版本', key: '版本', vspan: 1 },
          { label: '日期', key: '日期', vspan: 5 },
        ]},
        { pairs: [
          { label: '制订日期', key: '制订日期' },
          { label: '审核日期', key: '审核日期' },
          { label: '批准日期', key: '批准日期', vspan: 2 },
        ]},
      ]},
      // P2 修订与范围:1.适用范围 / 2.整体规格参数 / 3.产品主要性能
      { page: 1, rows: [
        { label: '1.适用范围', key: '适用范围', type: 'area', tall: true },
        { label: '2.整体规格参数', key: '整体规格参数', type: 'area', tall: true },
        { label: '3.产品主要性能', key: '产品主要性能', type: 'area' },
      ]},
      // P5 包装运输:6.包装方式 / 7.运输要求 / 8.存储环境
      { page: 4, rows: [
        { label: '6.包装方式', key: '包装方式', type: 'area', tall: true },
        { label: '7.运输要求', key: '运输要求', type: 'area', tall: true },
        { label: '8.存储环境', key: '存储环境', type: 'area', tall: true },
      ]},
    ],
    dataTables: [
      { page: 1, bar: '修订记录', filterKey: '表区', filterVal: '修订记录', cols: [
          { key: '表区', label: '表区', hiddenCol: true },
          { key: '序号', label: '序号', w: 60 },
          { key: '更改内容', label: '更改内容', w: 320, area: true },
          { key: '更改原因', label: '更改原因', w: 220 },
          { key: '更改时间', label: '更改时间', w: 120 },
          { key: '责任人', label: '责任人', w: 100 },
          { key: '备注', label: '备注', w: 140 },
        ]},
      { page: 2, bar: '4.产品性能检验项目及检验标准', filterKey: '表区', filterVal: '检验要求', cols: [
          { key: '表区', label: '表区', hiddenCol: true },
          { key: '序号', label: '序号', w: 60 },
          { key: '检验项目', label: '检验项目', w: 120 },
          { key: '检验要求', label: '检验要求', w: 380, area: true },
          { key: '检验方法', label: '检验方法', w: 130 },
          { key: '检验依据', label: '检验依据', w: 140 },
        ]},
      { page: 3, bar: '5.关键物料列表', filterKey: '表区', filterVal: '物料清单', cols: [
          { key: '表区', label: '表区', hiddenCol: true },
          { key: '序号', label: '序号', w: 60 },
          { key: '物料编码', label: '物料编码', w: 130 },
          { key: '物料名称', label: '物料名称', w: 160 },
          { key: '规格参数', label: '规格参数', w: 320, area: true },
          { key: '数量', label: '数量', w: 80 },
          { key: '备注', label: '备注', w: 140 },
        ]},
    ],
  },

  // 出货检验计划表(出货检验控制计划):全页共用 10 列网格(与数据表同列)——
  // 产品编号↔控制项目、客户名↔控制标准及要求、版本号↔检测频率/取样方式,上下总宽一致
  RD_INSP_PLAN: {
    headMode: 'report',
    docNoDefault: 'YJ-RD001',
    titlePlaceholder: '伊可普20寸折叠复合除铅大胖出货检验控制计划',
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
          { label: '授权使用人', key: '授权使用人', type: 'text', lspan: 2, vspan: 2, rowspan: 2 },
        ]},
        { pairs: [
          { label: '编写人', key: '编写人', type: 'text', vspan: 2 },
          { label: '审核人', key: '审核人', type: 'text', vspan: 2 },
        ]},
      ]},
    ],
    dataTables: [
      { cols: [
          { key: '控制项目', label: '控制项目' },
          { key: '质量控制内容', label: '质量控制内容' },
          { key: '检测仪器', label: '检测仪器、工具' },
          { key: '控制标准及要求', label: '控制标准及要求' },
          { key: '检验', label: '检验' },
          { key: '不合格应对措施', label: '不合格应对措施' },
          { key: '检测频率', label: '检测频率' },
          { key: '取样方式', label: '取样方式' },
          { key: '检验内容', label: '检验内容' },
          { key: '控制方法', label: '控制方法' },
        ]},
    ],
  },
}
