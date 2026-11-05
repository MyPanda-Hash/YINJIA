package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 出厂检验报告(QC_OQC_REPORT)生成服务 —— 2026-10-30。
 *
 * <p>需求口径(用户 2026-10-30 定稿,12 轮讨论;设计见
 * {@code docs/design/出厂检验报告-从三张检验单并集生成.md}):
 * <ol>
 *   <li><b>入口</b>:销售出库单勾选明细行 → 生成报告。<b>一份报告 = 一个产品</b>;
 *       勾选多行 → 生成多张单(用户口径「多个行就生成多张单就行了」)。</li>
 *   <li><b>行清单</b>:只读视图 {@code v_oqc_std}(取自《出货检验计划表》rd_insp_plan_*),
 *       <b>不改计划表任何一列</b>(用户口径「不想修改这个出货检验计划」)。计划表没覆盖的产品
 *       没有行 —— 前端允许手工加行兜底,不在这里造行。</li>
 *   <li><b>实测值</b>:成品 → 制程 → 首件 三张单<b>并集</b>,按 {@code qc_oqc_item_map} 的
 *       优先级取<b>第一个"有值"的</b>(不是第一个存在的 —— 成品单只有 120/438 张带外观行,
 *       制程 417/443 张都有,死取成品会让大半报告的外观行空着)。</li>
 *   <li><b>批次号匹配三段式</b>(出库行→检验单没有外键,`bl_sale_out` 连工单号/行号都没有):
 *       ① 出库行批号是真实批次(非空、非金蝶默认批号 PC0000)且能在 qc_asm_insp_head.批次号 查到 → 按批号取;
 *       ② 否则取该产品最近一张"已审核"的成品检验单,并在报告行标出来源,前端提示核对;
 *       ③ 都没有 → 不取数,全部行留空手填。</li>
 *   <li><b>首件只带勾选</b>:首件记录表每组只记 2 支样品,其余格子画斜杠不填;报告上外观行只带
 *       「无粘模（均匀）/无明显脱粉」这类勾选文本,不带数值。</li>
 *   <li><b>抽样标准/抽检量/AQL</b>:手填(系统无 AQL 结构化数据,不自动查 GB/T 2828.1)。</li>
 *   <li><b>卫生安全页</b>:本轮不录数,只留版面位(报表模板里印"见型式检验报告")。</li>
 * </ol>
 *
 * <p>依赖刻意保持轻(JdbcTemplate + FormNoService),与 {@code QcCatalogService} 同款,
 * 不反向依赖 ButtonService,避免循环依赖。
 */
@Service
public class OqcReportService {

    private static final Logger log = LoggerFactory.getLogger(OqcReportService.class);

    /** 面板编码(须与 yj_panel 一致) */
    public static final String PANEL = "QC_OQC_REPORT";
    /** 单号前缀(yj_panel.prefix = OQC) */
    private static final String PREFIX = "OQC";
    /** 金蝶给"无批次商品"的默认批号——所有没有批次的货共用这一个值,不能当批次身份 */
    private static final String KINGDEE_DEFAULT_LOT = "PC0000";

    /**
     * 报告项目语义关键词:计划表的控制项目名(*外观 / *炭棒尺寸 / …)↔ 对齐表里的报告项目。
     * 计划表用的是客户控制条款用语,报告 8 项是受控表单 YJ-QR-05/A1 的用语,两套必须有一层翻译;
     * 这一层先放在代码里(v1),等业务把「计划项目 ↔ 报告项目」补进对齐表后改成查表。
     */
    private static final Map<String, String> KEYWORD_TO_ITEM = new LinkedHashMap<>();
    static {
        KEYWORD_TO_ITEM.put("外观", "外观检查");
        KEYWORD_TO_ITEM.put("炭棒尺寸", "尺寸规格检查");
        KEYWORD_TO_ITEM.put("尺寸", "尺寸规格检查");
        KEYWORD_TO_ITEM.put("重量", "重量检查");
        KEYWORD_TO_ITEM.put("强度", "挤压强度检查");
        KEYWORD_TO_ITEM.put("黑水", "黑水检查");
        KEYWORD_TO_ITEM.put("余氯", "余氯测试");
    }

