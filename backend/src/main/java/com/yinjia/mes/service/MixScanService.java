package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 手机扫码 · **扫码混料**的取数与落库服务(2026-11-18,取代已下架的「工单扫码领料」)。
 *
 * <h3>用户口径(原话)</h3>
 * 「把 wms 管理-条码管理里面的扫码领料和扫码领料记录和工单扫码领料删除。然后在手机扫码里面加一个
 *  扫码混料的面版。逻辑:扫工单码,带出一级BOM(就是物料清单,之前生产领料的是组装物料清单),
 *  逐项扫物料码,自动获取电子秤的数量(我们系统已经有了(之前的工单扫码领料读的就是这个的数据)),
 *  提交保存一笔,全部扫完,整单保存。保存后自动打印,并且保留单据,重新扫码后进入可以补打印。」
 *
 * <h3>作业链路(2026-11-18 第四轮:两页结构 + 「解锁 → 确认」,与「生产领料」同一套)</h3>
 *
 * <p>用户原话:「扫码混料,应该和生产领料一样也是跳转到单据的明细里面再开始扫物料码,
 * 解锁对应的物料码,然后根据连接电子秤的取数,点击确认。再扫其他的物料解锁,根据电子秤再确认。
 * 全部物料确认完毕后,才可以提交。」</p>
 *
 * <ol>
 *   <li><b>列表页</b>({@code MobileMixScan.vue})=「生产领料」列表页同款:查询 + 扫码定位 +
 *       「未完成 / 已完成」两组 —— {@link #openDocs} = 已确认过料、还没整单提交的工单行;
 *       {@link #docsOf} = 已保存的混料单;</li>
 *   <li><b>明细页</b>({@code MobileMixDoc.vue})=「生产领料单」同款:{@link #taskOf} 一次取齐
 *       抬头 + 明细(混料物料清单的应投 / 已确认实投);扫物料码 → {@link #scanMaterial}
 *       <b>只解锁不落库</b> → 读电子秤 → 点「确认」→ {@link #saveScan} 写入该行;</li>
 *   <li><b>全部物料确认完毕才可提交</b>:{@link #saveDoc} 会再按混料物料清单校一遍,
 *       缺项直接拒绝(界面上的按钮同样置灰)。</li>
 * </ol>
 *
 * <p>与上一版(单页:扫工单→清单→逐笔保存→整单保存)的差别只有两处:① 拆成列表/明细两页;
 * ② 扫物料码变成「解锁」,数量由电子秤填进数量框、点「确认」才落库。
 * 「写入」的语义也与生产领料对齐:**覆盖**——同一物料再确认一次以最后一次秤值为准
 * (上一版是累加,现场重复确认会把实际用量记成两倍)。</p>
 *
 * <h3>为什么落 {@code wo_mixing_list}(混料记录)而不是新开单据表</h3>
 * 那张表就是「混料时通过电子称自动获取的实际用量」的载体(服务器原话的表注释),
 * 现役只读面板「生产过程 → 混料记录」({@code WO_MIXING_LIST})直连它 ——
 * 扫完保存的记录现场立刻能在电脑端查到,不必再造一份数据、也不必补第二套面板/权限/译名。
 * 字段口径与老系统那 8 行完全同构:{@code 单据编号(PL…)/工单号/工单行号/序号/物料编号/物料名称/
 * 计划用量/实际用量/标记(N 保存前 / Y 保存后)/asp_print(打印次数)}。
 *
 * <h3>取料表(2026-11-18 改口径:读《混料物料清单》)</h3>
 * 生产领料读《组装物料清单》({@code bs_asm_bom},组装件:炭棒/垫片…);
 * 混料投的是**炭粉/活性炭**这类原料 ⇒ 读《混料物料清单》({@code bs_mix_bom},面板 {@code MIX_BOM})。
 *
 * <p>🔴 2026-11-18 用户口径:「扫码混料也是一样,扫工单码查询对应的物料清单,带出需要称重的物料,
 * 带入的bom从物料清单改为混料物料清单。」—— 上一版读的是遗留表 {@code mate}(面板 WLBOM《物料清单》),
 * 实测正式库 0 行 ⇒ 扫工单永远带不出料。现改由 {@link MixBomService} 统一取数(定位键 = 产品编号 +
 * 烧结类型;单支含量g 按存货单位换算成单件用量),与「生成工单领料 → 混料领料单」同源,
 * 一套配方不再维护两处。
 *
 * <p>只读取数之外的写操作都限定在本服务内做参数校验与行级过滤(不接通用面板引擎:
 * {@code wo_mixing_list} 是报表型 flat 表,没有 yj_panel 的单据头/审批链)。
 */
@Service
public class MixScanService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MixScanService.class);

    /** 混料单号前缀(与老系统 {@code PL2610210002} 同段位:PL + yyMMdd + 4 位流水) */
    private static final String DOC_PREFIX = "PL";
    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("yyMMdd");
    /** 逐笔保存 = 保存前;整单保存后置 Y(表注释口径:保存前=N,保存后=Y) */
    private static final String MARK_DRAFT = "N";
    private static final String MARK_SAVED = "Y";

    private final JdbcTemplate jdbc;
    /**
     * 混料物料清单取数(2026-11-18 收口):扫码混料与「生成工单领料 → 混料领料单」共用同一份
     * {@code bs_mix_bom} 取数/单位换算,避免两端各读一张表导致"扫码能带出料、领料单却是另一套"。
     */
    private final MixBomService mixBom;

    public MixScanService(JdbcTemplate jdbc, MixBomService mixBom) {
        this.jdbc = jdbc;
        this.mixBom = mixBom;
    }

    // ═══════════════════════ 取数:工单行 + 混料物料清单 ═══════════════════════

    /**
     * 按工单号(+可选行号)取工单行。
     *
     * @param orderNo 工单号({@code plang.pl_no})
     * @param lineNo  工单行号({@code plang.pl_xc});&lt;=0 = 整单全部行
     * @return 每行含 行id/工单号/工单行号/产品编码/产品名称/生产线/排产数量/批号
     */
    public List<Map<String, Object>> workOrderLines(String orderNo, int lineNo) {
        String no = trim(orderNo);
        if (no.isEmpty()) throw new IllegalArgumentException("请提供工单号");
        StringBuilder sql = new StringBuilder(
                "SELECT id, pl_no, pl_xc, dm, mc, scx, pl_sl, lot_no, od_no, pl_date"
                        + " FROM dbo.plang WHERE pl_no = ? AND ISNULL(asp_cancel,'N') <> 'Y'");
        List<Object> args = new ArrayList<>();
        args.add(no);
        if (lineNo > 0) {
            sql.append(" AND pl_xc = ?");
            args.add(lineNo);
        }
        sql.append(" ORDER BY pl_xc");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("行id", longOf(r.get("id")));
            v.put("工单号", trim(r.get("pl_no")));
            v.put("工单行号", intOf(r.get("pl_xc")));
            v.put("产品编码", trim(r.get("dm")));
            v.put("产品名称", trim(r.get("mc")));
            v.put("生产线", trim(r.get("scx")));
            v.put("排产数量", dbl(r.get("pl_sl")));
            v.put("批号", trim(r.get("lot_no")));
            v.put("销售订单号", trim(r.get("od_no")));
            out.add(v);
        }
        return out;
    }

    /**
     * 按产品编码取**混料物料清单**(面板 {@code MIX_BOM} 的底表 {@code bs_mix_bom})。
     *
     * <p>🔴 2026-11-18 用户口径:「带入的bom从物料清单改为混料物料清单」—— 上一版读遗留表
     * {@code mate}(面板 WLBOM《物料清单》),正式库实测 0 行,扫工单永远带不出料。现在改读
     * 《混料物料清单》(数据来自已归档的烧结工艺清单/X烧结工艺清单),与「生成工单领料 → 混料领料单」
     * **同源**(都走 {@link MixBomService})。
     *
     * <p>没有维护清单时**返回空列表**而不是抛错:页面据此提示
     * 「该产品在「混料物料清单」里还没有维护用料,请先归档烧结工艺清单或到 数据建模 → 物料及价格 →
     * 混料物料清单 维护」,静默显示空清单会让人以为是系统坏了。
     *
     * @param productCode 产品编码(工单产品 / 半成品编码皆可,候选归一在 {@link MixBomService} 内)
     */
    public List<Map<String, Object>> bomOf(String productCode) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> b : bomRowsOf(productCode)) {
            Map<String, Object> v = new LinkedHashMap<>();
            // 老键名保持原样(既有客户端/打印链路认这套键);新代码一律用 {@link #bomRowsOf} 的新键
            v.put("子件代码", b.get("物料编号"));
            v.put("子件名称", b.get("物料名称"));
            v.put("规格型号", b.get("规格型号"));
            v.put("子件单位", b.get("单位"));
            v.put("标准用量", b.get("标准用量"));
            v.put("损耗量", b.get("损耗量"));
            v.put("备注", b.get("备注"));
            out.add(v);
        }
        return out;
    }

    /**
     * 混料物料清单的**归一化行**(内部统一键,明细页/扫料解锁/整单校验共用一份取数)。
     *
     * <p>行结构由 {@link MixBomService#rowsOf(String)} 给出,与领料端同口径:
     * {@code 标准用量} = 单支含量g 按存货计量单位换算后的**单件用量**,{@code 损耗量} = 0
     * (混料清单没有损耗列)。同一物料多行只认第一行、不累加。
     *
     * @param productCode 产品编码(候选归一在 {@link MixBomService} 内,支持 {@code **TB} / {@code -tb} 写法)
     * @return [{物料编号, 物料名称, 规格型号, 单位, 标准用量, 损耗量, 备注, 单支含量g, 添加比例, 设计添加量}]
     */
    public List<Map<String, Object>> bomRowsOf(String productCode) {
        return mixBom.rowsOf(productCode);
    }

    /**
     * 按混料物料清单 + 排产数量算出**应投料量**:单件用量 × 排产数量 + 损耗量(与界面/纸面同一口径)。
     *
     * @param standard 单件用量({@code MixBomService} 归一行:单支含量g 已按存货单位换算)
     * @param loss     损耗量(混料清单没有损耗列 ⇒ 0)
     * @param planQty  排产数量({@code plang.pl_sl})
     * @return 应投量(4 位小数)
     */
    private static double requiredOf(double standard, double loss, double planQty) {
        return round4(standard * planQty + loss).doubleValue();
    }

    // ═══════════════════════ 列表页:未完成 / 已完成 ═══════════════════════

    /**
     * **未完成的混料单** = 已经确认过料、还没整单提交的工单行(草稿行标记 {@code N})。
     *
     * <p>与「生产领料」的未完成组同一形态:{@code 工单号 + 工单行号} 就是这张单的身份
     * (混料单号要等提交才生成 —— 见 {@link #saveDoc})。点进明细页后走
     * {@link #taskOf}/{@link #scanMaterial}/{@link #saveScan}。
     *
     * @param keyword 可选:工单号 / 产品编码 / 产品名称 / 物料编号的片段
     * @return [{工单号, 工单行号, 工单行id, 产品编码, 产品名称, 生产线, 排产数量,
     *          已确认项数, 明细数, 应投合计, 实投合计, 开始时间, 更新时间, 操作人, 单据编号:''}]
     */
    public List<Map<String, Object>> openDocs(String keyword) {
        String kw = trim(keyword);
        StringBuilder sql = new StringBuilder(
                "SELECT TOP 200 l.工单号, l.工单行号, COUNT(*) AS 已确认项数,"
                        + " SUM(ISNULL(l.计划用量,0)) AS 应投合计, SUM(ISNULL(l.实际用量,0)) AS 实投合计,"
                        + " MIN(l.asp_time1) AS 开始时间, MAX(ISNULL(l.asp_time2,l.asp_time1)) AS 更新时间,"
                        + " MAX(l.asp_user1) AS 操作人, MAX(l.工单行id) AS 工单行id"
                        + " FROM dbo.wo_mixing_list l"
                        + " LEFT JOIN dbo.plang p ON p.pl_no = l.工单号 AND p.pl_xc = l.工单行号"
                        + " WHERE l.标记 = ? AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                        + "   AND (l.单据编号 IS NULL OR LTRIM(RTRIM(l.单据编号)) = '')");
        List<Object> args = new ArrayList<>();
        args.add(MARK_DRAFT);
        if (!kw.isEmpty()) {
            sql.append(" AND (l.工单号 LIKE ? OR p.dm LIKE ? OR p.mc LIKE ? OR l.物料编号 LIKE ?)");
            String like = "%" + kw + "%";
            args.add(like);
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" GROUP BY l.工单号, l.工单行号 ORDER BY MAX(ISNULL(l.asp_time2,l.asp_time1)) DESC");
        List<Map<String, Object>> groups = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> g : groups) {
            String woNo = trim(g.get("工单号"));
            int woLine = intOf(g.get("工单行号"));
            Map<String, Object> wo = tail(workOrderLines(woNo, woLine));
            String product = wo == null ? "" : trim(wo.get("产品编码"));
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("工单号", woNo);
            v.put("工单行号", woLine);
            v.put("工单行id", wo == null ? longOf(g.get("工单行id")) : longOf(wo.get("行id")));
            v.put("产品编码", product);
            v.put("产品名称", wo == null ? "" : trim(wo.get("产品名称")));
            v.put("生产线", wo == null ? "" : trim(wo.get("生产线")));
            v.put("排产数量", wo == null ? 0d : dbl(wo.get("排产数量")));
            v.put("已确认项数", intOf(g.get("已确认项数")));
            // 明细数 = 混料物料清单行数(提交闸门的分母;清单没维护时为 0,页面据此提示)
            v.put("明细数", bomRowsOf(product).size());
            v.put("应投合计", dbl(g.get("应投合计")));
            v.put("实投合计", dbl(g.get("实投合计")));
            v.put("开始时间", trim(g.get("开始时间")));
            v.put("更新时间", trim(g.get("更新时间")));
            v.put("操作人", trim(g.get("操作人")));
            // 还没提交 ⇒ 没有混料单号(与生产领料列表的「未生成」同一写法)
            v.put("单据编号", "");
            out.add(v);
        }
        return out;
    }

    /**
     * **单据明细页的取数**:工单行 + 物料清单(应投)+ 已确认的实投,一次给齐。
     *
     * <p>对应「生产领料单」明细页的 {@code GET /px/mobilePick/doc}:页面拿这一份就能画出
     * 抬头、扫码解锁区与明细,不必再分别拉 BOM 和草稿。
     *
     * @param orderNo 工单号
     * @param lineNo  工单行号
     * @return {工单号, 工单行号, 工单行id, 产品编码, 产品名称, 规格型号, 计量单位, 生产线,
     *          排产数量, 批号, 上次单号, 明细:[{行id, 物料编号, 物料名称, 规格型号, 单位,
     *          应投, 实投, 待投, 物料批次, 已确认}], 进度:{done,total,ok}}
     */
    public Map<String, Object> taskOf(String orderNo, int lineNo) {
        String woNo = trim(orderNo);
        if (woNo.isEmpty()) throw new IllegalArgumentException("请先扫工单码或输入工单号");
        Map<String, Object> wo = tail(workOrderLines(woNo, lineNo));
        if (wo == null) {
            throw new IllegalArgumentException(lineNo > 0
                    ? "没有找到工单行 " + woNo + " #" + lineNo
                    : "没有找到工单 " + woNo);
        }
        int useLine = intOf(wo.get("工单行号"));
        String product = trim(wo.get("产品编码"));
        double planQty = dbl(wo.get("排产数量"));

        // 已确认的草稿行(标记 N):按物料编号索引
        Map<String, Map<String, Object>> confirmed = new LinkedHashMap<>();
        for (Map<String, Object> d : draftRows(woNo, useLine)) {
            confirmed.put(trim(d.get("物料编号")), d);
        }

        List<Map<String, Object>> lines = new ArrayList<>();
        java.util.Set<String> used = new java.util.HashSet<>();
        double requiredSum = 0;
        for (Map<String, Object> b : bomRowsOf(product)) {
            String code = trim(b.get("物料编号"));
            double required = requiredOf(dbl(b.get("标准用量")), dbl(b.get("损耗量")), planQty);
            Map<String, Object> d = confirmed.get(code);
            double actual = d == null ? 0d : dbl(d.get("实际用量"));
            requiredSum += required;
            used.add(code);
            lines.add(lineRow(code, trim(b.get("物料名称")), trim(b.get("规格型号")), trim(b.get("单位")),
                    required, actual, d));
        }
        // 清单后来改过、草稿里还有清单外的料:照样列出来(否则提交时会漏算它)
        for (Map.Entry<String, Map<String, Object>> e : confirmed.entrySet()) {
            if (used.contains(e.getKey())) continue;
            Map<String, Object> d = e.getValue();
            lines.add(lineRow(e.getKey(), trim(d.get("物料名称")), "", "",
                    dbl(d.get("计划用量")), dbl(d.get("实际用量")), d));
        }

        int done = 0;
        for (Map<String, Object> l : lines) {
            if (dbl(l.get("实投")) > 0) done += 1;
        }

        String lastDocNo = first(jdbc.queryForList(
                "SELECT TOP 1 单据编号 FROM dbo.wo_mixing_list WHERE 工单号 = ? AND 工单行号 = ?"
                        + " AND 标记 = ? AND 单据编号 IS NOT NULL AND LTRIM(RTRIM(单据编号)) <> ''"
                        + " ORDER BY id DESC", String.class, woNo, useLine, MARK_SAVED));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("工单号", woNo);
        out.put("工单行号", useLine);
        out.put("工单行id", longOf(wo.get("行id")));
        out.put("产品编码", product);
        out.put("产品名称", trim(wo.get("产品名称")));
        out.put("规格型号", specOf(product));
        out.put("计量单位", uomOf(product));
        out.put("生产线", trim(wo.get("生产线")));
        out.put("排产数量", planQty);
        out.put("批号", trim(wo.get("批号")));
        out.put("上次单号", lastDocNo == null ? "" : lastDocNo);
        out.put("应投合计", round4(requiredSum).doubleValue());
        out.put("明细", lines);
        Map<String, Object> prog = new LinkedHashMap<>();
        prog.put("done", done);
        prog.put("total", lines.size());
        prog.put("ok", !lines.isEmpty() && done == lines.size());
        out.put("进度", prog);
        return out;
    }

    /** 明细页的一行(应投 / 实投 / 待投) */
    private Map<String, Object> lineRow(String code, String name, String spec, String uom,
                                        double required, double actual, Map<String, Object> draft) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("行id", draft == null ? 0L : longOf(draft.get("行id")));
        v.put("物料编号", code);
        v.put("物料名称", name);
        v.put("规格型号", spec);
        v.put("单位", uom);
        v.put("应投", round4(required).doubleValue());
        v.put("实投", round4(actual).doubleValue());
        v.put("待投", round4(required - actual).doubleValue());
        v.put("物料批次", draft == null ? "" : trim(draft.get("物料批次")));
        // 已确认 = 该行已有实投(>0) —— 与「全部确认完毕才能提交」同一判据
        v.put("已确认", round4(actual).doubleValue() > 0);
        return v;
    }

    /**
     * 扫物料码 → **解锁该项**(2026-11-18 第四轮,对应「生产领料」的 {@code /scanMaterial})。
     *
     * <p>只做校验与取数,**不落库**:物料不在本工单行的《混料物料清单》里就明确拒绝并列出该投哪些料;
     * 命中则回该行的应投/已投/待投与单位,页面据此把数量框解锁(默认填电子秤读数)。
     *
     * @param orderNo 工单号
     * @param lineNo  工单行号
     * @param code    物料编码(物料码 {@code 存货编码|批号} 的前半段)
     * @return {物料编号, 物料名称, 规格型号, 单位, 应投, 实投, 待投, 物料批次, 行id, 排产数量}
     */
    public Map<String, Object> scanMaterial(String orderNo, int lineNo, String code) {
        String woNo = trim(orderNo);
        String matCode = trim(code);
        if (woNo.isEmpty()) throw new IllegalArgumentException("请先扫工单码");
        if (matCode.isEmpty()) throw new IllegalArgumentException("请先扫描或输入物料编码");
        Map<String, Object> task = taskOf(woNo, lineNo);
        int useLine = intOf(task.get("工单行号"));
        double planQty = dbl(task.get("排产数量"));
        String product = trim(task.get("产品编码"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lines = (List<Map<String, Object>>) task.get("明细");
        Map<String, Object> hit = null;
        for (Map<String, Object> l : lines) {
            if (matCode.equals(trim(l.get("物料编号")))) { hit = l; break; }
        }
        if (hit == null) {
            // 说清"本来该投什么",现场好判断是扫错料还是清单没维护
            StringBuilder names = new StringBuilder();
            for (Map<String, Object> l : lines) {
                if (names.length() > 0) names.append("、");
                names.append(trim(l.get("物料编号")));
            }
            throw new IllegalArgumentException("该物料不在本工单行的混料物料清单里:" + matCode
                    + (names.length() == 0
                        ? "(该产品在《混料物料清单》里还没有维护用料,请先归档烧结工艺清单/X烧结工艺清单,"
                            + "或到 数据建模 → 物料及价格 → 混料物料清单 维护)"
                        : "(本单应投:" + names + ")"));
        }
        Map<String, Object> out = new LinkedHashMap<>(hit);
        out.put("工单号", woNo);
        out.put("工单行号", useLine);
        out.put("产品编码", product);
        out.put("排产数量", planQty);
        out.put("应投合计", dbl(task.get("应投合计")));
        return out;
    }

    /** 产品的主物料规格型号(抬头用:取物料清单第一行的规格;取不到就空) */
    private String specOf(String product) {
        List<Map<String, Object>> bom = bomRowsOf(product);
        return bom.isEmpty() ? "" : trim(bom.get(0).get("规格型号"));
    }

    /** 产品的主物料计量单位(抬头用:取物料清单第一行的单位;取不到就空) */
    private String uomOf(String product) {
        List<Map<String, Object>> bom = bomRowsOf(product);
        return bom.isEmpty() ? "" : trim(bom.get(0).get("单位"));
    }

    /** 取列表的最后一条(整单码扫进来时 workOrderLines 可能回多行,默认取最后一行=行号最大) */
    private static Map<String, Object> tail(List<Map<String, Object>> list) {
        return list == null || list.isEmpty() ? null : list.get(list.size() - 1);
    }

    // ═══════════════════════ 确认一笔(写入,标记 N) ═══════════════════════

    /**
     * **确认一笔**:把「扫到的物料 + 电子秤读数」**写入**该物料那一行混料记录。
     *
     * <p>🔴 2026-11-19 口径:实投量**只认电子秤**(页面已无手输入口,见 MobileMixDoc.vue
     * 的 {@code liveQty} / {@code canConfirm}) ⇒ 这里只有"没读到稳定秤值"一种失败,
     * 提示也说清是秤的问题,不再引导人抄一个数进来。
     *
     * <p>🔴 2026-11-18 第四轮改口径(与「生产领料」的 {@code setQty} 完全对齐):
     * <b>覆盖写入</b>,不再累加。上一版同一物料重复扫就相加,现场"扫一次看一眼再确认一次"
     * 会把实际用量记成两倍;现在同一物料再确认一次 = 以最后一次秤值为准
     * (要改回来就重扫该物料再确认,界面上还有「撤回本项」)。
     *
     * <p>同一「工单行 + 物料」只保留一行(标记 {@code N} 未保存),这样明细页/纸面/混料记录
     * 都是一料一行,不会有老系统那 6 行重复物料的毛病。
     *
     * @param body {工单号, 工单行id?, 工单行号?, 产品编码?, 产品名称?, 物料编号, 物料名称?,
     *             物料批次?, 计划用量?, 实际用量, 单位?, 秤值?, 秤设备?, 秤时间?}
     * @param user 登录账号(记 asp_user1 / asp_user2)
     * @return {行id, 序号, 单据编号(仍为空直到提交), 实际用量, 操作人}
     */
    @Transactional
    public Map<String, Object> saveScan(Map<String, Object> body, String user) {
        String woNo = trim(body.get("工单号"));
        if (woNo.isEmpty()) throw new IllegalArgumentException("请先扫工单码");
        int woLine = intOf(body.get("工单行号"));
        String materialCode = trim(body.get("物料编号"));
        if (materialCode.isEmpty()) throw new IllegalArgumentException("请先扫物料码");
        BigDecimal qty = round4(body.get("实际用量"));
        if (qty.signum() <= 0) throw new IllegalArgumentException(
                "实际用量要大于 0:请确认电子秤已连接并有稳定读数(页面不支持手动填写数量)");

        Map<String, Object> exists = first(jdbc.queryForList(
                "SELECT TOP 1 id, 实际用量 FROM dbo.wo_mixing_list"
                        + " WHERE 工单号 = ? AND 工单行号 = ? AND 物料编号 = ? AND 标记 = ?"
                        + "   AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC",
                woNo, woLine, materialCode, MARK_DRAFT));

        if (exists != null) {
            long id = longOf(exists.get("id"));
            // 物料批次随最新一次扫码走(同一料换了批次,纸面印最后一次扫到的那个);
            // 本次码里没带批号 ⇒ 保留原来的,别把已扫到的批次清空
            String batch = trim(body.get("物料批次"));
            jdbc.update("UPDATE dbo.wo_mixing_list SET 实际用量 = ?, 计划用量 = ?, 物料名称 = ?,"
                            + " 物料批次 = COALESCE(NULLIF(?, ''), 物料批次),"
                            + " asp_user2 = ?, asp_time2 = GETDATE() WHERE id = ?",
                    qty, round4(body.get("计划用量")),
                    nonEmptyOr(trim(body.get("物料名称")), materialCode), batch, user, id);
            return rowResult(id, woNo, woLine, materialCode, qty, user);
        }

        int seq = 1 + nullToInt(jdbc.queryForObject(
                "SELECT COUNT(*) FROM dbo.wo_mixing_list WHERE 工单号 = ? AND 工单行号 = ? AND 标记 = ?"
                        + " AND ISNULL(asp_cancel,'N') <> 'Y'", Integer.class, woNo, woLine, MARK_DRAFT));

        // 单支物料含量/配料比/设计添加量 本版不写(官方口径走混料物料清单,不挂成型配方)
        jdbc.update("INSERT INTO dbo.wo_mixing_list ("
                        + "工单号, 工单行id, 工单行号, 序号, 物料编号, 物料名称, 计划用量, 实际用量, 物料批次, 标记,"
                        + "asp_user1, asp_time1, asp_cancel) VALUES (?,?,?,?,?,?,?,?,?,?,?,GETDATE(),'N')",
                woNo, longOrNull(body.get("工单行id")), woLine, String.format("%d", seq),
                materialCode, nonEmptyOr(trim(body.get("物料名称")), materialCode),
                round4(body.get("计划用量")), qty, trim(body.get("物料批次")), MARK_DRAFT, user);
        Long id = jdbc.queryForObject("SELECT MAX(id) FROM dbo.wo_mixing_list WHERE 工单号 = ? AND 工单行号 = ?"
                + " AND 物料编号 = ? AND 标记 = ?", Long.class, woNo, woLine, materialCode, MARK_DRAFT);
        return rowResult(id == null ? 0 : id, woNo, woLine, materialCode, qty, user);
    }

    /** 空串用兜底值(物料名称为空时用编码,纸面才不会印出空名字) */
    private static String nonEmptyOr(String v, String fallback) {
        return v == null || v.trim().isEmpty() ? fallback : v;
    }

    private Map<String, Object> rowResult(long id, String woNo, int woLine, String code, BigDecimal qty, String user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("行id", id);
        out.put("工单号", woNo);
        out.put("工单行号", woLine);
        out.put("物料编号", code);
        out.put("实际用量", qty.doubleValue());
        out.put("操作人", user == null ? "" : user);
        // 还没整单保存 ⇒ 没有单号,前端据此提示「本单还没保存」
        String docNo = first(jdbc.queryForList(
                "SELECT TOP 1 单据编号 FROM dbo.wo_mixing_list WHERE id = ?", String.class, id));
        out.put("单据编号", docNo == null ? "" : docNo);
        return out;
    }

    /**
     * 撤回一笔(扫错料 / 秤取错时的兜底):只允许删**未保存**(标记 N)的行。
     *
     * @param id   混料记录行 id
     * @param user 操作人(只删自己的行;管理员另行处理,不在这里开口子)
     * @return 删除行数(0 = 行不存在/已保存/不是自己的)
     */
    public int undoScan(long id, String user) {
        if (id <= 0) return 0;
        return jdbc.update("DELETE FROM dbo.wo_mixing_list WHERE id = ? AND 标记 = ?"
                + " AND ISNULL(asp_cancel,'N') <> 'Y' AND (asp_user1 = ? OR ? IS NULL OR ? = '')",
                id, MARK_DRAFT, trim(user), trim(user), trim(user));
    }

    // ═══════════════════════ 整单保存(标记 Y + 单号) ═══════════════════════

    /**
     * **提交(整单保存)**:给本工单行的未保存行取一个混料单号,并把标记置 {@code Y}(保存后)。
     *
     * <p>🔴 2026-11-18 第四轮用户口径:「全部物料确认完毕后,才可以提交」——
     * 上一版允许"先存已投的料"(缺料是车间常态),本版按用户口径改成**硬闸门**:
     * 先按《混料物料清单》算出本单应投的料,再核对草稿行,缺任何一项都拒绝提交并点名缺哪几项。
     * 界面上的「提交」按钮同样按这个判据置灰 —— 这里再挡一道,是防旧客户端/重放请求绕过。
     *
     * <p>单号口径与老系统一致:{@code PL + yyMMdd + 4 位流水},按当天已有单号取 max+1
     * (号池 {@code s_allno} 里没有 PL 段,故以业务表为准;本方法 synchronized,
     * 单实例内不会两个页签同时算出同一个号)。
     *
     * @param body {工单号, 工单行号}
     * @param user 操作人
     * @return {单据编号, 行数, 实际用量合计, 明细}
     */
    @Transactional
    public synchronized Map<String, Object> saveDoc(Map<String, Object> body, String user) {
        String woNo = trim(body.get("工单号"));
        if (woNo.isEmpty()) throw new IllegalArgumentException("请先扫工单码");
        int woLine = intOf(body.get("工单行号"));

        List<Map<String, Object>> draft = jdbc.queryForList(
                "SELECT id, 物料编号, 物料名称, 计划用量, 实际用量 FROM dbo.wo_mixing_list"
                        + " WHERE 工单号 = ? AND 工单行号 = ? AND 标记 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", woNo, woLine, MARK_DRAFT);
        if (draft.isEmpty()) {
            throw new IllegalStateException("这张工单行还没有确认过的料,不能提交");
        }
        requireAllConfirmed(woNo, woLine, draft);

        String docNo = nextDocNo();
        jdbc.update("UPDATE dbo.wo_mixing_list SET 单据编号 = ?, 标记 = ?, asp_user2 = ?, asp_time2 = GETDATE()"
                        + " WHERE 工单号 = ? AND 工单行号 = ? AND 标记 = ? AND ISNULL(asp_cancel,'N') <> 'Y'",
                docNo, MARK_SAVED, user, woNo, woLine, MARK_DRAFT);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("单据编号", docNo);
        out.put("工单号", woNo);
        out.put("工单行号", woLine);
        out.put("行数", draft.size());
        out.put("明细", docRows(docNo).get("明细"));
        return out;
    }

    /**
     * 提交前的硬闸门:**按《混料物料清单》核对本单每一项是否都确认了实投**。
     *
     * <p>用户口径「全部物料确认完毕后,才可以提交」。判据与界面完全一致:
     * 混料物料清单里有的每一项物料,草稿里都要有一行且 {@code 实际用量 > 0}。
     *
     * <p>清单里没维护用料(混料物料清单 0 行,正式库在烧结单归档前就是这种状态)时**不拦** ——
     * 那时明细页本身是空的,没有"该确认的项",拦下来只会让人提交不了已扫的料。
     *
     * @param woNo   工单号
     * @param woLine 工单行号
     * @param draft  本单未保存的草稿行
     */
    private void requireAllConfirmed(String woNo, int woLine, List<Map<String, Object>> draft) {
        Map<String, Object> wo = tail(workOrderLines(woNo, woLine));
        if (wo == null) return;
        List<Map<String, Object>> bom = bomRowsOf(trim(wo.get("产品编码")));
        if (bom.isEmpty()) return;
        java.util.Set<String> done = new java.util.HashSet<>();
        for (Map<String, Object> d : draft) {
            if (dbl(d.get("实际用量")) > 0) done.add(trim(d.get("物料编号")));
        }
        List<String> missing = new ArrayList<>();
        for (Map<String, Object> b : bom) {
            String code = trim(b.get("物料编号"));
            if (!done.contains(code)) {
                String name = trim(b.get("物料名称"));
                missing.add(name.isEmpty() ? code : code + " " + name);
            }
        }
        if (!missing.isEmpty()) {
            throw new IllegalStateException("还有 " + missing.size() + " 项物料没有确认投料,不能提交:"
                    + String.join("、", missing));
        }
    }

    /**
     * 取一个混料单号:{@code PL + yyMMdd + 4 位流水}。
     *
     * <p>基准 = {@code wo_mixing_list} 里同日前缀的最大流水(老系统那批 {@code PL2610210002}
     * 就是这么排的)+ 1;{@code s_allno} 号池里没有 PL 段,不去动它(动它要与 FormNoService 的
     * 格式假设对齐,得不偿失)。
     */
    private String nextDocNo() {
        String day = LocalDate.now().format(DAY_FMT);
        String prefix = DOC_PREFIX + day;
        Integer max = jdbc.queryForObject(
                "SELECT MAX(TRY_CAST(RIGHT(RTRIM(单据编号), 4) AS int)) FROM dbo.wo_mixing_list"
                        + " WHERE RTRIM(单据编号) LIKE ?", Integer.class, prefix + "[0-9][0-9][0-9][0-9]");
        int seq = (max == null ? 0 : max) + 1;
        return prefix + String.format("%04d", seq);
    }

    // ═══════════════════════ 单据查询 / 补打印 ═══════════════════════

    /**
     * 列**已保存的混料单**(列表页「已完成」组 + 补打印入口)。
     *
     * @param orderNo 工单号(可空 = 不限工单;列表页按关键字筛)
     * @param lineNo  工单行号(&lt;=0 = 该工单全部行)
     * @param keyword 可选:单据编号 / 工单号 / 产品编码 / 产品名称的片段
     * @return [{单据编号, 保存时间, 行数, 实际用量合计, 计划用量合计, 打印次数, 操作人,
     *          工单号, 工单行号, 产品编码, 产品名称, 生产线}]
     */
    public List<Map<String, Object>> docsOf(String orderNo, int lineNo, String keyword) {
        String woNo = trim(orderNo);
        String kw = trim(keyword);
        StringBuilder sql = new StringBuilder(
                "SELECT TOP 200 l.单据编号, MIN(l.asp_time1) AS 保存时间, COUNT(*) AS 行数,"
                        + " SUM(ISNULL(l.实际用量,0)) AS 实际用量合计, SUM(ISNULL(l.计划用量,0)) AS 计划用量合计,"
                        + " MAX(ISNULL(l.asp_print,0)) AS 打印次数, MAX(l.asp_user1) AS 操作人,"
                        + " MIN(l.工单行号) AS 工单行号, MIN(l.工单号) AS 工单号"
                        + " FROM dbo.wo_mixing_list l"
                        + " LEFT JOIN dbo.plang p ON p.pl_no = l.工单号 AND p.pl_xc = l.工单行号"
                        + " WHERE l.标记 = ? AND ISNULL(l.asp_cancel,'N') <> 'Y'"
                        + "   AND l.单据编号 IS NOT NULL AND LTRIM(RTRIM(l.单据编号)) <> ''");
        List<Object> args = new ArrayList<>();
        args.add(MARK_SAVED);
        if (!woNo.isEmpty()) {
            sql.append(" AND l.工单号 = ?");
            args.add(woNo);
        }
        if (lineNo > 0) {
            sql.append(" AND l.工单行号 = ?");
            args.add(lineNo);
        }
        if (!kw.isEmpty()) {
            sql.append(" AND (l.单据编号 LIKE ? OR l.工单号 LIKE ? OR p.dm LIKE ? OR p.mc LIKE ?)");
            String like = "%" + kw + "%";
            args.add(like);
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" GROUP BY l.单据编号 ORDER BY MIN(l.asp_time1) DESC, l.单据编号 DESC");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String rowWo = trim(r.get("工单号"));
            int rowLine = intOf(r.get("工单行号"));
            Map<String, Object> wo = rowWo.isEmpty() ? null : tail(workOrderLines(rowWo, rowLine));
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("单据编号", trim(r.get("单据编号")));
            v.put("保存时间", trim(r.get("保存时间")));
            v.put("行数", intOf(r.get("行数")));
            v.put("实际用量合计", dbl(r.get("实际用量合计")));
            v.put("计划用量合计", dbl(r.get("计划用量合计")));
            v.put("打印次数", intOf(r.get("打印次数")));
            v.put("操作人", trim(r.get("操作人")));
            v.put("工单号", rowWo);
            v.put("工单行号", rowLine);
            v.put("产品编码", wo == null ? "" : trim(wo.get("产品编码")));
            v.put("产品名称", wo == null ? "" : trim(wo.get("产品名称")));
            v.put("生产线", wo == null ? "" : trim(wo.get("生产线")));
            out.add(v);
        }
        return out;
    }

    /**
     * 本工单行**还没整单保存**的已扫料(重进页面恢复用 —— 手机熄屏/App 被杀不该把扫了一半的活丢掉)。
     *
     * @param orderNo 工单号
     * @param lineNo  工单行号
     * @return [{行id, 物料编号, 物料名称, 计划用量, 实际用量, 序号}]
     */
    public List<Map<String, Object>> draftRows(String orderNo, int lineNo) {
        String woNo = trim(orderNo);
        if (woNo.isEmpty()) return List.of();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, 序号, 物料编号, 物料名称, 计划用量, 实际用量 FROM dbo.wo_mixing_list"
                        + " WHERE 工单号 = ? AND 工单行号 = ? AND 标记 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", woNo, lineNo, MARK_DRAFT);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("行id", longOf(r.get("id")));
            v.put("序号", trim(r.get("序号")));
            v.put("物料编号", trim(r.get("物料编号")));
            v.put("物料名称", trim(r.get("物料名称")));
            v.put("计划用量", dbl(r.get("计划用量")));
            v.put("实际用量", dbl(r.get("实际用量")));
            out.add(v);
        }
        return out;
    }

    /**
     * 按混料单号取一张单(**《成型配料记录》纸面** + 明细页共用)。
     *
     * <p>2026-11-18 用户给了纸样:「这是混料打印的格式,按横板的 A4 打印」——
     * 纸面是《成型配料记录》(文件编码 YJ-QR-147),横板 A4:
     * <pre>
     *   序号 | 车间 | 产品编号 | 配方版本号 | 物料编号 | 物料名 | 添加比例 | 应投重量 |
     *   实投重量 | 物料批次 | 开始时间 | 结束时间 | 转速 | 配料批次号 | 物料水分 | 配料人 | 确认人
     * </pre>
     * 左四列与右七列在纸上是**纵向合并**的一格(整张单一行头 + N 行物料)。
     *
     * <p>各列取值:
     * <ul>
     *   <li>车间/产品编号 ← {@code plang.scx / plang.dm}(工单行);</li>
     *   <li>配方版本号 ← {@code wo_mixing_list.配方版本}(本版不挂配方,留空);</li>
     *   <li>添加比例 ← 该行 计划用量 / 本单 计划用量合计(与配方配料比同口径);</li>
     *   <li>应投重量 ← 计划用量;实投重量 ← 实际用量(电子秤);</li>
     *   <li>物料批次 ← 扫码时从物料码 {@code 存货编码|批号} 带下来的批号;</li>
     *   <li>配料批次号 ← 混料单号;配料人 ← 创建人;开始/结束时间 ← 首笔与保存时间;</li>
     *   <li>转速 / 物料水分 / 确认人:本系统没有对应数据源,留空由现场手填。</li>
     * </ul>
     *
     * @param docNo 混料单号(PL…)
     */
    public Map<String, Object> docRows(String docNo) {
        String no = trim(docNo);
        if (no.isEmpty()) throw new IllegalArgumentException("请提供混料单号");
        List<Map<String, Object>> heads = jdbc.queryForList(
                "SELECT TOP 1 工单号, 工单行号, asp_user1, asp_time1, ISNULL(asp_print,0) AS 打印次数,"
                        + " 配方版本, ISNULL(物料批次,'') AS 物料批次"
                        + " FROM dbo.wo_mixing_list WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY id", no);
        if (heads.isEmpty()) throw new IllegalArgumentException("没有找到混料单 " + no);
        Map<String, Object> h = heads.get(0);
        String woNo = trim(h.get("工单号"));
        int woLine = intOf(h.get("工单行号"));

        // 工单行:车间(生产线)/产品编号/产品名称;工单行不存在(历史数据)就留空,不让整张纸打不出来
        Map<String, Object> wo = null;
        if (!woNo.isEmpty()) {
            List<Map<String, Object>> woRows = jdbc.queryForList(
                    "SELECT TOP 1 scx, dm, mc FROM dbo.plang WHERE pl_no = ? AND pl_xc = ?"
                            + " AND ISNULL(asp_cancel,'N') <> 'Y'", woNo, woLine);
            if (woRows.isEmpty()) {
                woRows = jdbc.queryForList(
                        "SELECT TOP 1 scx, dm, mc FROM dbo.plang WHERE pl_no = ?"
                                + " AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY pl_xc", woNo);
            }
            if (!woRows.isEmpty()) wo = woRows.get(0);
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 序号, 物料编号, 物料名称, 计划用量, 实际用量, ISNULL(物料批次,'') AS 物料批次"
                        + " FROM dbo.wo_mixing_list WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                        + " ORDER BY TRY_CAST(序号 AS int), id", no);

        // 添加比例的分母 = 本单应投合计(与配方「配料比」同口径;合计为 0 时整列留空)
        double planSum = 0;
        double realSum = 0;
        for (Map<String, Object> r : rows) {
            planSum += dbl(r.get("计划用量"));
            realSum += dbl(r.get("实际用量"));
        }

        // 明细页要显示「规格型号 / 计量单位」(与生产领料单同一口径):按混料物料清单补两份字典,
        // 清单里查不到就留空(历史单可能已经不在清单里了,不能因此让整张单打不开)
        Map<String, Map<String, Object>> bomIndex = new LinkedHashMap<>();
        for (Map<String, Object> b : bomRowsOf(wo == null ? "" : trim(wo.get("dm")))) {
            bomIndex.put(trim(b.get("物料编号")), b);
        }

        List<Map<String, Object>> lines = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            double plan = dbl(r.get("计划用量"));
            double real = dbl(r.get("实际用量"));
            Map<String, Object> bom = bomIndex.get(trim(r.get("物料编号")));
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("物料编号", trim(r.get("物料编号")));
            v.put("物料名", trim(r.get("物料名称")).isEmpty() ? trim(r.get("物料编号")) : trim(r.get("物料名称")));
            // 纸面「添加比例」按百分比印(18.67%);分母 0 ⇒ 空串,不印 "0.00%"
            v.put("添加比例", planSum > 0 ? pct(plan / planSum) : "");
            v.put("应投重量", num(plan));
            v.put("实投重量", num(real));
            v.put("物料批次", trim(r.get("物料批次")));
            v.put("规格型号", bom == null ? "" : trim(bom.get("规格型号")));
            v.put("单位", bom == null ? "" : trim(bom.get("单位")));
            // 兼容旧调用方(明细页/老的 7 列版式)的键:同一份数据换个名字
            v.put("材料名称", v.get("物料名"));
            v.put("请领数量", plan);
            v.put("实发数量", real);
            v.put("备注", trim(r.get("物料批次")));
            v.put("序号", trim(r.get("序号")));
            lines.add(v);
        }

        List<Map<String, Object>> times = jdbc.queryForList(
                "SELECT MIN(asp_time1) AS 开始时间, MAX(ISNULL(asp_time2, asp_time1)) AS 结束时间"
                        + " FROM dbo.wo_mixing_list WHERE 单据编号 = ?", no);
        String startAt = times.isEmpty() ? "" : trim(times.get(0).get("开始时间"));
        String endAt = times.isEmpty() ? "" : trim(times.get(0).get("结束时间"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("面板", PagePanelRegistry.MIX_SCAN);
        out.put("单据编号", no);
        // ↓ 纸面《成型配料记录》抬头
        out.put("标题", "成型配料记录");
        out.put("文件编码", "YJ-QR-147");
        out.put("工单号", woNo);
        out.put("工单行号", woLine);
        out.put("车间", wo == null ? "" : trim(wo.get("scx")));
        out.put("产品编号", wo == null ? "" : trim(wo.get("dm")));
        out.put("产品名称", wo == null ? "" : trim(wo.get("mc")));
        out.put("配方版本号", trim(h.get("配方版本")));
        out.put("开始时间", startAt);
        out.put("结束时间", endAt);
        out.put("转速", "");
        out.put("配料批次号", no);
        out.put("物料水分", "");
        out.put("配料人", trim(h.get("asp_user1")));
        out.put("确认人", "");
        // ↓ 明细页/兼容用的抬头
        out.put("单据日期", startAt);
        out.put("部门", trim(h.get("asp_user1")));
        out.put("创建人", trim(h.get("asp_user1")));
        out.put("打印次数", intOf(h.get("打印次数")));
        out.put("计划用量合计", num(planSum));
        out.put("实际用量合计", num(realSum));
        out.put("明细", lines);
        return out;
    }

    /** 百分比文案:0.1867 → "18.67%"(两位小数,与纸样一致) */
    private static String pct(double v) {
        return BigDecimal.valueOf(v * 100).setScale(2, RoundingMode.HALF_UP).toPlainString() + "%";
    }

    /** 重量文案:去掉无意义的尾随 0(86.172 / 21.04 / 100) */
    private static String num(double v) {
        return BigDecimal.valueOf(v).setScale(4, RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString();
    }

    /**
     * 记一次打印(补打印也算):{@code asp_print + 1}。
     *
     * <p>打印失败不该回滚业务(前端打印是次要动作),故调用方吞异常;这里只负责计数。
     *
     * @param docNo 混料单号
     * @return 更新后的打印次数(0 = 单号不存在)
     */
    public int markPrinted(String docNo) {
        String no = trim(docNo);
        if (no.isEmpty()) return 0;
        try {
            jdbc.update("UPDATE dbo.wo_mixing_list SET asp_print = ISNULL(asp_print,0) + 1 WHERE 单据编号 = ?", no);
            Integer n = jdbc.queryForObject(
                    "SELECT MAX(ISNULL(asp_print,0)) FROM dbo.wo_mixing_list WHERE 单据编号 = ?", Integer.class, no);
            return n == null ? 0 : n;
        } catch (Exception e) {
            log.warn("混料单打印次数累加失败(不影响出纸):{}", e.getMessage());
            return 0;
        }
    }

    // ═══════════════════════ 小工具 ═══════════════════════

    private static <T> T first(List<T> list) {
        return list == null || list.isEmpty() ? null : list.get(0);
    }

    private static String trim(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static int intOf(Object o) {
        if (o instanceof Number n) return n.intValue();
        try {
            return (int) Double.parseDouble(trim(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static long longOf(Object o) {
        if (o instanceof Number n) return n.longValue();
        try {
            return (long) Double.parseDouble(trim(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static Long longOrNull(Object o) {
        long v = longOf(o);
        return v > 0 ? v : null;
    }

    private static double dbl(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(trim(o));
        } catch (RuntimeException e) {
            return 0;
        }
    }

    private static int nullToInt(Integer v) {
        return v == null ? 0 : v;
    }

    /** 数量统一按 4 位小数落地(与 decimal(18,8) 存储、界面显示一致,消掉浮点尾差) */
    private static BigDecimal round4(Object o) {
        return BigDecimal.valueOf(dbl(o)).setScale(4, RoundingMode.HALF_UP);
    }
}
