/**
 * 文书默认值(Doc Sheet Defaults)
 *
 * 新建/起草文书面板时带出的初始值。真源在这里,不要在组件里再写一份。
 * (2026-09-21 起也承载**采购入库单的批次号预设**:该单不是文书面板,但"填单时预设、用户可改"
 *  的语义与这里的"仅空值带出"完全一致,放同处便于一处维护。)
 *
 * 两条口径(2026-09-11 grill 确定):
 *  · **锁定字段**:立项申请的「申请立项人」、实施计划的「负责人」——由当前登录用户决定,
 *    用户不可改(元数据里 editable=0,UI 三处按只读渲染)。只在「新增」时写入;
 *    打开既有单据(isNew=false)一律不碰,否则弃审后再打开会把申请人改成操作人 = 冒名。
 *  · **其余默认值**:仅当为空时填,用户可改(文件管理人/密级/申请立项日期等)。
 *
 * 为什么必须挂在「新增」这一刻:RD_APPROVAL/RD_PLAN 属 DOC_ARCHIVE_PANELS,保存后
 * 管理员=已归档、普通用户=审批中,**都不经过草稿态**;旧实现挂在要求 draftEditable 的
 * watch 上,所以从未执行过。
 */

/** 锁定字段:面板 → 由当前登录用户自动填入的字段标签 */
const LOCKED_PERSON = {
  RD_APPROVAL: '申请立项人',
  RD_PLAN: '负责人',
  // 检验数据记录(YJ-QR-96 检验报告):原表「检验人=账号登录人自动生成」——由登录用户锁定填入
  QC_INSP_REC: '检验人',
  // 2026-09-18:出货检验计划表「编写人」= 编写人固定登录账号人员(设计原文),元数据 editable=0
  RD_INSP_PLAN: '编写人',
}

/** 非锁定默认值:'@today' 占位表示当天日期(可内嵌,如「V@today」⇒ V2026-09-20);函数形式按 (form, ctx) 现算 */
const DOC_DEFAULTS = {
  // 2026-09-22:补「密级=保密」——两份设计纸的右上信息表印的就是它
  // (立项申请表.xlsx G3 / 项目实施计划.xlsx G4);同族面板(FILTER_EFF/SAMPLE_NO/PROD_DOCLIST)早有该默认值
  RD_APPROVAL: [['申请立项日期', '@today'], ['文件管理人', '陈秀丽'], ['密级', '保密']],
  RD_PLAN: [['文件管理人', '陈秀丽'], ['密级', '保密']],
  // 2026-09-22:控制列表纸面印的是「密级=绝密 / 适用范围=工程技术中心」(设计 P2/Q2、P3/Q3)
  RD_PROGRESS: [['文件使用范围', '工程技术中心'], ['密级', '绝密']],
  RD_FILTER_EFF: [['密级', '保密'], ['适用范围', '银嘉内部'], ['测试主题', '伊可普需求2炭棒除VOC测试'], ['表单审核人', '秀丽']],
  // 数据记录表(实验室 8 张)的「审核人」——需求《产品开发系统需求汇总.xlsx》sheet「数据记录表」
  // 第 1 条原文:「都需要审核人(秀丽)」。
  // ⚠ 这里是**纸面签名文本**(默认带出、可人工改),不是审批权:
  //   真审批权在 yj_role_panel.can_approve(陈秀丽挂「研发审核」角色,8 张表全勾),
  //   见 tools/migrate-rd-datarec-reviewer-2026-09-30.sql。
  // ⚠ 落库键是「表单审核人」而不是「审核人」:后者会被 ButtonService.save() 的
  //   body.remove("审核人") 静默丢弃(那是 yj_doc_status.shr 的虚拟字段)——与 QC_INSP_REC 同款口径。
  RD_ALKALINE: [['表单审核人', '秀丽']],
  RD_MINERAL: [['表单审核人', '秀丽']],
  RD_ANTIBACT: [['表单审核人', '秀丽']],
  RD_SCALE: [['表单审核人', '秀丽']],
  RD_RO_PROTECT: [['表单审核人', '秀丽']],
  RD_SOAK: [['表单审核人', '秀丽']],
  RD_DROP_PREC: [['表单审核人', '秀丽']],
  // 检验数据记录(YJ-QR-96 检验报告):原表固定项——文件编码 YJ-QR-96 / 检验依据 YJ-Q-30 / 审核人 固定:冯敏
  // (签名行落库列名是「表单审核人」:叫「审核人」会被 ButtonService 保存时显式丢弃,见该面板迁移注释)
  QC_INSP_REC: [['文件编码', 'YJ-QR-96'], ['检验依据', 'YJ-Q-30'], ['表单审核人', '冯敏'], ['检验日期', '@today']],
  // 采购入库单的「批次号」预设已于 2026-10-04 **移除** —— 批次号现由**生单那一刻**在服务端定稿
  // (供应商编码去掉 YJ- 前缀 + `-` + 生单当天 yyyyMMdd,如 YJ-TX ⇒ TX-20260910),
  // 并沿 暂收 → 检验 → 入库 逐站继承;前端再"按单据日期预设"会与继承值打架(旧值是纯日期,格式也不同)。
  // 真源:BatchService.buildBatchNo / PushGenerateHandler.generateBatch;
  // 手工新建的链路单由 BatchService.syncBatchNo 在保存时按同一公式兜底取号。
  // 2026-09-18 新增(研发管理 × 产品开发最新设计)
  // ⚠ 同批新增的「样品编号表」(RD_SAMPLE_NO)已于 2026-09-30 下架(用户口径「样品编号表删掉」),
  //   它的默认值条目随之移除 —— 见 tools/migrate-drop-sample-no-panel-2026-09-30.sql。
  RD_PROD_DOCLIST: [['密级', '保密'], ['文件使用范围', '工程技术中心'], ['文件管理人', '陈秀丽']],
  // 2026-09-18 第二轮(产品信息表界面调整):
  //   两级审批人**固定填写** 冯总 / 秀丽(用户口径)。
  //   ⚠ 走"默认值"而不是"锁定只读":固定是业务口径,但发文人偶尔需要按实际改
  //     (与 文件管理人=陈秀丽 同款处理);若将来要收紧成不可改,改 yj_field.editable=0 即可。
  RD_PROD_INFO: [
    ['审核人一级', '冯总'],
    ['审核人二级', '秀丽'],
  ],
  // 2026-09-20 出货检验项目控制计划按《出货检验项目控制计划.xlsx》重排为「一张表 7 列」。
  //   设计纸张上写死的那几格(表单管理人=冯敏 / 密级=保密 / 使用范围=全公司 / 审核人=冯加劲)
  //   照录为默认值 —— 走"默认值"而非"锁定只读",因为这几格是业务常值不是身份,
  //   与 RD_PROD_INFO 的两级审批人同款口径。
  //   版本号设计原文是「V + 按照日期来」⇒ 'V@today' 展开成「V2026-09-20」(当天)。
  //   ⚠ 编写人不在这里:它由登录人决定,在 LOCKED_PERSON 里(editable=0,UI 三处按只读渲染)。
  RD_INSP_PLAN: [
    ['表单管理人', '冯敏'],
    ['密级', '保密'],
    ['使用范围', '全公司'],
    ['审核人', '冯加劲'],
    ['版本号', 'V@today'],
  ],
}