    private final JdbcTemplate jdbc;
    private final FormNoService formNoService;

    public OqcReportService(JdbcTemplate jdbc, FormNoService formNoService) {
        this.jdbc = jdbc;
        this.formNoService = formNoService;
    }

    // ==================== ① 生单:销售出库勾选 → 一张报告/一个产品 ====================

    /**
     * 按销售出库单(可选指定明细 id)生成出厂检验报告草稿。
     *
     * @param outNo   销售出库单号(bd_sale_out.单据编号)
     * @param lineIds 勾选的明细 id(bl_sale_out.id);空 = 该单据全部未作废行
     * @param user    操作人
     * @return 生成的报告单号列表(一个产品一张)
     */
    @Transactional
    public List<String> generateFromSaleOut(String outNo, List<Long> lineIds, String user) {
        if (outNo == null || outNo.isBlank()) throw new IllegalArgumentException("销售出库单号不能为空");
        Map<String, Object> head;
        try {
            head = jdbc.queryForMap("SELECT 单据编号, 单据日期, 客户 FROM bd_sale_out WHERE 单据编号 = ?", outNo);
        } catch (Exception e) {
            throw new IllegalArgumentException("销售出库单不存在:" + outNo);
        }
        List<Map<String, Object>> lines = loadSaleOutLines(outNo, lineIds);
        if (lines.isEmpty()) throw new IllegalArgumentException("该出库单没有可生成报告的明细行");

        String cust = str(head.get("客户"));
        String outDate = str(head.get("单据日期"));
        List<String> created = new ArrayList<>();
        for (Map<String, Object> ln : lines) {
            String prodCode = clean(str(ln.get("存货编码")));
            if (prodCode.isBlank()) continue;
            created.add(createOne(prodCode, str(ln.get("存货名称")), str(ln.get("规格型号")),
                    str(ln.get("批号")), dec(ln.get("数量")), outNo, longOf(ln.get("id")),
                    cust, outDate, user));
        }
        return created;
    }

    private List<Map<String, Object>> loadSaleOutLines(String outNo, List<Long> lineIds) {
        if (lineIds == null || lineIds.isEmpty()) {
            return jdbc.queryForList("SELECT id, 存货编码, 存货名称, 规格型号, 批号, 数量 FROM bl_sale_out"
                    + " WHERE 单据编号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", outNo);
        }
        String in = String.join(",", lineIds.stream().map(String::valueOf).toList());
        // lineIds 来自前端勾选,这里只拼接纯数字(已由 Long 保证),不存在注入面
        return jdbc.queryForList("SELECT id, 存货编码, 存货名称, 规格型号, 批号, 数量 FROM bl_sale_out"
                + " WHERE 单据编号 = ? AND id IN (" + in + ") AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id", outNo);
    }

