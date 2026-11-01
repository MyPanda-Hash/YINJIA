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
  // ⚠ 2026-10-08 起 **RD_PLAN 的「负责人」不再锁当前登录人**:
  //   研发流程图(m01625 用户口径)要求「确认责任人之后就可以在项目实施计划里面进行对应单据的填写」——
  //   计划单的负责人必须来自**立项申请表上确认过的项目责任人**,而不是谁点「新增」就写谁。
  //   链路:立项申请 · 项目责任人(账号) → REF_SYNONYMS(项目责任人 → 负责人) → 选「文档编号」参照时带入
  //   RD_PLAN.负责人(该字段 yj_field.editable=0,本来就只读,不带入就永远空)。
  // 检验数据记录(YJ-QR-96 检验报告):原表「检验人=账号登录人自动生成」——由登录用户锁定填入
  QC_INSP_REC: '检验人',
  // 2026-09-18:出货检验计划表「编写人」= 编写人固定登录账号人员(设计原文),元数据 editable=0
  RD_INSP_PLAN: '编写人',
  // 2026-10-28 用户口径「产品信息表的编辑自动填入当前的对应账号姓名」:
  //   「编辑人」= 最后编辑这张单的人。新增时先带当前用户(纸面立即有名字),
  //   任何一次保存(含存草稿)由后端 ButtonService 再按当前登录人回写真名 —— 前端值只是显示层,
  //   落库以服务端为准(yj_field 已改 editable=0,用户不再手输)。
  RD_PROD_INFO: '编辑人',
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
  // (2026-10-19 口径:**纯日期 yyyyMMdd**,如 2026-10-19 ⇒ 20261019;改版前是"供应商编码去 YJ- 前缀 + `-` + 日期"),
  // 并沿 暂收 → 检验 → 入库 逐站继承;前端再"按单据日期预设"会与继承值打架。
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
    // ⚠ 键必须是**字段标签(label)**,不能写成物理列名 —— 这里原写作 '审核人一级'/'审核人二级'
    //   (那是 rd_prod_info_head 的列名),而 yj_field 里这两个字段的 label 是
    //   「审核人（一级审批人）」/「审核人（二级审批人）」。写成列名的后果是**两头都丢**:
    //     · 前端:applyDocDefaults 把值写进 form['审核人一级'],而纸面格子读的是 form['审核人（一级审批人）'] ⇒ 显示为空;
    //     · 保存:后端 labelsToCols 按 label 取值,取不到 ⇒ 静默丢弃,落库恒 NULL。
    //   2026-10-13 实测(测试账套 PI-2026-10-0013):这两列保存后都是 NULL,即此因。
    //   批量核对口径见 tools/archive/_check-docdefaults-keys.sql(2026-10-13 全量比对 35 个键,仅此两处错)。
    // ⚠ 2026-10-29 用户口径:「产品信息表的这个两个审核人默认填写为冯总和陈秀丽,
    //   也可以修改的,保存之后也显示出来,现在没有显示出来」——
    //   一级 = **冯总**(注意:冯总本人用的是 admin 账号,库里没有「冯总」这个 yj_user,
    //     但这两列是**纯展示文字**,审批人匹配走 yj_doc_status.l2_approver(存账号),
    //     不按姓名反查账号 ⇒ 写「冯总」不影响审批权限,见 l2ApproverOf/writeBackL2Approver);
    //   二级 = **陈秀丽**(账号 cp 的真实姓名,分发/审批写回时都按 real_name 落这一格)。
    ['审核人（一级审批人）', '冯总'],
    ['审核人（二级审批人）', '陈秀丽'],
  ],
  // 2026-09-20 出货检验项目控制计划按《出货检验项目控制计划.xlsx》重排为「一张表 7 列」。
  //   设计纸张上写死的那几格(表单管理人=冯敏 / 密级=保密 / 使用范围=全公司 / 审核人=冯加劲)
  //   照录为默认值 —— 走"默认值"而非"锁定只读",因为这几格是业务常值不是身份,
  //   与 RD_PROD_INFO 的两级审批人同款口径。
  //   版本号设计原文是「V + 按照日期来」⇒ 'V@today' 展开成「V2026-09-20」(当天)。
  //   ⚠ 编写人不在这里:它由登录人决定,在 LOCKED_PERSON 里(editable=0,UI 三处按只读渲染)。
  RD_INSP_PLAN: [
    // 2026-10-28 用户口径:「出货检验计划表，默认填写出货检验项目控制计划」。
    // 大标题格 2026-10-19 起是 titleKey='标题' 的输入框(yj_field: required=1),
    // 新建时为空 ⇒ 用户看到的是 placeholder 灰字、保存还被必填拦住(实测正式账套现有 2 张
    // 单据的标题被手填成「cs」)。这是**纸面固定表单名**(YJ-RD001),与下面几条同款:
    // 走默认值(仅空时填),不锁只读 —— 个别客户要改抬头时仍能改。
    ['标题', '出货检验项目控制计划'],
    ['表单管理人', '冯敏'],
    ['密级', '保密'],
    ['使用范围', '全公司'],
    ['审核人', '冯加劲'],
    ['版本号', 'V@today'],
  ],
  // 2026-10-15:成型工艺清单 / 成型配方 / 组装工艺清单 三张表同缺「表单管理人 + 版本号」——
  //   用户报障原文:「审批通过后无法做到自动录入管理人及文件版本号,需要提前手动输入」。
  //   口径与 RD_INSP_PLAN 逐字一致(表单管理人=冯敏,版本号=V+当天)。
  //   2026-10-15 追加(用户口径「也一起补」):同批补上 密级=保密 / 使用范围=全公司 ——
  //   两账套 yj_field 实测这三张表**只有**「密级」(seq 40/40/94)与「使用范围」(50/50/96),
  //   **没有「审核人」字段**(RD_INSP_PLAN 才有,故不给它们加审核人)。
  // ⚠ 键必须是**字段 label**:两张账套 yj_field 实测——
  //   RD_MOLD_PROC/RD_MOLD_FORMULA/RD_ASM_PROC 的 label 都是「表单管理人」(seq 30/30/92)
  //   与「版本号」(seq 60/60/98);同为版本号的 RD_SPEC_DOC 那条 label 是**「版本」**(不是「版本号」),
  //   故本表**不适用**该默认值。label 写错会被后端 labelsToCols 静默丢弃(见 RD_PROD_INFO 段注释)。
  //   顺序按各表 seq 排(密级 → 使用范围 → 版本号),与 RD_INSP_PLAN 那条的写法一致。
  // ⚠ 2026-10-27 用户口径(1027系统使用-产品工艺文件问题点待改善 #7):
  //   「表单管理人:默认为刘磊,密级默认保密;使用范围默认银嘉内部」—— 三条一次性改口径:
  //     表单管理人 冯敏 → **刘磊**;密级 = 保密(不变);使用范围 全公司 → **银嘉内部**。
  //   ⚠ 「银嘉内部」必须在 yj_field.dict_sql 的候选里,否则 el-select 选中后显示不出标签:
  //     实测 RD_MOLD_PROC.使用范围 候选 = 工艺科/成型车间、工程技术中心、银嘉内部、公司内 ⇒ 有。
  RD_MOLD_PROC: [['表单管理人', '刘磊'], ['密级', '保密'], ['使用范围', '银嘉内部'], ['版本号', 'V@today']],
  // 2026-10-30 新增 X烧结工艺清单(RD_X_SINTER):与烧结工艺清单同族口径(表单管理人 刘磊 / 保密),
  //   但「使用范围」取设计模板右上角印的**工艺科/成型车间**(不是银嘉内部)—— 该值必须在候选里,
  //   migrate-x-sinter-panel-20261030.sql 的 dict_sql 已含它;版本号同族走 V@today 占位。
  RD_X_SINTER: [['表单管理人', '刘磊'], ['密级', '保密'], ['使用范围', '工艺科/成型车间'], ['版本号', 'V@today']],
  RD_MOLD_FORMULA: [['表单管理人', '刘磊'], ['密级', '保密'], ['使用范围', '银嘉内部'], ['版本号', 'V@today']],
  // 2026-10-28 用户口径:「组装工艺的表单管理人修改为编辑人的账号姓名,选择产品编号之后就自动带入,
  //   或者进行其他编辑也自动带入」—— 本面板的表单管理人不再写死刘磊,而是**当前登录人姓名**
  //   (函数形式:applyDocDefaults 把 userName 放 ctx;新建时先带,后续任意编辑由
  //    PanelxList 的 EDITOR_STAMP_FIELDS 监视器刷新,保存时 ButtonService 再按当前人回写)。
  //   ⚠ 同批的成型工艺清单/成型配方**不动**(仍为刘磊,用户本次只点了组装工艺)。
  RD_ASM_PROC: [
    ['表单管理人', (form, ctx) => ctx.userName || ''],
    ['密级', '保密'],
    ['使用范围', '银嘉内部'],
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
 * ⚠ 与批次号已**无生成关系**(2026-10-04 起批次号由服务端在生单时取;
 * 2026-10-19 起公式 = **纯日期 yyyyMMdd**,见 BatchService.buildBatchNo)。
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
 * @param {{isNew?: boolean, today?: string, headDefaults?: object}} opts
 *   isNew=新增(才写锁定字段);headDefaults=面板元数据下发的**声明式**默认值
 *   (yj_panel.config.headDefaults,键=字段标签)。声明式优先级低于代码里的 DOC_DEFAULTS
 *   —— 代码里那些是"带业务含义"的(如 申请立项人=提交人),配置这些只是初始选项。
 */
export function applyDocDefaults(panelCode, form, user, opts = {}) {
  if (!form || typeof form !== 'object') return form
  const code = String(panelCode || '')
  const { isNew = false, today = todayStr(), headDefaults = null } = opts

  if (isNew) {
    const locked = lockedPersonLabel(code)
    const name = displayNameOf(user)
    if (locked && name) form[locked] = name
  }

  // 声明式默认值(2026-10-29 用户口径「密级/文件使用范围默认保密、银嘉内部,这些是可以换的」):
  // 只填空格 —— 用户手改过的值不会被抢回默认值。
  if (headDefaults && typeof headDefaults === 'object') {
    for (const [key, val] of Object.entries(headDefaults)) {
      if (!key || val === undefined || val === null) continue
      if (!isEmpty(form[key])) continue
      form[key] = String(val)
    }
  }

  for (const [key, value] of DOC_DEFAULTS[code] || []) {
    if (!isEmpty(form[key])) continue
    // 函数形式默认值:ctx = { today, userName } —— userName 供「表单管理人=编辑人」这类
    // 「按当前登录人现算」的默认值用(2026-10-28)。
    form[key] = typeof value === 'function'
      ? value(form, { today, userName: displayNameOf(user) })
      : expandToday(value, today)
  }
  return form
}