/** 该面板由当前用户锁定的字段标签;没有则 null */
export function lockedPersonLabel(panelCode) {
  return LOCKED_PERSON[String(panelCode || '')] || null
}

/** 本地时区的 YYYY-MM-DD(用 UTC 直取会在东八区差一天) */
export function todayStr(d = new Date()) {
  const t = d instanceof Date ? d : new Date(d)
  return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function isEmpty(v) {
  return v === undefined || v === null || String(v).trim() === ''
}

/**
 * 日期 → yyyyMMdd(取前 8 位数字:'2026-09-21' / '2026/09/21' / '20260921' → '20260921')。
 *
 * ⚠ 与批次号已**无生成关系**(2026-10-04 起批次号由服务端在生单时取:
 * 供应商编码去 YJ- 前缀 + `-` + 当天 yyyyMMdd,见 BatchService.buildBatchNo)。
 * 现存唯一用途 = 打印层对**口径上线前的老单**做批次兜底展示
 * (PanelxList「打印标识卡」:头批次号空时退回单据日期推导),纯出参、不写库。
 */
export function docNoFromDate(dateStr) {
  const digits = String(dateStr ?? '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}

/** 展开值里的 '@today'(整串或内嵌:「V@today」⇒ V2026-09-20);没有占位就原样返回 */
function expandToday(value, today) {
  return typeof value === 'string' && value.includes('@today') ? value.split('@today').join(today) : value
}

/** 当前用户显示名(user store 的 realName getter 同口径:姓名优先,退回账号) */
function displayNameOf(user) {
  return String((user && (user.realName || user.userName)) || '').trim()
}

/**
 * 就地套用默认值,返回同一个 form(便于链式调用)。
 * @param {string} panelCode 面板编码
 * @param {object} form 表单(键=字段标签)
 * @param {object} user 当前用户(realName/userName)
 * @param {{isNew?: boolean, today?: string}} opts isNew=新增(才写锁定字段)
 */
export function applyDocDefaults(panelCode, form, user, opts = {}) {
  if (!form || typeof form !== 'object') return form
  const code = String(panelCode || '')
  const { isNew = false, today = todayStr() } = opts

  if (isNew) {
    const locked = lockedPersonLabel(code)
    const name = displayNameOf(user)
    if (locked && name) form[locked] = name
  }

  for (const [key, value] of DOC_DEFAULTS[code] || []) {
    if (!isEmpty(form[key])) continue
    form[key] = typeof value === 'function' ? value(form, { today }) : expandToday(value, today)
  }
  return form
}