    /** 一个产品一张报告:头 + 标准层行 + 三单并集取数 */
    private String createOne(String prodCode, String prodName, String spec, String lot,
                             BigDecimal qty, String outNo, Long lineId,
                             String cust, String outDate, String user) {
        String no = formNoService.next(PREFIX, user);
        String today = LocalDate.now().toString();
        String lotNo = (lot == null || lot.isBlank() || KINGDEE_DEFAULT_LOT.equalsIgnoreCase(lot.trim())) ? null : lot.trim();

        // ① 定位检验单(三段式)
        Map<String, Object> asm = resolveAsmDoc(prodCode, lotNo);
        String asmNo = asm == null ? null : str(asm.get("单据编号"));
        String woNo = asm == null ? null : str(asm.get("工单号"));
        Integer woLine = asm == null ? null : intOf(asm.get("工单行号"));
        String firstNo = docOf("QC_FIRST_INSP", woNo, woLine);
        String procNo = docOf("QC_PROC_INSP", woNo, woLine);

        // 生产日期(2026-11-01 补):此前**固定写 NULL**(2026-10-30 设计口径「业务未录 → 纸上留空」),
        // 所以即使批次号带进来了,生产日期也是空的。报告现已锚定生产批次 ⇒ 生产日期应随批次带入:
        //   ① 工单行完工时间(plang.完工时间)—— 批次号本身就是"完工日"标签(实测 20261017 ↔ 2026-10-17);
        //   ② 批次号可解析为 yyyyMMdd → 用该日期(旧数据没有完工时间时的等价来源);
        //   ③ 首件检验单.生产日期(同 工单号+工单行号)兜底(可能早于完工日);
        //   仍然取不到 → NULL(纸上留空,不造数据)。
        LocalDate prodDate = resolveProductionDate(woNo, woLine, lotNo, firstNo);
        java.sql.Date prodDateSql = prodDate == null ? null : java.sql.Date.valueOf(prodDate);

        // 生产批次锚(2026-11-01,用户口径「只需要实现第一步」):报告头落 工单号 + 工单行号 ——
        // 唯一身份 = (工单号, 工单行号);`批次号` 只是完工日日期标签(会跨工单重复),不能当批身份。
        // 解析不到成品检验单(无工单行)时两列留空,不阻塞生成(历史口径不变)。
        // 检验员(2026-11-04 起 = 纸面签署第一格「编制」):**建草稿时不写**——
        //   该列 yj_field 已 editable=0(见 tools/migrate-oqc-twolevel-20261104.sql),
        //   值只由审批流写:提交审批时 = 提交人姓名(ButtonService.doSubmitApproval → writeBackSignCell)。
        //   此前这里写的是**登录账号名**(如 admin),纸面只读格会显示账号而非人名,口径不对;
        //   留空等提交落值,与特采单「编制」格同口径(草稿期空白)。asp_user1 仍记生单人。
        jdbc.update("INSERT INTO qc_oqc_head (单据编号, 单据日期, 客户名称, 产品编码, 产品名称, 规格型号, 批次号,"
                + " 工单号, 工单行号,"
                + " 生产日期, 生产数量, 检测日期, AQL, 出库单号, 出库行号, 成品检验单号, 首件检验单号, 制程检验单号,"
                + " 检验员, 单据状态, asp_user1, asp_time1)"
                + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,GETDATE())",
                no, outDate.isBlank() ? today : outDate, nv(cust), nv(prodCode), nv(prodName), nv(spec), nv(lotNo),
                nv(woNo), woLine,
                prodDateSql, qty, today, null, nv(outNo), lineId, nv(asmNo), nv(firstNo), nv(procNo),
                null, null, nv(user));

