/**
 * 文件类文书面板配置(数据驱动:DocSheet 按配置渲染版式)
 * row 类型:
 *  - field: { num, label, key, max, h, kind:'input'|'textarea', hint?,
 *             second?:{ label, key, kind:'date'|'text' } }   单字段行(second = 同一行右侧的第二字段)
 *  - multi: { num, label, h, subs:[{ label, key, max }] }                  多子区行(如 测试方案)
 * signCells: 底部签名区 [ { label, key, w(蓝格宽), type:'text'|'date', flex(占比), white(白底蓝字) } ]
 * remark:    { label, key, max }  右侧**可填**备注列(立项申请表设计 F5 标签 + F6:G15 填写区);
 *            2026-09-22 前该列是 deco 装饰虚线(只画不填),已被 remark 取代 —— deco 开关与渲染分支已删除
 * 行高 h 的口径:设计 xlsx 的**磅值 × 4/3**(96dpi),合并行取参与合并各行之和;
 *            因控件不得被裁切,DocSheet 对「单字段行/多子区行/阶段框行」一律按 min-height 渲染。
 * 依据与不变量见同目录 docSheetConfigs.test.js(标题/下拉口径/备注区/第 8 行/行高)
 */
export const approvalSheetCfg = {
  titlePart1: '立项申请表',
  titlePart2: '二三四级项目',
  titlePart3: '',
  seq: 'cn',
  // 设计右侧是可填的「备注」区(F5 标签 + F6:G15 合并填写区)⇒ 渲染成真的备注列,
  // 不再是 deco 装饰虚线(2026-09-22 对齐设计;rd_approval.备注 列本就存在,只是没登记字段)
  remark: { label: '备注', key: '备注', max: 1000 },
  rows: [
    // 行高 = 设计磅值 × 4/3(96dpi),来源「立项申请表.xlsx」行高
    // [33,24,18.75,20.25,33.75,38.25,33,null,null,41.25,75.75,157.5,70.5,41.25,41.25,33]
    { num: '一', label: '客户名', key: '客户名', max: 0, h: 45, kind: 'input' },
    { num: '二', label: '立项背景', key: '立项背景', max: 250, h: 133, kind: 'textarea' },
    { num: '三', label: '机型及应用位置', key: '机型及应用位置', max: 50, h: 55, kind: 'textarea' },
    { num: '四', label: '滤芯/炭棒规格或结构', key: '滤芯/炭棒规格或结构', max: 100, h: 101, kind: 'textarea' },
    { num: '五', label: '项目开发目标', key: '项目开发目标', max: 250, h: 210, kind: 'textarea' },
    { num: '六', label: '项目输出', key: '项目输出', max: 100, h: 94, kind: 'textarea' },
    { num: '七', label: '开发周期要求', key: '开发周期要求', max: 50, h: 55, kind: 'textarea' },
    { num: '八', label: '其它要求', key: '其它要求', max: 250, h: 55, kind: 'textarea' },
  ],
  signCells: [
    { label: '申请立项人', key: '申请立项人', w: 202, type: 'text', flex: 53 },
    { label: '申请立项日期', key: '申请立项日期', w: 150, type: 'date', flex: 47, white: true },
  ],
}

/** 项目实施计划(二三四级项目):原图无右侧虚列;测试方案行为三子区(条件/方法/标准);末行 负责人+编制日期 */
export const planSheetCfg = {
  titlePart1: '项目',
  titlePart2: '二三四级',
  titlePart3: '实施计划',
  seq: 'num',
  rows: [
    // 行高 = 设计磅值 × 4/3(96dpi),来源「项目实施计划.xlsx」行高
    // [20.15,27.75,27.75,27.75,33.75,33.75,32.1,77.1,60.95,39.95,39.95,39.95,68.25,30]
    { num: '1', label: '项目名称', key: '项目名称', max: 50, h: 45, kind: 'input' },
    // 下拉口径必须与库字典一致:RD_PLAN.项目定级 已被 migrate-approval-level.sql(2026-09-21)
    // 补入「一级」(下游承接立项申请的 项目等级 一~四级),少一级会让参照带入的值选不中
    { num: '2', label: '项目定级', key: '项目定级', max: 0, h: 45, kind: 'select',
      options: [
        { value: '一级', label: '一级' },
        { value: '二级', label: '二级' },
        { value: '三级', label: '三级' },
        { value: '四级', label: '四级' },
      ], required: true,
      hint: '必填' },
    { num: '3', label: '测试内容', key: '测试内容', max: 100, h: 43, kind: 'textarea' },
    { num: '4', label: '测试产品打样要求', key: '测试产品打样要求', max: 100, h: 103, kind: 'textarea' },
    { num: '5', label: '测试目标', key: '测试目标', max: 50, h: 81, kind: 'textarea' },
    {
      num: '6', label: '测试方案', h: 160,
      subs: [
        { label: '测试条件', key: '测试条件', max: 150 },
        { label: '测试方法', key: '测试方法', max: 150 },
        { label: '测试标准', key: '测试标准', max: 150 },
      ],
    },
    // 测试计划:10 个阶段框(默认全显示;每个框可隐藏/显示,隐藏后下方自动接上;导出按实际显示)
    // 设计该行只有 68.25pt 高的一格,而实现是 10 个阶段框×5 字段的功能面板 ⇒ h 只作最小高度
    {
      num: '7', label: '测试计划', kind: 'phases', h: 91,
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
    // 第 8 行 = 设计末行(B15=8 / C15=负责人 / F15=编制日期:):负责人在左、编制日期在右同一行,
    // 2026-09-22 前落在底部签名区(与设计不符);负责人由登录人锁定,渲染按字段级只读
    { num: '8', label: '负责人', key: '负责人', max: 50, h: 40, kind: 'input',
      second: { label: '编制日期', key: '编制日期', kind: 'date' } },
  ],
  signCells: [],
}

/**
 * ═══ 品质管理八单据(YJ-QR-11/59/60/64/92/118/119/120):按原表格版式渲染 ═══
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
    titlePart1: '不合格品分析报告', titlePart2: '制程', titlePart3: '',
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
    titlePart1: '不合格品处理单', titlePart2: '制程', titlePart3: '',
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
    titlePart1: '特采申请单', titlePart2: '', titlePart3: '',
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
      { kind: 'pairs', cells: [
        { label: '严重程度', key: '严重程度', kind: 'checks', options: ['严重', '一般', '轻微'], flex: 1.7 },
        { label: '不良说明', key: '不良说明', flex: 2 },
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
      { kind: 'section', label: '二．最终处理结果', key: '最终处理结果', h: 60,
        checks: ['正常使用', '挑选使用'] },
    ],
    signKind: 'plain',
    signCells: qcSignStd('编制人'),
  },

  // YJ-QR-64 不合格品处理单(自制物料)
  QC_BHZ: {
    docno: 'YJ-QR-64',
    titlePart1: '不合格品处理单', titlePart2: '自制物料', titlePart3: '',
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
    titlePart1: '紧急放行通知单', titlePart2: '', titlePart3: '',
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
    titlePart1: '试产材料使用申请单', titlePart2: '', titlePart3: '',
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
    titlePart1: '来料异常分析报告', titlePart2: '', titlePart3: '',
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
    titlePart1: '生产异常分析报告', titlePart2: '', titlePart3: '',
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
