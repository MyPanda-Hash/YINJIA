/**
 * _record-sheets-shot.cjs — 数据记录表 7 面板视觉验证(Edge headless 截图)
 * 用法: node --experimental-websocket tools/_record-sheets-shot.cjs
 * 输出: tools/_shots/RD_*.png
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9334
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(method, p, body, token) {
  const res = await fetch(API + p, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, json }
}

// 每面板演示数据(按 Excel 原表样例;blank=仅空白草稿看编辑态)
const DEMOS = {
  RD_ALKALINE: {
    docno: 'YJ-ALK-SAMPLE-1',
    head: { '文档编号': 'YJ-ALK-SAMPLE-1', '密级': '保密', '适用范围': '银嘉内部', '测试负责人': '冯敏', '报告编号': 'PD-H-F260228002', '测试主题': '伊可普碱性寿命测试', '测试目的/背景': '碱性寿命及口感测试', '测试时间': '2026.02.28', '炭棒尺寸': '24*10*120mm', '本次实验目的': '浸泡24H后TDS值测试', '测试仪器': 'PH计：梅特勒（普通电极）', '测试装置及工位': '二分管，RO纯水（水效水+RO机）-炭棒（伊可普工装）-出水，滤效实验室1#', '测试方式': '碳棒组装完成后初始冲洗5min浸泡24H后取水测试，取样水量为100ml取连续五杯测试出水PH及TDS值', '原水自来水': '×', '原水超纯水': '×', '原水RO纯水': '√', '原水PH': '6', '原水TDS': '2', '水温': '22' },
    items: [
      { '测试时间': '2026.02.28', '测试流速（L/min）': '0.35', '杯数(接水量100ml)': '第一杯', '水温（℃）': '22.5', 'RO水PH': '6.21', 'RO水TDS': '30.4', '滤芯出水PH': '10.5', '滤芯出水TDS': '325', 'PH提升值': '4.29', '钠': '17.578', '镁': '99.114', '钾': '2.814', '钙': '4.977' },
      { '测试时间': '2026.02.28', '测试流速（L/min）': '0.35', '杯数(接水量100ml)': '第二杯', '水温（℃）': '22.5', 'RO水PH': '6.21', 'RO水TDS': '30.4', '滤芯出水PH': '10.45', '滤芯出水TDS': '197', 'PH提升值': '4.24', '钠': '32.701', '镁': '30.626', '钾': '0.881', '钙': '8.551' },
      { '测试时间': '2026.02.28', '测试流速（L/min）': '0.35', '杯数(接水量100ml)': '第三杯', '水温（℃）': '22.5', 'RO水PH': '6.21', 'RO水TDS': '30.4', '滤芯出水PH': '10.42', '滤芯出水TDS': '169', 'PH提升值': '4.21', '钠': '31.949', '镁': '25.328', '钾': '0.608', '钙': '8.266' },
    ],
  },
  RD_MINERAL: {
    docno: 'YJ-MIN-SAMPLE-1',
    head: { '文档编号': 'YJ-MIN-SAMPLE-1', '密级': '保密', '适用范围': '工程技术中心', '测试负责人': '涂小娟', '报告编号': 'PD-F-T25120701', '测试主题': '伊可普 RO后置矿化滤芯 纯水寿命测试', '测试目的/背景': '炭棒出水矿物质含量', '产品规格': '24*9*120（mm）', '本次试验目的': '炭棒开发测试,滤芯出水锶、偏硅酸、口感、PH、TDS', '测试仪器': 'ICP-MS 7500Cs-安捷伦、PH-FE438-梅特勒、TDS-麦克隆', '测试装置': '两分管，纯水-调节阀-单筒/旋口大T筒-炭棒滤芯-出水，【滤效实验室2#】', '测试标准': '寿命1000L，锶≥0.25mg/L、偏硅酸≥0mg/L', '测试方法': '自来水-RO机-纯水直冲，测试流速：0.5L/min；直冲-取500ml；浸泡30min-取500ml' },
    items: [
      { '指标': '锶 mg/L', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '0', '浸泡30min': '2.47', '浸泡30min煮沸晾凉': '2.74' },
      { '指标': '锶 mg/L', '测试日期': '20251208', '累计流量L': '300', 'RO出水': '0', '浸泡30min': '1.78', '浸泡30min煮沸晾凉': '2.34' },
      { '指标': '锶 mg/L', '测试日期': '20251209', '累计流量L': '600', 'RO出水': '0', '浸泡30min': '1.53', '浸泡30min煮沸晾凉': '1.82' },
      { '指标': '锶 mg/L', '测试日期': '20251210', '累计流量L': '900', 'RO出水': '0', '浸泡30min': '0.84', '浸泡30min煮沸晾凉': '1.07' },
      { '指标': '锶 mg/L', '测试日期': '20251211', '累计流量L': '1000', 'RO出水': '0', '浸泡30min': '0.52', '浸泡30min煮沸晾凉': '0.96' },
      { '指标': '偏硅酸 mg/L', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '0', '浸泡30min': '2.11', '浸泡30min煮沸晾凉': '2.695' },
      { '指标': '偏硅酸 mg/L', '测试日期': '20251208', '累计流量L': '300', 'RO出水': '0', '浸泡30min': '1.43', '浸泡30min煮沸晾凉': '2.11' },
      { '指标': '偏硅酸 mg/L', '测试日期': '20251209', '累计流量L': '600', 'RO出水': '0', '浸泡30min': '1.47', '浸泡30min煮沸晾凉': '2.31' },
      { '指标': '偏硅酸 mg/L', '测试日期': '20251210', '累计流量L': '900', 'RO出水': '0', '浸泡30min': '0.98', '浸泡30min煮沸晾凉': '1.59' },
      { '指标': '偏硅酸 mg/L', '测试日期': '20251211', '累计流量L': '1000', 'RO出水': '0', '浸泡30min': '0.45', '浸泡30min煮沸晾凉': '1.23' },
      { '指标': 'PH', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '6.84', '浸泡30min': '7.2', '浸泡30min煮沸晾凉': '7.86' },
      { '指标': 'PH', '测试日期': '20251208', '累计流量L': '300', 'RO出水': '6.75', '浸泡30min': '7.15', '浸泡30min煮沸晾凉': '7.54' },
      { '指标': 'PH', '测试日期': '20251209', '累计流量L': '600', 'RO出水': '6.65', '浸泡30min': '7.05', '浸泡30min煮沸晾凉': '7.38' },
      { '指标': 'PH', '测试日期': '20251210', '累计流量L': '900', 'RO出水': '6.75', '浸泡30min': '7.12', '浸泡30min煮沸晾凉': '7.22' },
      { '指标': 'PH', '测试日期': '20251211', '累计流量L': '1000', 'RO出水': '6.68', '浸泡30min': '7', '浸泡30min煮沸晾凉': '7.04' },
      { '指标': 'TDS', '测试日期': '20251207', '累计流量L': '2.5', 'RO出水': '8', '浸泡30min': '20.6', '浸泡30min煮沸晾凉': '25.6' },
      { '指标': 'TDS', '测试日期': '20251208', '累计流量L': '300', 'RO出水': '8.1', '浸泡30min': '15.5', '浸泡30min煮沸晾凉': '17.4' },
      { '指标': 'TDS', '测试日期': '20251209', '累计流量L': '600', 'RO出水': '8.2', '浸泡30min': '13.2', '浸泡30min煮沸晾凉': '16.3' },
      { '指标': 'TDS', '测试日期': '20251210', '累计流量L': '900', 'RO出水': '8.1', '浸泡30min': '12.8', '浸泡30min煮沸晾凉': '15.8' },
      { '指标': 'TDS', '测试日期': '20251211', '累计流量L': '1000', 'RO出水': '8.2', '浸泡30min': '12.4', '浸泡30min煮沸晾凉': '13.1' },
    ],
  },
  RD_ANTIBACT: {
    docno: 'YJ-AB-SAMPLE-1',
    head: { '文档编号': 'YJ-AB-SAMPLE-1', '密级': '保密', '适用范围': '工程技术中心', '测试负责人': '林宇', '报告编号': 'QL25092002', '测试主题': '集芈（康立根抑菌项目）', '测试目的/背景': '配合客户产品的研发和测试。', '测试标准': 'ASTME2149', '测试时间': '2025.9.19-9.20', '本次实验目的': '测试对比不同氧化铝抑菌料的初始杀菌性能', '试验用水': '纯水', '测试装置/设备': '单筒滤瓶', '冲水方式': '流速1.5L/min,纯水直冲30min', '测试方法': '配制大肠杆菌浓度约10000~50000cfu/ml，流速1.5L/min，通大肠杆菌加标液2min取加标原液和出水水样', '数据结论': '累计流量45L，中性氧化铝料杀菌率99.17%、a-氧化铝料杀菌率99.92%。相同累计流量下，活性氧化铝料比中性氧化铝和a-氧化铝料的杀菌效果好' },
    items: [
      { '测试日期': '2025.9.20', '样品信息': '>鑫恒普通炭(80-250)*32%\n>依品晟（250-400）31%\n>中性氧化铝料*10%\n>M4-D胶粉27%\n样品编号：Y-09-1614\n尺寸：45*16*163mm', '累计流量（L）': '45', '原液浓度（cfu/ml）': '112×103', '活性氧化铝（cfu/ml）': '93×101', '去除率（%）': '99.17' },
      { '测试日期': '2025.9.20', '样品信息': '>鑫恒普通炭(80-250)*32%\n>依品晟（250-400）31%\n>a-氧化铝料*10%\n>M4-D胶粉27%\n样品编号：Y-09-1615\n尺寸：45*16*163mm', '累计流量（L）': '45', '原液浓度（cfu/ml）': '112×103', '活性氧化铝（cfu/ml）': '9×101', '去除率（%）': '99.92' },
    ],
  },
  RD_SCALE: {
    docno: 'YJ-SC-SAMPLE-1',
    head: { '文档编号': 'YJ-SC-SAMPLE-1', '密级': '保密', '适用范围': '银嘉内部', '测试负责人': '黄利红', '报告编号': 'PD-H-H2026031201', '测试主题': '阻垢炭棒阻垢率测试', '测试目的/背景': '阻垢新工艺试产阻垢率评估', '炭棒尺寸': '34*12*178', '特殊配方1': '1#HPφ0.8mm-8g(1:2)', '特殊配方2': '2#HPφ0.8mm-8g(1.1:1)', '特殊配方3': '3#HPφ1.2mm-12g(1.1:1)', '本次实验目的': '低磷阻垢寿命对比测试，第二轮测试', '加标水配置': '按照《GB 34914饮用水处理装置水效限定值及水效等级》附录A试验用水的配制方法', '测试方法': '将炭棒组装好后，装入大T桶，前置PP棉,用自来水流速3L/min冲停,冲5min停20min，全天冲,在30L、2000L、4000L、5000L、6000L、7000L、8000L节点用水效水加标，加标流速3L/min，冲2min接样' },
    items: [
      { '测试日期': '2026.03.23', '累计流量（L）': '30', '水温（℃）': '24.1', '加标水硬度H0': '266.24', '加标水烧开后硬度H1': '216.19', '出水硬度（0.8mm-8g(1:2)）': '264.24', '出水硬度（0.8mm-8g(1.1:1)）': '264.24', '出水硬度（1.2mm-12g(1.1:1)）': '265.24', '阻垢率（0.8mm-8g(1:2)）': '96', '阻垢率（0.8mm-8g(1.1:1)）': '96', '阻垢率（1.2mm-12g(1.1:1)）': '98' },
      { '测试日期': '2026.03.26', '累计流量（L）': '2000', '水温（℃）': '24.6', '加标水硬度H0': '268.24', '加标水烧开后硬度H1': '215.19', '出水硬度（0.8mm-8g(1:2)）': '264.24', '出水硬度（0.8mm-8g(1.1:1)）': '263.24', '出水硬度（1.2mm-12g(1.1:1)）': '266.24', '阻垢率（0.8mm-8g(1:2)）': '92.4', '阻垢率（0.8mm-8g(1.1:1)）': '90.6', '阻垢率（1.2mm-12g(1.1:1)）': '96.2' },
      { '测试日期': '2026.03.28', '累计流量（L）': '4000', '水温（℃）': '24.5', '加标水硬度H0': '264.24', '加标水烧开后硬度H1': '210.19', '出水硬度（0.8mm-8g(1:2)）': '258.23', '出水硬度（0.8mm-8g(1.1:1)）': '256.23', '出水硬度（1.2mm-12g(1.1:1)）': '260.23', '阻垢率（0.8mm-8g(1:2)）': '88.9', '阻垢率（0.8mm-8g(1.1:1)）': '85.2', '阻垢率（1.2mm-12g(1.1:1)）': '92.6' },
    ],
  },
  RD_RO_PROTECT: {
    docno: 'YJ-RO-SAMPLE-1',
    head: { '文档编号': 'YJ-RO-SAMPLE-1', '密级': '保密', '适用范围': '公司内', '测试负责人': '黄小蔓', '报告编号': 'PD-Z24073101', '测试主题': '桌面机RO保护测试', '测试背景/目的': '桌面机RO膜保护效果验证', '项目名称': '桌面机RO保护', '本次实验目的': '阻垢滤芯对RO膜寿命的保护效果验证', '试验用水': '按GB34914配置硬水', '测试装置/设备': '加标桶→自吸泵→前置PP棉→5L水箱→隔膜泵→阻垢滤芯→RO膜', '测试方法': '参考《GB34914-2021反渗透净水机水效限定值及水效等级》方法配置硬水', '冲水方式': '5L水箱自动循环制水，RO膜产水后纯水排走，废水循环回水箱', '产品名/规格': '桌面机阻垢滤芯', '配方/工艺': '标准阻垢配方', '测试结论': '阻垢滤芯有效延缓RO膜压差上升' },
    items: [
      { '样品': '1#', '测试日期': '2024.08.01', '累计流量（L）': '50', '膜前压（MPa）': '0.32', '纯水流速(mL/min)': '180', '废水流速(L/min)': '0.9', '衰减率': '5%', '原水（tds）': '320', '纯水（tds）': '12', '脱盐率': '96.3' },
      { '样品': '1#', '测试日期': '2024.09.01', '累计流量（L）': '1500', '膜前压（MPa）': '0.36', '纯水流速(mL/min)': '165', '废水流速(L/min)': '0.92', '衰减率': '12%', '原水（tds）': '322', '纯水（tds）': '13', '脱盐率': '96.0' },
    ],
  },
  RD_SOAK: {
    docno: 'YJ-SK-SAMPLE-1',
    head: { '文档编号': 'YJ-SK-SAMPLE-1', '密级': '保密', '适用范围': '银嘉内部', '测试负责人': '陈秀丽', '报告编号': 'PD-H-C26030301', '测试主题': '伊可普高品质冰箱炭棒项目浸泡安全测试', '测试目的/背景': '伊可普高品质冰箱炭棒项目测试', '测试标准': '《GB/T17219-2025生活饮用水输配水设备及防护材料的安全性评价标准》', '测试时间': '2026.3.1-3.2', '本次实验目的': '伊可普高品质冰箱炭棒库存产品摸底测试浸泡安全', '浸泡水配置': '按照GBT17219 附录A配制浸泡液浓度pH为8、硬度100mg/L、有效氯为2mg/L', '测试方法': '1.将内芯装入滤壳中，用纯水通入滤芯冲洗30min；2.按附录A配制浸泡液；3.按照滤芯形状计算浸泡液用量', '炭棒尺寸（1）': '30*10*113', '炭棒尺寸（2）': '35*13*107', '炭棒尺寸（3）': '40.5*10*114', '浸泡液用量（1）ml': '283', '浸泡液用量（2）ml': '322', '浸泡液用量（3）ml': '360', '仪器名称（PH）': 'PH计', '品牌型号（PH）': '梅特勒FE28', '检出限（PH）': '0.1', '仪器名称（TDS）': 'TDS笔', '品牌型号（TDS）': '麦隆 PTBT1', '检出限（TDS）': '0.1', '仪器名称（浊度）': '浊度仪', '品牌型号（浊度）': '哈希 Q2100', '检出限（浊度）': '0.02', '仪器名称（重金属）': '7500CsICP-MS', '品牌型号（重金属）': 'Agilent 7500Cs ICP-MS', '检出限（重金属）': '汞0.0001ppm 其余0.001ppm', '实验结论': '以上3个尺寸炭棒，浸泡安全测试项中，除浸泡后浊度增加值超出标准，其余项均符合要求。' },
    items: [
      { '序号': '1', '项目': '浑浊度', '卫生要求': '增加量≤0.2NTU', '需求2（30*10*113）增加/改变值': '0.22', '需求2（35*13*107）增加/改变值': '0.27', '需求4（40.5*10*114）增加/改变值': '0.24' },
      { '序号': '2', '项目': '臭和味', '卫生要求': '浸泡后水无异臭、异味', '需求2（30*10*113）增加/改变值': '无', '需求2（35*13*107）增加/改变值': '无', '需求4（40.5*10*114）增加/改变值': '无' },
      { '序号': '4', '项目': 'PH', '卫生要求': '改变量≤0.5', '需求2（30*10*113）增加/改变值': '0.02', '需求2（35*13*107）增加/改变值': '0.01', '需求4（40.5*10*114）增加/改变值': '0.03' },
      { '序号': '9', '项目': '铝', '卫生要求': '增加量≤0.02  mg/L', '需求2（30*10*113）增加/改变值': '0.010639', '需求2（35*13*107）增加/改变值': '0.011269', '需求4（40.5*10*114）增加/改变值': '0.007469' },
    ],
  },
  RD_DROP_PREC: {
    docno: 'YJ-DP-SAMPLE-1',
    head: { '文档编号': 'YJ-DP-SAMPLE-1', '密级': '保密', '适用范围': '银嘉内部', '测试负责人': '林宇', '报告编号': 'PD-H-L25092601', '测试主题': '伊可普冰箱滤芯（需求3）压降、一级精度测试', '测试目的/背景': '伊可普冰箱滤芯开发测试', '炭棒尺寸': '35*12*99mm', '测试要求': '流速（G&gpm)：0.24加仑\n寿命：200*1.2加仑\n满足NSF42/53/401', '测试装置及编号': '滤效测试间1#-C工位；可旋盖大T', '测试方法': '1.压降测试：将炭棒组装后，可旋盖大T，用2分管连接，滤前前后接装压力表，测试初始及冲水10分钟后压降\n2.颗粒物去除率测试方法：先用超纯水冲洗滤芯30min', '测试用仪器/检出限': 'MEOKON 智能数字压力表/PSS' },
    items: [
      { '测试时间': '45926', '配方': '>>可乐丽（80-250）*57%\n>>可乐丽（250-500）*10%\n>>炭载BK1(验证过的)*8%\n>>2122胶粉*25%\n密度0.57-0.59', '样品编号': 'Y-09-2509-1', '密度': '0.607', '测试水温（℃）': '24.8', '测试流速（L/min）': '1.9', '前压（kpa)': '42', '后压（kpa)': '0', '压差（kpa)': '42', '0.5-1μm颗粒物去除率-2min（%）': '0.991', '备注': '密度过高' },
    ],
  },
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' })
  const token = login.json?.data?.token
  if (!token) throw new Error('login fail')
  console.log('[login] ok')

  // 造演示数据(每面板 1 张:先空白草稿,再带数据保存)
  const docNos = {}
  for (const [pc, demo] of Object.entries(DEMOS)) {
    const s1 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: {}, buttonParam: {} }, token)
    const no = s1.json?.data?.['编号']
    if (!no) { console.log('[seed] ' + pc + ' DRAFT FAIL: ' + JSON.stringify(s1.json)); continue }
    const s2 = await api('POST', '/px/callButton', { panelCode: pc, buttonName: '保存', formData: { 编号: no, ...demo.head, detail: { items: demo.items } }, buttonParam: {} }, token)
    console.log('[seed] ' + pc + ' ' + no + ' -> ' + (s2.json?.data?.['单据状态'] || JSON.stringify(s2.json).slice(0, 120)))
    docNos[pc] = no
  }

  // Edge headless 截图
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-shot-'))
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const newRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    const tab = await newRes.json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    }
    const send = (method, params = {}) => new Promise((res) => {
      const id = ++seq
      pending.set(id, res)
      ws.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
      return r.result?.result?.value
    }
    const navigate = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 40; i++) {
        await sleep(300)
        const ready = await evaluate('document.readyState')
        if (ready === 'complete') { await sleep(500); return }
      }
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 1000, deviceScaleFactor: 1, mobile: false })

    await navigate(`${FRONT}/#/login`)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.json.data.user))});
localStorage.setItem('mes_login_date', '2026-09-04'); 'ok'`)
    await navigate('about:blank')

    for (const pc of Object.keys(DEMOS)) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`)
      await sleep(3200)
      const shot = path.join(OUT, pc + '.png')
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      fs.writeFileSync(shot, Buffer.from(r.result.data, 'base64'))
      const info = await evaluate(`(() => {
  const sheet = document.querySelector('.rsp-sheet')
  const bars = [...document.querySelectorAll('.rsp-sheet .rs-sectionbar')].map(e => e.textContent.trim())
  const rows = [...document.querySelectorAll('.rsp-sheet .rs-dt tbody tr')].length
  const charts = document.querySelectorAll('.rsp-chart svg').length
  return { hasSheet: !!sheet, bars: bars.join('|'), dtRows: rows, charts, title: document.title }
})()`)
      console.log('[shot] ' + pc + ' -> ' + shot.replace(/^.*tools/, 'tools'))
      console.log('        ' + JSON.stringify(info))
    }
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log('DEMO DOC NOS:', JSON.stringify(docNos))
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
