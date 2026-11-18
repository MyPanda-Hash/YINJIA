package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 工序检验单的**数据驱动出单**深模块(2026-10-18)。
 *
 * <h3>为什么要它</h3>
 * 手机端(PDA/小程序/参考库)报工是**直连数据库写 {@code scjl}** 的,不生成 MES 的报工单、更不会走审核。
 * 原来的检验单只挂在 {@code ButtonService.runWoAuditHooks}(报工单审核)上 ⇒ 手机端报工**永远不会出检验单**
 * (实测 2026-10-18 备份库:GD-2026-10-0011 成型/切炭/组装各 270 件全部直写完工,首件/制程/组装三张单一张都没有)。
 *
 * <p>用户口径(2026-10-18):
 * 「手机端报工是直接写入当前数据库表……检验单生成的形式修改为当前**排产转产线**相同的形式实现,
 * 只要当前报工数量达到当前要求就可以进入到下一步。」
 * ⇒ 判据从「有没有报工单审核」改成「**该工序累计已报工量是否达到该道计划量**」,
 * 与 {@code ProcessTaskService.applyNextProcess}(转序)同一个达标口径:
 * 数据一满足就出单,不需要任何单据动作。</p>
 *
 * <h3>触发面(两处共用,禁止各写一份)</h3>
 * <ol>
 *   <li>手机端报工吸收 {@link ExternalReportAbsorbService} —— 每吸收一行成功后调用;</li>
 *   <li>MES 报工单审核 {@code ButtonService.woInspGenerate} —— 审核后按同一判据出单。</li>
 * </ol>
 *
 * <h3>商品开关闸(2026-11-14)</h3>
 * <p>商品档案 {@code bs_inv.是否过程检验} = 是 才自动出单;否 / 空 / 档案里查不到 = **不自动出单**
 * (默认否,用户 2026-11-14 拍板)。该开关**只管自动生成**:三张单的手工新增入口
 * ({@code QcFirstInspController} / {@code QcProcInspController} / {@code QcAsmInspController})
 * 不经过本类,因此不受影响 —— 用户原话「如果那个工单需要被手工新增检验单也是可以手动新增的,
 * 就是自动生成不进行了」。判据见 {@link #processInspectionOn(String)}。</p>
 * 本类**只判定 + 组装单头**(纯查询,无写库),保存与占用链由调用方做 —— 这样它不依赖
 * {@code ButtonService}(那边依赖本类,反向依赖会成环)。
 *
 * <h3>工序 → 检验单</h3>
 * <ul>
 *   <li>{@code 成型}(第一个工序)**当天首次报工** ⇒ 首件检验单 {@code QC_FIRST_INSP} —— 🔴 2026-11-12
 *       口径变更:不再等「成型累计达计划量」,改成**每天一个生产批次** —— 当天第一笔成型报工就出单,
 *       一天一张、与数量无关(用户原话:「按每天一个生产批次吧,就是每天的第一个工序报工一次后就产生。」);</li>
 *   <li>{@code 成型} 累计达计划量 ⇒ 制程检验单 {@code QC_PROC_INSP}(2026-10-18 口径;
 *       **2026-11-12 明确「制程的先不处理」**,与首件脱钩后保持原判据);</li>
 *   <li>{@code 组装/装箱} ⇒ 出货检验表观 {@code QC_ASM_INSP} —— 🔴 2026-11-12 口径变更:不再等
 *       「组装累计达计划量」,改成**进入组装/装箱环节就出单**(判据见 {@link AsmInspEntry})。
 *       用户原话:「出货表观在组装/装箱环节就要进行检验……在进入到组装/装箱这个工序或者产线的时候就
 *       生成这个出货表观的表单」;</li>
 *   <li>切炭/混料 不出单(2026-10-16 成型/切炭两张工序检验单已下架;混料无载体)。</li>
 * </ul>
 *
 * <h3>计划量取数(逐级兜底,取不到不瞎猜)</h3>
 * ① 预排台账 {@code wo_process_line.计划数量}(该工单行该工序);
 * ② 工单行 {@code plang.pl_sl} × 工艺路线 {@code bs_route.换算率};
 * ③ 都为 0 ⇒ 不做数量门禁(有已报工就出单),与旧行为一致 —— 老工单没有台账时不会永远出不了单。
 *
 * <h3>幂等</h3>
 * <ul>
 *   <li>首件检验单:唯一键 = {@code (工单号, 工单行号, 单据日期)} —— **一天一张**(2026-11-12);
 *       同一工单行同一天重复报工不再出单,次日再报则再出一张;</li>
 *   <li>制程检验单 / 出货检验表观:唯一键 = {@code (工单号, 工单行号)};已有存活单则跳过(作废后可再次生成)。</li>
 * </ul>
 */
@Service
public class QcInspAutoService {

    /** 一张待保存的检验单草稿(调用方负责 save + 写占用链) */
    public record Draft(String panelCode, Map<String, Object> head, boolean entryTriggered) {
        /** 兼容旧构造(按报工工序触发的那几张单) */
        public Draft(String panelCode, Map<String, Object> head) {
            this(panelCode, head, false);
        }
    }

    /**
     * 一次判定的结果。
     *
     * @param drafts 要生成的草稿(空 = 不生成)
     * @param reason 不生成时的原因(界面/回执直接显示;生成为空串)
     * @param op     报工工序
     * @param done   该工序累计已报工量
     * @param plan   该工序计划量(0 = 无数量门禁)
     */
    public record Result(List<Draft> drafts, String reason, String op, double done, double plan) {
        public boolean empty() { return drafts.isEmpty(); }
    }

    /**
     * **第一个工序**(首件检验单的触发工序)—— 与 {@code bs_route.工序名称}、{@code scjl.gxdm} 同一份字典值;
     * 改工艺口径只改这一处。首件≠"路线第一道"的动态推断:现役路线首道就是成型,而首件检验本来就是
     * **成型那道工序的质检数据**(见 {@link WoInspGate#GATE_OP}、{@link ScheduleBoardService} 追溯段)。
     */
    private static final String FIRST_OP = "成型";

    /** 首件检验单(每天一张:该工单行成型当天首笔报工即出,2026-11-12) */
    public static final String FIRST_PANEL = "QC_FIRST_INSP";

    /** 制程检验单(成型累计达计划量,2026-10-18 口径不变) */
    public static final String PROC_PANEL = "QC_PROC_INSP";

    /**
     * 工序 → 检验单面板(顺序即出单顺序;改口径只改这一处)。
     *
     * <p>🔴 2026-11-12 口径变更:这张表**只剩制程** ——
     * ①「组装」不再走这里:出货检验表观改成「进入组装/装箱环节」触发(判据 {@link AsmInspEntry}),
     *    与报工工序不再绑定;②「首件」不再走这里:改成「成型当天首笔报工即出、一天一张」,
     *    由 {@link #build} 的 ① 分支单独判定(它不再要求达计划量)。</p>
     *
     * <p>🔴 2026-10-29 修正(实测,必须记下来):2026-10-21 曾把成型改成只出 {@code QC_MOLD_INSP}
     * (前提是「首件/制程两张单及其表已下架」)——**该前提到 2026-10-29 已不成立**:
     * 现库 yj_panel + sys.tables 双证 {@code QC_FIRST_INSP}(qc_first_insp_head 425 行)、
     * {@code QC_PROC_INSP}(qc_proc_insp_head 434 行)、{@code QC_ASM_INSP}(435 行)三张单都在用,
     * 而 {@code qc_mold_insp_head}/{@code qc_cut_insp_head} 不存在(2026-10-16 已下架)。
     * ⇒ 继续出 QC_MOLD_INSP 会让**任何一次成型报工审核直接回滚**(INSERT 报「对象名无效」),
     * 现场表现为「报工提交不了」;2026-10-29 已由本修正恢复成首件 + 制程两张单。
     * 与 {@link ScheduleBoardService} 的追溯检验段、{@link ButtonService} 的弃审级联同一口径。
     */
    private static final Map<String, List<String>> OP_PANELS = Map.of(
            FIRST_OP, List.of(PROC_PANEL));

    /** 出货检验表观(2026-11-11 起由「组装成品检验单」改显示名;代号/表/单号前缀不动) */
    public static final String ASM_PANEL = "QC_ASM_INSP";

    /** 面板 → 头表(幂等查重;取值全是本类常量,无拼接注入面) */
    private static final Map<String, String> HEAD_TABLE = Map.of(
            FIRST_PANEL, "qc_first_insp_head",
            PROC_PANEL, "qc_proc_insp_head",
            ASM_PANEL, "qc_asm_insp_head");

    private final JdbcTemplate jdbc;

    public QcInspAutoService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 按一条报工行判定并组装检验单草稿。
     *
     * @param scjlId 报工行 id({@code scjl.id});调用方已确认该行未作废
     * @param repNo  报工单号(手机端直写时为空串;仅用于表头留痕)
     *
     * <p>⚠ 单头**不写「检验员」**(2026-10-21 用户口径):它就是纸面上签字的人,
     * 只能来自"此刻在电脑前操作的人"。原来的 {@code user}(触发人/吸收人)在后台定时吸收时
     * 是 {@code system(手机端报工吸收)},写进签名格没有意义 ⇒ 改为留空,由
     * {@code ButtonService.defaultQcInspector} 在保存时按当前电脑端登录人姓名兜底,
     * PC 打开草稿时前端也会先带出(见 {@code core/qc/qcInspector.js})。
     */
    public Result build(long scjlId, String repNo) {
        Map<String, Object> r = loadReportRow(scjlId);
        if (r == null) return new Result(List.of(), "报工行不存在或已作废", "", 0, 0);

        String wo = str(r.get("工单号"));
        String op = str(r.get("工序"));
        if (wo.isEmpty() || op.isEmpty()) {
            return new Result(List.of(), "报工行缺工单号/工序,无法判定", op, 0, 0);
        }

        int xc = (int) num(r.get("行号"));
        Map<String, Object> p = resolvePlangRow(wo, xc, (long) num(r.get("gd_id")), str(r.get("批次号")));
        if (p == null) {
            return new Result(List.of(), "定位不到唯一工单行(缺工单行号/gd_id,批次也不唯一),暂不出单", op, 0, 0);
        }
        long rowId = (long) num(p.get("id"));
        if (xc == 0) xc = (int) num(p.get("pl_xc"));

        // ── ⓪ 商品开关闸(2026-11-14):bs_inv.是否过程检验 = 是 才自动出单 ──
        //    用户口径:「在商品中增加是否过程检验……确定是否走过程检验流程;但是如果那个工单需要被
        //    手工新增检验单也是可以手动新增的,就是自动生成不进行了。」
        //    ⇒ 只管自动生成,三张单的手工入口不经过本类(见类头「商品开关闸」)。
        //    取**工单行**的产品编码(plang.dm)为准:检验单是给这个工单行生产的商品开的;
        //    报工行 wzdm 老数据可能指向别的行(实测同工单多行重复行号),只作兜底。
        String productCode = firstNonBlank(str(p.get("dm")), str(r.get("产品编码")));
        if (!processInspectionOn(productCode)) {
            String shown = productCode.isBlank() ? "(空)" : "「" + productCode + "」";
            return new Result(List.of(),
                    "商品" + shown + "「是否过程检验」未设为是,按商品设置不自动生成检验单"
                            + "(需要时可在检验单界面手工新增)", op, 0, 0);
        }

        List<Draft> drafts = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> reasons = new ArrayList<>();
        double opDone = 0;
        double opPlan = 0;

        // ── ① 首件检验单(成型 = 第一个工序):每天一张,当天首次报工即出(2026-11-12 用户口径)──
        //    用户原话:「按每天一个生产批次吧,就是每天的第一个工序报工一次后就产生。」
        //    ⇒ 不再等「成型累计达计划量」(2026-10-18 口径);日期取**报工日期**
        //    (sc_date → wgsj → asp_time1,与 WorkOrderDayPlanService.actualByDate 同一口径),
        //    同一工单行同一天已有存活单就不重复出(次日再报会再出一张)。
        if (FIRST_OP.equals(op)) {
            String day = str(r.get("报工日期"));
            if (day.isBlank()) day = LocalDate.now().toString();
            if (existsLiveOnDay(FIRST_PANEL, wo, xc, day)) {
                skipped.add(FIRST_PANEL + "(当天)");
            } else {
                drafts.add(new Draft(FIRST_PANEL,
                        firstInspHead(r, p, op, xc, num(r.get("数量")), repNo, day)));
            }
        }

        // ── ② 制程检验单(成型):累计已审报工 ≥ 该道计划量(2026-10-18 口径;2026-11-12「制程先不处理」)──
        List<String> panels = OP_PANELS.get(op);
        if (panels != null && !panels.isEmpty()) {
            opPlan = planQty(wo, rowId, op, p);
            opDone = WoInspGate.reportedQty(jdbc, wo, rowId, op);
            boolean reached = opPlan <= 0 ? opDone > 0 : opDone + 0.0001 >= opPlan;
            if (!reached) {
                reasons.add("该工序累计已报工 " + trim(opDone) + " < 计划 " + trim(opPlan) + ",未达标暂不出单");
            } else {
                for (String panel : panels) {
                    if (existsLive(panel, wo, xc)) {
                        skipped.add(panel);
                        continue;
                    }
                    drafts.add(new Draft(panel, head(panel, r, p, op, xc, opDone, repNo)));
                }
            }
        } else if (!FIRST_OP.equals(op) && !AsmInspEntry.isAsmOp(op)) {
            reasons.add("工序「" + op + "」不出检验单");
        }

        // ── ③ 出货检验表观:进入**末道工序**即出(2026-11-18 口径;判据在 AsmInspEntry)──
        //    与①②互不绑定:切炭报工把量流进组装/组装装箱时会出;末道自己报工也会出(此时①②本来就没有这张单)。
        AsmInspEntry.Status asm = AsmInspEntry.of(jdbc, rowId);
        if (asm.entered()) {
            if (existsLive(ASM_PANEL, wo, xc)) {
                skipped.add(ASM_PANEL);
            } else {
                drafts.add(new Draft(ASM_PANEL, asmInspHead(r, p, asm, xc, repNo), true));
            }
        } else if (!asm.reason().isBlank()) {
            reasons.add(asm.reason());
        }

        String reason;
        if (!drafts.isEmpty()) {
            reason = "";
        } else if (!skipped.isEmpty()) {
            reason = "已达出单条件,但 " + String.join("/", skipped) + " 已有存活单(幂等跳过)";
        } else {
            reason = String.join("；", reasons);
        }
        return new Result(drafts, reason, op, opDone, opPlan);
    }

    // ────────────────────────────── 单头组装 ──────────────────────────────

    private Map<String, Object> head(String panel, Map<String, Object> r, Map<String, Object> p,
                                     String op, int xc, double done, String repNo) {
        // ⚠ 各单的「检验员」**都不在这里写**(2026-10-21):后台定时吸收没有登录人,
        //   写 system 占位没有意义;真值 = 保存时在电脑前操作的那个人,见
        //   ButtonService.defaultQcInspector(保存兜底)+ core/qc/qcInspector.js(打开即带出)。
        // 2026-11-12:首件改按天出(build ① 直接调 firstInspHead)、出货检验表观按「进入组装/装箱」出
        //   (见 asmInspHead / AsmInspEntry),本方法只剩制程走这里。
        return switch (panel) {
            case "QC_PROC_INSP" -> procInspHead(p, xc, done, op, repNo);
            default -> Map.of();
        };
    }

    /**
     * 首件检验单(2026-11-12:成型**当天首笔报工**即出,一天一张;头照抄报工行 + 工单行):
     * <ul>
     *   <li>「单据日期 / 检验日期」= 该报工的**报工日期**({@code yyyy-MM-dd},每天一个生产批次),
     *       不是服务器当天 —— 补录/跨零点审核时纸面日期跟着业务日期走;</li>
     *   <li>「报工数量」= 触发本次出单的那笔报工数量(当天首笔成型报工);</li>
     *   <li>明细按《成型工艺清单》RD_MOLD_PROC 预铺;</li>
     *   <li>生产日期/批号由工单行**首批完工**时回填(见 {@link FirstInspBackfill})——出单时先留空,
     *       2026-11-12 用户口径「先做后回填」。</li>
     * </ul>
     */
    private Map<String, Object> firstInspHead(Map<String, Object> r, Map<String, Object> p, String op,
                                              int xc, double qty, String repNo, String day) {
        String wo = str(r.get("工单号"));
        String productCode = firstNonBlank(str(r.get("产品编码")), str(p.get("dm")));
        String batch = str(r.get("批次号"));

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", day);
        head.put("检验日期", day);
        head.put("工单号", wo);
        if (xc != 0) head.put("工单行号", xc);
        if (!repNo.isBlank()) head.put("报工单号", repNo);
        head.put("工序", op);
        head.put("批次号", batch);
        long rowId = (long) num(p.get("id"));
        Map<String, String> completed = FirstInspBackfill.completedBatch(jdbc, rowId);
        if (completed != null) {
            if (!completed.get("批次号").isBlank()) head.put("批次号", completed.get("批次号"));
            head.put("生产日期", completed.get("生产日期"));
        }
        head.put("产品编码", productCode);
        head.put("产品名称", firstNonBlank(str(r.get("产品名称")), str(p.get("mc"))));
        String spec = firstNonBlank(str(r.get("规格型号")), str(p.get("gg")));
        if (!spec.isEmpty()) head.put("规格型号", spec);
        String custCode = str(p.get("客户代码"));
        if (!custCode.isEmpty()) head.put("客户代码", custCode);
        String custName = str(p.get("客户名称"));
        if (!custName.isEmpty()) head.put("客户名称", custName);
        String line = firstNonBlank(str(r.get("生产线")), str(p.get("scx")));
        if (!line.isEmpty()) {
            head.put("生产线", line);
            String shop = lineShop(line);
            if (shop != null) head.put("生产车间", shop);
        }
        head.put("报工数量", round(qty));
        FirstInspItems.Result items = FirstInspItems.load(jdbc, productCode);
        if (items.docNo() != null) head.put("工艺清单单号", items.docNo());
        head.put("detail", Map.of("items", items.rows()));
        return head;
    }

    /** 制程检验单(与 {@code QcProcInspController.fromWoLine} 同一套字段;明细留空由品质带入) */
    private Map<String, Object> procInspHead(Map<String, Object> p, int xc, double done, String op,
                                             String repNo) {
        String today = LocalDate.now().toString();
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", today);
        head.put("检验日期", today);
        head.put("工单号", str(p.get("pl_no")));
        if (xc != 0) head.put("工单行号", xc);
        head.put("工序", op);
        if (!repNo.isBlank()) head.put("报工单号", repNo);
        head.put("报工数量", round(done));
        head.put("产品编码", str(p.get("dm")));
        head.put("产品名称", str(p.get("mc")));
        String spec = str(p.get("gg"));
        if (!spec.isEmpty()) head.put("规格型号", spec);
        String batch = str(p.get("批次号"));
        if (!batch.isEmpty()) head.put("批次号", batch);
        String line = str(p.get("scx"));
        if (!line.isEmpty()) {
            head.put("生产线", line);
            String shop = lineShop(line);
            if (shop != null) head.put("生产车间", shop);
        }
        head.put("检验类别", "制程检验");
        // 「检验方案」**默认值**(2026-11-06 用户口径「抽检方案固定写(出货控制计划执行)」;
        //   同日第二轮「默认为这个的情况下也能进行修改」⇒ 字段可编辑,这里只是自动出单的初值)：
        // 自动出单在这里写默认值;人工建单/保存走 ButtonService.save() 的"空值兜底默认"(不覆盖用户改过的值)。
        // 两处各一处字面量(本类被 ButtonService 依赖、不能反向引用那边),改口径两处一起改。
        head.put("检验方案", "出货控制计划执行");
        head.put("detail", Map.of("items", List.of()));
        return head;
    }

    /**
     * **出货检验表观**(QC_ASM_INSP,原组装成品检验单):进入末道工序即出单(2026-11-18 口径)。
     *
     * <p>「工序」取**末道工序**(组装 / 装箱 / 组装装箱 都算),不是触发那条报工的工序 ——
     * 切炭报工把量流进末道时,表观单上的工序必须是末道那道而不是「切炭」。
     *
     * <p>「报工数量」= 进入本环节的**可加工量**(上游已审报工折成品流下来的量);若该道已经报过工,
     * 至少取已报工量 —— 原来写的是「组装累计已报工」,提前出单那一刻它还是 0,纸面会像个空单。
     *
     * <p>明细按《出货检验计划表》预铺外观/尺寸/出货重量三类({@link AsmInspItems});与自动出单同一份,
     * 手工「选生产工单」建的与自动出的长得一样。
     */
    private Map<String, Object> asmInspHead(Map<String, Object> r, Map<String, Object> p,
                                            AsmInspEntry.Status e, int xc, String repNo) {
        String today = LocalDate.now().toString();
        String productCode = firstNonBlank(str(r.get("产品编码")), str(p.get("dm")));
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("单据日期", today);
        head.put("工单号", firstNonBlank(str(r.get("工单号")), str(p.get("pl_no"))));
        if (xc != 0) head.put("工单行号", xc);
        // 报工单号只在「确实是组装/装箱类报工」时留痕;切炭报工触发的提前出单不写,免得纸面看着像切炭单
        if (!repNo.isBlank() && AsmInspEntry.isAsmOp(str(r.get("工序")))) head.put("报工单号", repNo);
        head.put("工序", e.op());
        // 批次优先取**工单行**的批次(进入组装的是这一行的批次),报工行批次只在工单行没有时兜底
        String batch = firstNonBlank(str(p.get("批次号")), str(r.get("批次号")));
        if (!batch.isEmpty()) head.put("批次号", batch);
        head.put("产品编码", productCode);
        head.put("产品名称", firstNonBlank(str(r.get("产品名称")), str(p.get("mc"))));
        String spec = firstNonBlank(str(r.get("规格型号")), str(p.get("gg")));
        if (!spec.isEmpty()) head.put("规格型号", spec);
        // 生产线取**末道那道**的实际线(自动补线后 plang.scx 已切到该线;台账实际线更准)
        String line = firstNonBlank(e.line(), firstNonBlank(str(r.get("生产线")), str(p.get("scx"))));
        if (!line.isEmpty()) {
            head.put("生产线", line);
            String shop = lineShop(line);
            if (shop != null) head.put("生产车间", shop);
        }
        head.put("报工数量", round(Math.max(e.avail(), e.done())));
        head.put("检验日期", today);
        AsmInspItems.Result items = AsmInspItems.load(jdbc, productCode);
        head.put("detail", Map.of("items", items.rows()));
        return head;
    }

    /**
     * **手工路径**「选生产工单」建表观单:按工单行 id 组装表头 + 预铺明细。
     *
     * <p>与自动出单共用 {@link #asmInspHead} 同一份组装逻辑;调用方(控制器)已做准入判定与幂等查重。
     * 按 id 定行(而不是按 工单号+行号):实测存在同一工单两行「行号=1」的旧数据。
     *
     * @return 可直接交给 {@code ButtonService.save} 的表头;该行不存在/作废时返回 {@code null}
     */
    public Map<String, Object> asmInspHeadForRow(long rowId, int xc) {
        Map<String, Object> p = plangRowById(rowId);
        if (p == null) return null;
        AsmInspEntry.Status e = AsmInspEntry.of(jdbc, rowId);
        if (!e.entered()) return null;
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("工单号", str(p.get("pl_no")));
        r.put("工序", e.op());
        r.put("产品编码", str(p.get("dm")));
        r.put("产品名称", str(p.get("mc")));
        r.put("规格型号", str(p.get("gg")));
        r.put("批次号", str(p.get("批次号")));
        r.put("生产线", str(p.get("scx")));
        int lineNo = xc != 0 ? xc : (int) num(p.get("pl_xc"));
        return asmInspHead(r, p, e, lineNo, "");
    }

    // ────────────────────────────── 取数 ──────────────────────────────

    /**
     * 商品档案「是否过程检验」开关(2026-11-14,列见
     * {@code tools/migrate-inv-process-inspection-20261114.sql})。
     *
     * <p>用户口径:「商品中增加是否过程检验,确定是否走过程检验流程;但是那个工单需要被手工新增
     * 检验单也是可以手动新增的,就是自动生成不进行了。」⇒ <b>只管自动出单</b>。</p>
     *
     * <p><b>取值口径</b>:只有明确 = 是(bit=1)才自动出单;否 / NULL / 商品档案里没有该编码
     * ⇒ 不自动出单(默认否,2026-11-14 用户拍板)。</p>
     *
     * <p><b>为什么异常时返回 true(按旧行为出单)</b>:自动出单是报工审核/吸收链路上的**附带动作**,
     * 不能让一次"开关列还没迁移 / 表临时不可读"的失败把报工审核整体回滚(报工审核那条路出单失败
     * 会连带回滚审核);宁可这次照旧出单,也不能把生产报工卡死。日常判据不受影响。</p>
     */
    private boolean processInspectionOn(String productCode) {
        if (productCode == null || productCode.isBlank()) return false;
        try {
            // 一次 EXISTS 查询同时解决两件事:① 编码两侧历史空格(比较前 TRIM);② 同一编码在档案里
            // 有多行时(实测 bs_inv 有 1 组重复码)只要有一行 = 是就算「是」——不会因为 TOP 1 随机取到
            // 另一行而把该商品静默排除在自动出单之外。
            Integer yes = jdbc.queryForObject(
                    "SELECT CASE WHEN EXISTS (SELECT 1 FROM dbo.bs_inv"
                            + "   WHERE LTRIM(RTRIM(存货编码)) = ? AND ISNULL([是否过程检验], 0) = 1)"
                            + " THEN 1 ELSE 0 END",
                    Integer.class, productCode.trim());
            return yes != null && yes == 1;
        } catch (Exception e) {
            return true;
        }
    }

    private Map<String, Object> loadReportRow(long scjlId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT s.id, ISNULL(s.gldh,N'') AS 工单号, ISNULL(s.gxdm,N'') AS 工序, ISNULL(s.sl,0) AS 数量,"
                        + " ISNULL(s.[批次号],N'') AS 批次号, ISNULL(s.[工单行号],0) AS 行号,"
                        + " ISNULL(s.gd_id,0) AS gd_id, ISNULL(s.[报工单号],N'') AS 报工单号,"
                        + " ISNULL(s.scx,N'') AS 生产线, ISNULL(s.wzdm,N'') AS 产品编码,"
                        + " ISNULL(s.mc,N'') AS 产品名称, ISNULL(s.gg,N'') AS 规格型号,"
                        // 报工日期(2026-11-12 首件按天出单用):与 WorkOrderDayPlanService.actualByDate
                        // 同一口径 —— 单据日期(sc_date)→ 完工时刻(wgsj)→ 录入时刻(asp_time1) 逐级回落,
                        // 别让没填单据日期的老报工在日期维度上消失。
                        + " CONVERT(varchar(10), CAST(COALESCE(s.sc_date, s.wgsj, s.asp_time1) AS date), 120) AS 报工日期"
                        + " FROM dbo.scjl s WHERE s.id=? AND ISNULL(s.asp_cancel,'N')<>'Y'",
                scjlId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * 工单行定位(三级,与 {@code ExternalReportAbsorbService.resolveRow} 同口径):
     * ① 工单号 + 工单行号 → ② gd_id → plang_pc.plang_id → ③ 工单号 + 批次号(恰一行才认)。
     */
    private Map<String, Object> resolvePlangRow(String wo, int xc, long gdId, String batch) {
        // ① gd_id 最可靠(手机端报工自带 plang_pc.id;2026-10-18 实测同工单存在两行「行号=1」,
        //    只按行号会选到旧行 ⇒ 计划量/批次全错)。
        if (gdId > 0) {
            List<Map<String, Object>> r = jdbc.queryForList(
                    PLANG_COLS + " JOIN dbo.plang_pc pc ON pc.plang_id = p.id"
                            + " WHERE pc.id=? AND ISNULL(p.asp_cancel,'N')<>'Y' AND ISNULL(pc.asp_cancel,'N')<>'Y'",
                    gdId);
            if (!r.isEmpty()) return r.get(0);
        }
        // ② 工单号 + 工单行号(恰一行才认;多行说明数据有重复,交给 gd_id/批次)
        if (xc > 0) {
            List<Map<String, Object>> r = jdbc.queryForList(
                    PLANG_COLS + " WHERE p.pl_no=? AND ISNULL(p.pl_xc,0)=? AND ISNULL(p.asp_cancel,'N')<>'Y' ORDER BY p.id",
                    wo, xc);
            if (r.size() == 1) return r.get(0);
        }
        // ③ 工单号 + 批次号(恰一行才认)
        if (!batch.isBlank()) {
            List<Map<String, Object>> r = jdbc.queryForList(
                    PLANG_COLS + " WHERE p.pl_no=? AND ISNULL(p.[批次号],N'')=? AND ISNULL(p.asp_cancel,'N')<>'Y'"
                            + " ORDER BY p.id", wo, batch);
            if (r.size() == 1) return r.get(0);
        }
        return null;
    }

    /** 工单行取数(单行;手工建单按 id 定行,避免「同一工单存在重复行号」时定位不到) */
    private Map<String, Object> plangRowById(long rowId) {
        List<Map<String, Object>> r = jdbc.queryForList(
                PLANG_COLS + " WHERE p.id=? AND ISNULL(p.asp_cancel,'N')<>'Y'", rowId);
        return r.isEmpty() ? null : r.get(0);
    }

    /** 工单行取数公共列(两处定位共用;改列只改这里) */
    private static final String PLANG_COLS = "SELECT p.id, ISNULL(p.pl_no,N'') AS pl_no,"
            + " ISNULL(p.pl_xc,0) AS pl_xc, ISNULL(p.dm,N'') AS dm, ISNULL(p.mc,N'') AS mc,"
            + " ISNULL(p.gg,N'') AS gg, ISNULL(p.scx,N'') AS scx, ISNULL(p.khdm,N'') AS 客户代码,"
            + " ISNULL(dk.mc,N'') AS 客户名称, ISNULL(p.[工艺路线],N'') AS 工艺路线,"
            + " ISNULL(p.pl_sl,0) AS pl_sl, ISNULL(p.[批次号],N'') AS 批次号"
            + " FROM dbo.plang p LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm";

    /**
     * 该工单行该道工序的**计划量**:①预排台账 → ②排产数量×路线换算率 → ③0(不做数量门禁)。
     */
    private double planQty(String wo, long rowId, String op, Map<String, Object> p) {
        try {
            List<Double> ledger = jdbc.queryForList(
                    "SELECT TOP 1 ISNULL(计划数量,0) FROM dbo.wo_process_line"
                            + " WHERE 工单号=? AND 工单行id=? AND 工序=? AND ISNULL(asp_cancel,'N')<>'Y'",
                    Double.class, wo, rowId, op);
            if (!ledger.isEmpty() && ledger.get(0) != null && ledger.get(0) > 0) {
                return round(ledger.get(0));
            }
        } catch (Exception e) {
            // 台账缺列/缺表不阻断出单,退到路线换算率
        }
        double plSl = num(p.get("pl_sl"));
        if (plSl <= 0) return 0;
        double rate = 1;
        String route = str(p.get("工艺路线"));
        if (!route.isBlank()) {
            try {
                List<Double> rs = jdbc.queryForList(
                        "SELECT TOP 1 ISNULL(换算率,1) FROM dbo.bs_route"
                                + " WHERE 工艺路线编码=? AND 工序名称=? AND ISNULL(asp_cancel,'N')<>'Y'",
                        Double.class, route, op);
                if (!rs.isEmpty() && rs.get(0) != null && rs.get(0) > 0) rate = rs.get(0);
            } catch (Exception e) {
                rate = 1;
            }
        }
        return round(plSl * rate);
    }

    /** 该面板在该工单行上是否已有存活单(幂等键 = 工单号 + 工单行号) */
    private boolean existsLive(String panel, String wo, int xc) {
        String table = HEAD_TABLE.get(panel);
        if (table == null) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo." + table + " WHERE 工单号=? AND ISNULL(工单行号,0)=?"
                        + " AND ISNULL(asp_cancel,'N')<>'Y'",
                Integer.class, wo, xc);
        return n != null && n > 0;
    }

    /**
     * 该面板在该工单行上**某一天**是否已有存活单(首件检验单「每天一张」的幂等键,2026-11-12)。
     *
     * <p>日期取单据头「单据日期」({@code qc_first_insp_head.单据日期} 实测是 {@code date} 列);
     * {@code day} 由 Java 侧按业务日期算好传 {@code yyyy-MM-dd},SQL 侧 {@code CAST(? AS date)}
     * —— **不用 {@code GETDATE()}**:SQL Server 在 Docker 里是 UTC,取当天会错日
     * (与 {@code WoReportService} 墙钟口径同一教训)。</p>
     */
    private boolean existsLiveOnDay(String panel, String wo, int xc, String day) {
        String table = HEAD_TABLE.get(panel);
        if (table == null) return false;
        Integer n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo." + table + " WHERE 工单号=? AND ISNULL(工单行号,0)=?"
                        + " AND ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 = CAST(? AS date)",
                Integer.class, wo, xc, day);
        return n != null && n > 0;
    }

    /** 产线 → 生产车间(bs_prod_line 的属性;查不到返回 null,不阻断建单) */
    private String lineShop(String line) {
        if (line == null || line.isBlank()) return null;
        List<String> s = jdbc.queryForList(
                "SELECT TOP 1 ISNULL(生产车间,N'') FROM dbo.bs_prod_line WHERE 生产线=? AND ISNULL(asp_cancel,'N')<>'Y'",
                String.class, line);
        return s.isEmpty() || s.get(0).isBlank() ? null : s.get(0);
    }

    private static String firstNonBlank(String a, String b) {
        return a == null || a.isBlank() ? (b == null ? "" : b) : a;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static double num(Object o) {
        if (o == null) return 0;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String trim(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }

    private static double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
