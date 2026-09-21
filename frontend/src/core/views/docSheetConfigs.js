/**
 * 文件类文书面板配置(数据驱动:DocSheet 按配置渲染版式)
 * row 类型:
 *  - field: { num, label, key, max, h, kind:'input'|'textarea', hint? }   单字段行
 *  - multi: { num, label, h, subs:[{ label, key, max }] }                  多子区行(如 测试方案)
 * signCells: 底部签名区 [ { label, key, w(蓝格宽), type:'text'|'date', flex(占比), white(白底蓝字) } ]
 */
export const approvalSheetCfg = {
  titlePart1: '立项申请表',
  titlePart2: '二三级项目',
  titlePart3: '',
  seq: 'cn',
  deco: true,
  rows: [
    { num: '一', label: '客户名', key: '客户名', max: 0, h: 47, kind: 'input' },
    { num: '二', label: '立项背景', key: '立项背景', max: 250, h: 96, kind: 'textarea' },
    { num: '三', label: '机型及应用位置', key: '机型及应用位置', max: 50, h: 58, kind: 'textarea' },
    { num: '四', label: '滤芯/炭棒规格或结构', key: '滤芯/炭棒规格或结构', max: 100, h: 71, kind: 'textarea' },
    { num: '五', label: '项目开发目标', key: '项目开发目标', max: 250, h: 155, kind: 'textarea' },
    { num: '六', label: '项目输出', key: '项目输出', max: 100, h: 97, kind: 'textarea' },
    { num: '七', label: '开发周期要求', key: '开发周期要求', max: 50, h: 45, kind: 'textarea' },
    { num: '八', label: '其它要求', key: '其它要求', max: 250, h: 132, kind: 'textarea' },
  ],
  signCells: [
    { label: '申请立项人', key: '申请立项人', w: 202, type: 'text', flex: 53 },
    { label: '申请立项日期', key: '申请立项日期', w: 150, type: 'date', flex: 47, white: true },
  ],
}

/** 项目实施计划(二三级项目):原图无右侧虚列;测试方案行为三子区(条件/方法/标准);底部 负责人+编制日期 */
export const planSheetCfg = {
  titlePart1: '项目',
  titlePart2: '二三级项目',
  titlePart3: '实施计划',
  seq: 'num',
  deco: false,
  rows: [
    { num: '1', label: '项目名称', key: '项目名称', max: 50, h: 71, kind: 'input' },
    { num: '2', label: '项目定级', key: '项目定级', max: 0, h: 53, kind: 'select',
      options: [
        { value: '二级', label: '二级' },
        { value: '三级', label: '三级' },
        { value: '四级', label: '四级' },
      ], required: true,
      hint: '必填' },
    { num: '3', label: '测试内容', key: '测试内容', max: 100, h: 77, kind: 'textarea' },
    { num: '4', label: '测试产品打样要求', key: '测试产品打样要求', max: 100, h: 103, kind: 'textarea' },
    { num: '5', label: '测试目标', key: '测试目标', max: 50, h: 78, kind: 'textarea' },
    {
      num: '6', label: '测试方案', h: 225,
      subs: [
        { label: '测试条件', key: '测试条件', max: 150 },
        { label: '测试方法', key: '测试方法', max: 150 },
        { label: '测试标准', key: '测试标准', max: 150 },
      ],
    },
    // 测试计划:10 个阶段框(默认全显示;每个框可隐藏/显示,隐藏后下方自动接上;导出按实际显示)
    {
      num: '7', label: '测试计划', kind: 'phases', h: 200,
      phases: [
        { num: 1, key: '阶段1', max: 500 },
        { num: 2, key: '阶段2', max: 500 },
        { num: 3, key: '阶段3', max: 500 },
        { num: 4, key: '阶段4', max: 500 },
        { num: 5, key: '阶段5', max: 500 },
        { num: 6, key: '阶段6', max: 500 },
        { num: 7, key: '阶段7', max: 500 },
        { num: 8, key: '阶段8', max: 500 },
        { num: 9, key: '阶段9', max: 500 },
        { num: 10, key: '阶段10', max: 500 },
      ],
    },
  ],
  signCells: [
    { label: '负责人', key: '负责人', w: 202, type: 'text', flex: 58 },
    { label: '编制日期', key: '编制日期', w: 180, type: 'date', flex: 42, white: true },
  ],
}

