/**
 * recordSheetConfigs.js — 数据记录表 7 张文书面板配置(碱性/矿化/抑菌/阻垢性能/RO保护/浸泡安全/压降、精度)
 * 按《04数据记录表.xlsx》逐表复刻;key = yj_field 的 label(中文数据键),由 RecordSheetPanels.vue 统一渲染。
 * 结构:
 *   grid —— 整页共用列网格(Excel 原表各列宽度 px):报告头/条件区/数据表全部用这套列宽,竖线全页对齐
 *   head {title, infoLabel, infoValue} —— 报告头三段列跨度(大标题|信息标签|信息值),合计 = grid 列数
 *   sections[{bar, rows[]}] —— row: {label,key,type:'text|area'} 或 {label,cells:[{key,ph,span}](多值格)}
 *   waterColspans(碱性) —— 原水水质条 6 指标格各自跨的网格列数(Excel C:D/E/F:H/I:J/K:L/M:N)
 *   soakColspans(浸泡安全) —— 特例块值区跨度(Excel D/E/F:G)
 *   dataTables[{bar,subHeads[],cols[{key,label,span,group,area}],charts}] —— 数据记录表(两级表头:同 group 合并)
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
}