        // ② 行:标准层(计划表视图)
        List<Map<String, Object>> std = jdbc.queryForList(
                "SELECT 序号, 检验项目, 检验要求, 检验方法, 检查频率, 检验类别 FROM v_oqc_std"
                        + " WHERE 产品编号 = ? ORDER BY 序号, 检验项目", prodCode);
        // ③ 三单明细(一次取齐,按项目名索引)
        Map<String, List<Map<String, Object>>> src = loadSourceRows(asmNo, procNo, firstNo);
        int seq = 0, line = 0;
        for (Map<String, Object> r : std) {
            String itemName = str(r.get("检验项目"));
            seq++;
            line++;
            String reportItem = mapReportItem(itemName);
            Map<String, Object> hit = pickValue(src, reportItem);
            String result = hit == null ? null : str(hit.get("结果"));
            String judge = hit == null ? null : str(hit.get("判定"));
            String source = hit == null ? null : str(hit.get("数据来源"));
            String sourceItem = hit == null ? null : str(hit.get("来源项目名"));
            BigDecimal v1 = hit == null ? null : dec(hit.get("测量值1"));
            BigDecimal v2 = hit == null ? null : dec(hit.get("测量值2"));
            BigDecimal v3 = hit == null ? null : dec(hit.get("测量值3"));
            BigDecimal v4 = hit == null ? null : dec(hit.get("测量值4"));
            BigDecimal v5 = hit == null ? null : dec(hit.get("测量值5"));
            jdbc.update("INSERT INTO qc_oqc_detail (单据编号, 行号, 序号, 检验项目, 检验要求, 检验方法,"
                    + " 测量值1, 测量值2, 测量值3, 测量值4, 测量值5, 结果, 判定, 数据来源, 来源项目名, 是否手填,"
                    + " asp_user1, asp_time1)"
                    + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,GETDATE())",
                    no, line, intOf(r.get("序号")) == null ? seq : intOf(r.get("序号")), nv(itemName),
                    nv(str(r.get("检验要求"))), nv(str(r.get("检验方法"))),
                    v1, v2, v3, v4, v5, nv(result), nv(judge), nv(source), nv(sourceItem),
                    hit == null, nv(user));
        }
        mergeStatus(no, user);
        log.info("[出厂检验报告] 出库单 {} 行 {} 产品 {} → 报告 {} (标准行 {} 条,成品检单 {})",
                outNo, lineId, prodCode, no, std.size(), asmNo);
        return no;
    }

    // ==================== ② 定位检验单 ====================

    /** 三段式:真实批号 → 该产品最近一张已审核成品检单 → 无 */
    private Map<String, Object> resolveAsmDoc(String prodCode, String lotNo) {
        if (lotNo != null && !lotNo.isBlank()) {
            List<Map<String, Object>> byLot = jdbc.queryForList(
                    "SELECT TOP 1 单据编号, 工单号, 工单行号 FROM qc_asm_insp_head"
                            + " WHERE 批次号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 单据日期 DESC, id DESC", lotNo);
            if (!byLot.isEmpty()) return byLot.get(0);
        }
        // 产品编码可能带 TAB/换行脏值(实测 ZJ-2026-10-0135 的编码是 "\tB-92-25"),必须清洗后比较
        String prodExpr = "REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(h.产品编码,N''),CHAR(9),N''),CHAR(10),N''),CHAR(13),N''),N' ',N'')";
        String base = "SELECT TOP 1 h.单据编号, h.工单号, h.工单行号 FROM qc_asm_insp_head h"
                + " WHERE " + prodExpr + " = ? AND ISNULL(h.asp_cancel,'N') <> 'Y'";
        // 先找已审核的;一张都没有(实测 B-92-25 唯一那张 ZJ-2026-10-0135 就没审核)时退回最近一张,
        // 由报告行"数据来源"字段标明出处,品质在报告上核对 —— 不静默用草稿冒充已审数据。
        List<Map<String, Object>> audited = jdbc.queryForList(base
                + " AND EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code = 'QC_ASM_INSP'"
                + "             AND s.doc_no = h.单据编号 AND s.shr IS NOT NULL)"
                + " ORDER BY h.单据日期 DESC, h.id DESC", clean(prodCode));
        if (!audited.isEmpty()) return audited.get(0);
        List<Map<String, Object>> any = jdbc.queryForList(base + " ORDER BY h.单据日期 DESC, h.id DESC", clean(prodCode));
        return any.isEmpty() ? null : any.get(0);
    }

    /**
     * 生产日期取值(2026-11-01 补,用户报「带入了批次号为什么连生产日期都没有」)。
     *
     * <p>此前 createOne 把 生产日期 **固定写 NULL**(2026-10-30 设计口径「业务未录 → 纸上留空」);
     * 而报告取数的成品检验单(qc_asm_insp_head)**没有生产日期列**,所以批次号带进来了、生产日期却一直空。
     * 报告现已锚定生产批次,生产日期应随批次带入,按下列优先级取:</p>
     * <ol>
     *   <li><b>工单行完工时间</b>({@code plang.完工时间})—— 批次号本身就是「完工时自动生成的完工日标签」,
     *       实测 批次 20261017 ↔ 完工时间 2026-10-17 17:00,两者同一天;</li>
     *   <li><b>批次号可解析为 yyyyMMdd</b>(如 20261017) → 该日期(旧数据没有完工时间时的等价来源);</li>
     *   <li><b>首件检验单.生产日期</b>(同 工单号+工单行号)—— 兜底;首件可能早于完工日(是成型首批的日期);</li>
     *   <li>都取不到 → {@code null}(纸上留空,不造数据)。</li>
     * </ol>
     */
    private LocalDate resolveProductionDate(String woNo, Integer woLine, String lotNo, String firstNo) {
        // ① 工单行完工时间(按 工单号 + 工单行号 定位;找不到/未完工则往下走)
        if (woNo != null && !woNo.isBlank() && woLine != null) {
            List<java.sql.Date> done = jdbc.queryForList(
                    "SELECT CONVERT(date, 完工时间) FROM dbo.plang"
                            + " WHERE pl_no = ? AND ISNULL(pl_xc,0) = ? AND ISNULL(asp_cancel,'N') <> 'Y'"
                            + "   AND 完工时间 IS NOT NULL", java.sql.Date.class, woNo, woLine);
            if (!done.isEmpty() && done.get(0) != null) return done.get(0).toLocalDate();
        }
        // ② 批次号 = yyyyMMdd(完工日标签)
        if (lotNo != null && lotNo.trim().matches("\\d{8}")) {
            try {
                return LocalDate.parse(lotNo.trim(), java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
            } catch (Exception ignored) {
                // 非法日期(如 20261399)→ 落到 ③
            }
        }
        // ③ 首件检验单的生产日期(同工单行)
        if (firstNo != null && !firstNo.isBlank()) {
            List<java.sql.Date> d = jdbc.queryForList(
                    "SELECT CONVERT(date, 生产日期) FROM dbo.qc_first_insp_head"
                            + " WHERE 单据编号 = ? AND 生产日期 IS NOT NULL", java.sql.Date.class, firstNo);
            if (!d.isEmpty() && d.get(0) != null) return d.get(0).toLocalDate();
        }
        return null;
    }

    private String docOf(String panel, String woNo, Integer woLine) {        if (woNo == null || woNo.isBlank() || woLine == null) return null;
        String table = switch (panel) {
            case "QC_FIRST_INSP" -> "qc_first_insp_head";
            case "QC_PROC_INSP" -> "qc_proc_insp_head";
            default -> null;
        };
        if (table == null) return null;
        List<String> r = jdbc.queryForList("SELECT TOP 1 单据编号 FROM " + table
                + " WHERE 工单号 = ? AND 工单行号 = ? AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 单据日期 DESC, id DESC",
                String.class, woNo, woLine);
        return r.isEmpty() ? null : r.get(0);
    }

    // ==================== ③ 三单并集取数 ====================

    /** 把三张单的明细按「报告项目」归并成候选值列表(已按对齐表优先级排序) */
    private Map<String, List<Map<String, Object>>> loadSourceRows(String asmNo, String procNo, String firstNo) {
        Map<String, List<Map<String, Object>>> out = new LinkedHashMap<>();
        if (asmNo != null) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT 检验类型, 检验项目, 检验结果 AS 值文本, 测量值1, 测量值2, 测量值3, 测量值4, 测量值5, 结果判断 AS 判定"
                            + " FROM qc_asm_insp_detail WHERE 单据编号 = ? ORDER BY 行号", asmNo)) {
                addCandidate(out, "QC_ASM_INSP", asmNo, r);
            }
        }
        if (procNo != null) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT ISNULL(表区,N'') AS 检验类型, 检验项目, 实测数值 AS 值文本, 测量值1, 测量值2, 测量值3, 测量值4, 测量值5, 结果判断 AS 判定"
                            + " FROM qc_proc_insp_detail WHERE 单据编号 = ? ORDER BY 行号", procNo)) {
                addCandidate(out, "QC_PROC_INSP", procNo, r);
            }
        }
        if (firstNo != null) {
            for (Map<String, Object> r : jdbc.queryForList(
                    "SELECT ISNULL(表区,N'') AS 检验类型, 检验项目, 实测数值 AS 值文本, 测量值1, 测量值2, 测量值3, 测量值4, 测量值5, 结果判断 AS 判定"
                            + " FROM qc_first_insp_detail WHERE 单据编号 = ? ORDER BY 行号", firstNo)) {
                addCandidate(out, "QC_FIRST_INSP", firstNo, r);
            }
        }
        return out;
    }

    private void addCandidate(Map<String, List<Map<String, Object>>> out, String panel, String docNo,
                              Map<String, Object> r) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 报告项目, 优先级, 取值方式 FROM qc_oqc_item_map"
                        + " WHERE 源面板 = ? AND 源项目名 = ? AND ISNULL(停用,0) = 0", panel, str(r.get("检验项目")));
        for (Map<String, Object> m : rows) {
            Map<String, Object> c = new LinkedHashMap<>(r);
            c.put("面板", panel);
            c.put("单号", docNo);
            c.put("优先级", intOf(m.get("优先级")) == null ? 999 : intOf(m.get("优先级")));
            out.computeIfAbsent(str(m.get("报告项目")), k -> new ArrayList<>()).add(c);
        }
        out.values().forEach(l -> l.sort((a, b) -> Integer.compare(intOf(a.get("优先级")), intOf(b.get("优先级")))));
    }

    /** 按优先级取第一个"有值"的候选 */
    private Map<String, Object> pickValue(Map<String, List<Map<String, Object>>> src, String reportItem) {
        List<Map<String, Object>> cands = src.get(reportItem);
        if (cands == null) return null;
        for (Map<String, Object> c : cands) {
            String txt = str(c.get("值文本"));
            boolean hasNum = dec(c.get("测量值1")) != null || dec(c.get("测量值2")) != null
                    || dec(c.get("测量值3")) != null || dec(c.get("测量值4")) != null || dec(c.get("测量值5")) != null;
            if (txt.isBlank() && !hasNum) continue;
            String result = hasNum ? joinNumbers(c) : txt;
            Map<String, Object> hit = new LinkedHashMap<>();
            hit.put("结果", result);
            hit.put("判定", c.get("判定"));
            hit.put("数据来源", str(c.get("面板")) + ":" + str(c.get("单号")));
            hit.put("来源项目名", c.get("检验项目"));
            for (int i = 1; i <= 5; i++) hit.put("测量值" + i, c.get("测量值" + i));
            return hit;
        }
        return null;
    }

    /** 5 个测量值拼成纸面口径:44.5/44.6/44.5/44.7/44.6(用到几格拼几格) */
    private String joinNumbers(Map<String, Object> c) {
        List<String> parts = new ArrayList<>();
        for (int i = 1; i <= 5; i++) {
            BigDecimal v = dec(c.get("测量值" + i));
            if (v != null) parts.add(v.stripTrailingZeros().toPlainString());
        }
        return String.join("/", parts);
    }

    /** 计划表控制项目 → 报告项目(受控表单用语) */
    private String mapReportItem(String planItem) {
        if (planItem == null) return null;
        String t = planItem.replace("*", "").trim();
        for (Map.Entry<String, String> e : KEYWORD_TO_ITEM.entrySet()) {
            if (t.contains(e.getKey())) return e.getValue();
        }
        return null;
    }

    // ==================== ④ 基础设施 ====================

    private void mergeStatus(String no, String user) {
        jdbc.update("MERGE yj_doc_status AS t USING (VALUES (?,?)) AS s(panel_code, doc_no)"
                + " ON t.panel_code = s.panel_code AND t.doc_no = s.doc_no"
                + " WHEN NOT MATCHED THEN INSERT (panel_code, doc_no, canceled, saved, update_at) VALUES (?, ?, 'N', 'Y', GETDATE());",
                PANEL, no, PANEL, no);
    }

    /** 去 TAB/换行/首尾空格(产品编码历史脏值) */
    private String clean(String s) {
        return s == null ? "" : s.replace("\t", "").replace("\n", "").replace("\r", "").trim();
    }

    private String str(Object o) {
        if (o == null) return "";
        if (o instanceof java.sql.Date d) return d.toString();
        if (o instanceof java.sql.Timestamp ts) return ts.toLocalDateTime().toLocalDate().toString();
        return String.valueOf(o).trim();
    }

    private String nv(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private BigDecimal dec(Object o) {
        if (o == null) return null;
        if (o instanceof BigDecimal b) return b;
        try {
            return new BigDecimal(String.valueOf(o).trim());
        } catch (Exception e) {
            return null;
        }
    }

    private Integer intOf(Object o) {
        if (o == null) return null;
        try {
            return Integer.valueOf(String.valueOf(o).trim());
        } catch (Exception e) {
            return null;
        }
    }

    private Long longOf(Object o) {
        if (o == null) return null;
        try {
            return Long.valueOf(String.valueOf(o).trim());
        } catch (Exception e) {
            return null;
        }
    }
}