/**
 * ═══ 品质管理八单据(YJ-QR-11/59/60/64/92/118/119/120):按原表格版式渲染 ═══
 * 另含 QC_TC_IN(来料品质特采单):与 QC_TC 同一张 YJ-QR-60 表单,但独立面板/独立表/独立编号(TCI)。
 * 行型: pairs(网格行:标签|值 多组)/section(章节行:标题+填写区/勾选/子区+签名行)/dept(部门会签行)
 * 约定: key=数据列名(=字段 label);checks 单选语义存选项值;dept 子区勾选为纸面装饰(同意/不同意由审批留痕);
 *       右上信息表 info: static=印刷值,date/ref/input 自动判型;底部 signKind:'plain'=编制/审核/批准 简单行。
 */

// 通用右上信息表:使用范围/责任部门(纸面印刷值,非录入项)/时间(单据日期)
// 责任部门仅 QC_BHG(不合格报告)是纸面留空的录入字段(表列存在);其余七单纸面为印好的固定部门
const qcInfo = (dept) => [
  { label: '使用范围', kind: 'static', text: '公司内部' },
  { label: '责任部门', kind: 'static', text: dept },
  { label: '时间', key: '单据日期', kind: 'date' },
]
// 通用底部落款
const qcSignStd = (bianzhi) => [
  { label: '编制', key: bianzhi, flex: 1 },
  { label: '审核', key: '审核人', flex: 1 },
  { label: '批准', key: '审批人', flex: 1 },
]

export const qcSheetCfgs = {
  // YJ-QR-11 不合格报告(制程)
  QC_BHG: {
    docno: 'YJ-QR-11',
    titlePart1: '不合格品分析报告', titlePart2: '制程', titlePart3: '', deco: false,
    info: [
      { label: '填写部门', key: '填写部门' },
      { label: '填写人', key: '填写人' },
      { label: '填写日期', key: '单据日期', kind: 'date' },
    ],
    rows: [
      { kind: 'pairs', cells: [
        { label: '检验工站', key: '检验工站', flex: 1 },
        { label: '客户', key: '客户名称', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '异常时间', key: '异常时间', kind: 'date', flex: 1 },
        { label: '责任部门', key: '责任部门', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '产品名称', key: '产品名称', flex: 1 },
        { label: '异常产品规格', key: '异常产品规格', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '不合格品数量', key: '不合格品数量', flex: 0.9 },
        { label: '异常等级', key: '异常等级', kind: 'checks', options: ['一般不合格', '严重不合格'], flex: 1.6 },
      ] },
      { kind: 'section', label: '异常描述', key: '异常描述', h: 110, max: 2000, sign: '签名' },
      { kind: 'section', label: '原因分析（生产部）', key: '原因分析', h: 110, max: 2000, sign: '签名' },
      { kind: 'section', label: '改善对策（生产部/IPQC）', key: '改善对策', h: 110, max: 2000, sign: '签名' },
      { kind: 'section', label: '效果跟踪', key: '效果跟踪', h: 90, max: 1000, sign: '签名' },
      { kind: 'section', label: '品质部意见', key: '品质部意见', h: 90, max: 1000, sign: '签名' },
    ],
    signKind: 'plain',
    signCells: qcSignStd('填写人'),
  },

  // YJ-QR-59 不合格品处理单(制程)
  QC_BHC: {
    docno: 'YJ-QR-59',
    titlePart1: '不合格品处理单', titlePart2: '制程', titlePart3: '', deco: false,
    info: qcInfo('质量管理中心'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '客户名称', key: '客户名称', flex: 1.1 },
        { label: '产品编码', key: '产品编码', flex: 0.9 },
        { label: '产品名称', key: '产品名称', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '产品规格', key: '产品规格', flex: 1 },
        { label: '生产量', key: '生产量', flex: 0.8 },
        { label: '不合格品数量', key: '不合格品数量', flex: 0.9 },
        { label: '不合格品比例', key: '不合格品比例', flex: 0.9 },
      ] },
      { kind: 'pairs', cells: [
        { label: '问题来源', key: '问题来源', kind: 'checks', options: ['成型', '组装'], flex: 1.5 },
        { label: '责任人', key: '责任人', flex: 1 },
      ] },
      { kind: 'section', label: '一．问题描述（可附图片，必要时另附问题品）', key: '问题描述', h: 110, max: 2000, sign: '责任人' },
      { kind: 'section', label: '二．原因分析', key: '原因分析', h: 100, max: 2000, sign: '责任人' },
      { kind: 'section', label: '三．性能验证', key: '性能验证', h: 90, max: 1000, sign: '责任人' },
      { kind: 'section', label: '四．不合格品处理意见', key: '处理意见', h: 70, sign: '品质部', signKey: '责任人',
        checks: ['返工达到规定要求', '让步使用', '报废', '筛选合格品留用'] },
      { kind: 'section', label: '五．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '产品开发部意见', h: 130, subs: [
        { label: '性能', key: '产品开发部性能意见', checks: ['同意使用', '不同意使用'], max: 250 },
        { label: '工艺', key: '产品开发部工艺意见', checks: ['同意使用', '不同意使用'], max: 250 },
      ] },
      { kind: 'dept', label: '销售部意见', h: 80, subs: [
        { key: '销售部意见', checks: ['同意使用', '不同意使用'], max: 250 },
      ] },
      { kind: 'section', label: '六、改善效果验证（如有返工处理需填写）', key: '改善效果验证', h: 90, max: 1000, sign: '责任人' },
      { kind: 'section', label: '七．损失成本', h: 46 },
      { kind: 'pairs', cells: [
        { label: '材料费用', key: '材料费用', flex: 1 },
        { label: '人工费', key: '人工费', flex: 1 },
        { label: '其他费用', key: '其他费用', flex: 1 },
      ] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('责任人'),
  },

  // YJ-QR-60 特采申请单
  QC_TC: {
    docno: 'YJ-QR-60',
    titlePart1: '特采申请单', titlePart2: '', titlePart3: '', deco: false,
    info: qcInfo('采购部'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '供应商', key: '供应商', flex: 1.2 },
        { label: '采购单号', key: '采购单号', flex: 1 },
        { label: '产品名称', key: '产品名称', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '总数量', key: '总数量', flex: 0.9 },
        { label: '不合格品数量', key: '不合格品数量', flex: 1 },
        { label: '不合格品比例', key: '不合格品比例', flex: 0.9 },
      ] },
      // 原图:不良说明 与 严重程度 是上下两行、各占整宽(不是并排)→ 各用单元素 pairs 行
      { kind: 'pairs', h: 60, cells: [
        { label: '不良说明', key: '不良说明', flex: 1 },
      ] },
      { kind: 'pairs', h: 44, cells: [
        { label: '严重程度', key: '严重程度', kind: 'checks', options: ['严重', '一般', '轻微'], flex: 1 },
      ] },
      { kind: 'section', label: '特采理由', key: '特采理由', h: 110, max: 1000, sign: '申请人', signKey: '编制人' },
      { kind: 'section', label: '一．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '产品开发部意见', h: 130, subs: [
        { label: '性能', key: '产品开发部性能意见', checks: ['同意使用', '不同意使用'], max: 250 },
        { label: '工艺', key: '产品开发部工艺意见', checks: ['同意使用', '不同意使用'], max: 250 },
      ] },
      { kind: 'dept', label: '品质部意见', h: 80, subs: [{ key: '品质部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '销售部意见', h: 80, subs: [{ key: '销售部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '研发意见', h: 80, subs: [{ key: '研发意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      // 原图:三个勾选框(旧配置漏了「管控使用」)
      { kind: 'section', label: '二．最终处理结果', key: '最终处理结果', h: 60,
        checks: ['正常使用', '管控使用', '挑选使用'] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('编制人'),
  },

  // 来料品质特采单(同一张 YJ-QR-60 表单,独立面板+独立表,挂 品质管理 > 来料品质)
  // 与上方 QC_TC 是两份独立单据(分开存放、各自编号 TCI/TC);版式同样 1:1 对齐原扫描图。
  QC_TC_IN: {
    docno: 'YJ-QR-60',
    titlePart1: '特采申请单', titlePart2: '', titlePart3: '', deco: false,
    info: qcInfo('采购部'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '供应商', key: '供应商', flex: 1.2 },
        { label: '采购单号', key: '采购单号', flex: 1 },
        { label: '产品名称', key: '产品名称', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '总数量', key: '总数量', flex: 0.9 },
        { label: '不合格品数量', key: '不合格品数量', flex: 1 },
        { label: '不合格品比例', key: '不合格品比例', flex: 0.9 },
      ] },
      // 原图:不良说明 与 严重程度 是上下两行、各占整宽(不是并排)→ 各用单元素 pairs 行
      { kind: 'pairs', h: 60, cells: [
        { label: '不良说明', key: '不良说明', flex: 1 },
      ] },
      { kind: 'pairs', h: 44, cells: [
        { label: '严重程度', key: '严重程度', kind: 'checks', options: ['严重', '一般', '轻微'], flex: 1 },
      ] },
      { kind: 'section', label: '特采理由', key: '特采理由', h: 110, max: 1000, sign: '申请人', signKey: '编制人' },
      { kind: 'section', label: '一．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '产品开发部意见', h: 130, subs: [
        { label: '性能', key: '产品开发部性能意见', checks: ['同意使用', '不同意使用'], max: 250 },
        { label: '工艺', key: '产品开发部工艺意见', checks: ['同意使用', '不同意使用'], max: 250 },
      ] },
      { kind: 'dept', label: '品质部意见', h: 80, subs: [{ key: '品质部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '销售部意见', h: 80, subs: [{ key: '销售部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '研发意见', h: 80, subs: [{ key: '研发意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      // 原图:三个勾选框(QC_TC 旧配置漏了「管控使用」)
      { kind: 'section', label: '二．最终处理结果', key: '最终处理结果', h: 60,
        checks: ['正常使用', '管控使用', '挑选使用'] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('编制人'),
  },

  // YJ-QR-64 不合格品处理单(自制物料)
  QC_BHZ: {
    docno: 'YJ-QR-64',
    titlePart1: '不合格品处理单', titlePart2: '自制物料', titlePart3: '', deco: false,
    info: qcInfo('质量管理中心'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '物料名称', key: '物料名称', flex: 1.1 },
        { label: '物料编码', key: '物料编码', flex: 1 },
        { label: '物料批次', key: '物料批次', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '生产数量', key: '生产数量', flex: 0.9 },
        { label: '问题来源', key: '问题来源', kind: 'checks', options: ['制程', '成品'], flex: 1.5 },
        { label: '责任人', key: '责任人', flex: 1 },
      ] },
      { kind: 'section', label: '一．问题描述（可附图片，必要时另附问题品）', key: '问题描述', h: 110, max: 2000, sign: '责任人' },
      { kind: 'section', label: '二．原因分析', key: '原因分析', h: 100, max: 2000, sign: '责任人' },
      { kind: 'section', label: '三．性能验证', key: '性能验证', h: 90, max: 1000, sign: '责任人' },
      { kind: 'section', label: '四．不合格品处理意见', key: '处理意见', h: 70, sign: '品质部', signKey: '责任人',
        checks: ['返工达到规定要求', '让步使用', '报废', '筛选合格品留用'] },
      { kind: 'section', label: '五．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '研发部意见', h: 85, subs: [{ key: '研发部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '产品开发部意见', h: 85, subs: [{ key: '产品开发部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'section', label: '六、改善效果验证（如有返工处理需填写）', key: '改善效果验证', h: 90, max: 1000, sign: '责任人' },
      { kind: 'section', label: '七．成本损失', h: 46 },
      { kind: 'pairs', cells: [
        { label: '材料费用', key: '材料费用', flex: 1 },
        { label: '人工费', key: '人工费', flex: 1 },
        { label: '其他费用', key: '其他费用', flex: 1 },
      ] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('责任人'),
  },

  // YJ-QR-92 紧急放行申请单
  QC_JJF: {
    docno: 'YJ-QR-92',
    titlePart1: '紧急放行通知单', titlePart2: '', titlePart3: '', deco: false,
    info: qcInfo(''),
    rows: [
      { kind: 'pairs', cells: [
        { label: '物料类型', key: '物料类型', kind: 'checks', options: ['外部来料', '自制物料'], flex: 3 },
      ] },
      { kind: 'pairs', cells: [
        { label: '物料名称', key: '物料名称', flex: 1 },
        { label: '物料编码', key: '物料编码', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '申请放行数量', key: '申请放行数量', flex: 1 },
        { label: '批次号', key: '批次号', flex: 1 },
      ] },
      { kind: 'section', label: '一．紧急放行原因', key: '紧急放行原因', h: 110, max: 2000, sign: '责任人', signKey: '责任人' },
      { kind: 'section', label: '二．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '产品开发部意见', h: 130, subs: [
        { label: '性能', key: '产品开发部性能意见', checks: ['同意使用', '不同意使用'], max: 250 },
        { label: '工艺', key: '产品开发部工艺意见', checks: ['同意使用', '不同意使用'], max: 250 },
      ] },
      { kind: 'dept', label: '品质部意见', h: 80, subs: [{ key: '品质部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'section', label: '三．检测结果', key: '检测结果', h: 90, max: 1000 },
    ],
    signKind: 'plain',
    signCells: qcSignStd('检测人'),
  },

  // YJ-QR-118 试产材料使用申请单
  QC_SCP: {
    docno: 'YJ-QR-118',
    titlePart1: '试产材料使用申请单', titlePart2: '', titlePart3: '', deco: false,
    info: qcInfo('研发部'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '物料名称', key: '物料名称', flex: 1.1 },
        { label: '物料编码', key: '物料编码', flex: 1 },
        { label: '物料批次', key: '物料批次', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '生产量', key: '生产量', flex: 0.9 },
        { label: '责任人', key: '责任人', flex: 2 },
      ] },
      { kind: 'section', label: '一．材料来源描述（可附图片，必要时另附问题品）', key: '材料来源描述', h: 110, max: 2000, sign: '责任人' },
      { kind: 'section', label: '二．测试结果', key: '测试结果', h: 110, max: 2000, sign: '责任人' },
      { kind: 'section', label: '三．相关部门处理意见', h: 34 },
      { kind: 'dept', label: '研发部意见', h: 80, subs: [{ key: '研发部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '产品开发部意见', h: 80, subs: [{ key: '产品开发部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
      { kind: 'dept', label: '品质部意见', h: 80, subs: [{ key: '品质部意见', checks: ['同意使用', '不同意使用'], max: 250 }] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('责任人'),
  },

  // YJ-QR-119 来料异常分析报告
  QC_LYB: {
    docno: 'YJ-QR-119',
    titlePart1: '来料异常分析报告', titlePart2: '', titlePart3: '', deco: false,
    info: qcInfo(''),
    rows: [
      { kind: 'pairs', cells: [
        { label: '供应商', key: '供应商', flex: 1.2 },
        { label: '物料批次', key: '物料批次', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '物料名称', key: '物料名称', flex: 1.2 },
        { label: '来料数量', key: '来料数量', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '物料编码', key: '物料编码', flex: 1.2 },
        { label: '不良率', key: '不良率', flex: 1 },
      ] },
      { kind: 'section', label: '一．异常描述（可附图片，必要时另附问题品）', key: '异常描述', h: 110, max: 2000, sign: '责任人', signKey: '编制人' },
      { kind: 'section', label: '二、异常原因分析', h: 150, subs: [
        { label: '供应商原因', key: '供应商原因', max: 500 },
        { label: '内部原因（无则填无）', key: '内部原因', max: 500 },
      ] },
      { kind: 'section', label: '三、处理方式（品质部）', key: '处理方式', h: 60, sign: '签名', signKey: '编制人',
        checks: ['整批退货', '全检挑选', '让步接收'] },
      { kind: 'section', label: '四．改善追踪结果', key: '改善追踪结果', h: 100, max: 1000 },
    ],
    signKind: 'plain',
    signCells: qcSignStd('编制人'),
  },

  // YJ-QR-120 生产异常分析报告
  QC_SCY: {
    docno: 'YJ-QR-120',
    titlePart1: '生产异常分析报告', titlePart2: '', titlePart3: '', deco: false,
    info: qcInfo('生产部'),
    rows: [
      { kind: 'pairs', cells: [
        { label: '产品/物料名称', key: '产品物料名称', flex: 1.2 },
        { label: '产品/物料批次', key: '产品物料批次', flex: 1 },
      ] },
      { kind: 'pairs', cells: [
        { label: '产品/物料编码', key: '产品物料编码', flex: 1.2 },
        { label: '生产量', key: '生产量', flex: 1 },
      ] },
      { kind: 'section', label: '异常描述', key: '异常描述', h: 110, max: 2000, sign: '签名', signKey: '编制人' },
      { kind: 'section', label: '原因分析', key: '原因分析', h: 110, max: 2000, sign: '签名', signKey: '编制人' },
      { kind: 'section', label: '改善对策', key: '改善对策', h: 110, max: 2000, sign: '签名', signKey: '编制人' },
      { kind: 'section', label: '效果跟踪', key: '效果跟踪', h: 90, max: 1000, sign: '签名', signKey: '编制人' },
      { kind: 'section', label: '品质部意见', key: '品质部意见', h: 90, max: 1000, sign: '签名', signKey: '编制人' },
    ],
    signKind: 'plain',
    signCells: qcSignStd('编制人'),
  },
}
