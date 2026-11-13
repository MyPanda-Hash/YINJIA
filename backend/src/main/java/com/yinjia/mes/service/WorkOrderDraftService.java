package com.yinjia.mes.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产工单「编制草稿」(2026-11-13 方案 A:保存草稿 + 整页编制 + 草稿箱)。
 *
 * <p>用户口径:「新建的生产工单如何实现保存草稿的情况呢?是否当前不能使用弹窗形式而是使用页面形式会更好呢?」
 * ⇒ 拍板:新建工单改**整页编制**,增加**保存草稿**,生产工单页加**草稿箱**;草稿可继续编辑/删除/提交,
 * 提交时才生成正式工单。
 *
 * <p><b>为什么草稿单独存表、不写 {@code plang}</b>(这是本类存在的根本原因):
 * <ul>
 *   <li>{@code plang} 是外部单据表,任何一行都会**立刻**进入现役口径 ——
 *       快速排产「待排产池」= 生产线为空 + 未结案 + 未完工 的 plang 行
 *       ({@code ScheduleBoardService.pending});</li>
 *   <li>生产工单列表、排产/领料/报工的「扫工单号」解析({@code resolveWoLine})都直接查 plang;</li>
 *   <li>草稿若写 plang ⇒ 会出现在待排产池、能被排产/领料/报工 = **假草稿**。</li>
 * </ul>
 * 要直接写 plang 就得加"工单状态"列并改上面所有查询(改动面大,且 plang 另有外部程序直写),
 * 故草稿落 {@code wo_draft_head}/{@code wo_draft_line};**提交时才调用** {@link WorkOrderCreateService#create}
 * —— 与「新增」同一份建单实现,不另写一套(否则两套规则必然分叉)。
 *
 * <p><b>草稿 vs 提交的校验分层</b>:
 * <ul>
 *   <li>草稿:宽松 —— 只强制「主物料(产品编码)」,数量/日期/路线/子件都允许缺(现场先记一半);</li>
 *   <li>提交:严格 —— 完整复用 {@link WorkOrderCreateService} 的口径(产品存在、数量&gt;0、
 *       工艺路线已审核、临时工单≥1 行子件且用量/单位齐全),失败原因原样抛出、草稿保持草稿态。</li>
 * </ul>
 *
 * <p>草稿号用 {@code GDD-yyyy-MM-nnnn}({@link FormNoService} 的 GDD 段,与正式 GD 号池分开):
 * 正式 GD 号**只在提交成功那一刻**才取 —— 废弃草稿不占用正式号段。
 */
@Service
public class WorkOrderDraftService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderDraftService.class);

    public static final String STATE_DRAFT = "草稿";
    public static final String STATE_SUBMITTED = "已提交";
    /** 草稿号前缀(与正式工单 GD 分开;号池 s_allno 独立段) */
    public static final String DRAFT_PREFIX = "GDD";

    private final JdbcTemplate jdbc;
    private final FormNoService formNo;
    private final WorkOrderCreateService createService;

    public WorkOrderDraftService(JdbcTemplate jdbc, FormNoService formNo, WorkOrderCreateService createService) {
        this.jdbc = jdbc;
        this.formNo = formNo;
        this.createService = createService;
    }

    // ────────────────────────── ① 保存(新建/覆盖) ──────────────────────────

    /**
     * 保存草稿(新建 or 覆盖已有草稿)。
     *
     * @param body {草稿id(0=新建), 工单类型, 产品编码, 客户编码, 订单数量, 生产数量, 工单日期,
     *             计划开工日期, 交期, 工艺路线, 备注, 物料清单[{行序,子件编码,...}]}
     * @return {草稿id, 草稿号, 更新时间, 物料项数}
     */
    @Transactional
    public Map<String, Object> save(Map<String, Object> body, String user) {
        Map<String, Object> b = body == null ? Map.of() : body;
        long id = longOf(b.get("草稿id"));
        String kind = WorkOrderCreateService.KIND_TEMP.equals(str(b.get("工单类型")))
                ? WorkOrderCreateService.KIND_TEMP : WorkOrderCreateService.KIND_NORMAL;
        String productCode = str(b.get("产品编码"));
        if (productCode.isEmpty()) throw new IllegalArgumentException("请先选择主物料再保存草稿");

        // 主物料信息:档案里有就以档案为准(防止前端快照与档案不一致),没有就保留前端传值(草稿允许半成品)
        Map<String, Object> product = productOf(productCode);
        String productName = product.isEmpty() ? str(b.get("产品名称")) : str(product.get("存货名称"));
        String spec = product.isEmpty() ? str(b.get("规格型号")) : str(product.get("规格型号"));
        String unit = product.isEmpty() ? str(b.get("计量单位")) : str(product.get("计量单位"));

        // 客户名称:以客户档案为准(档案里没有就保留前端快照;草稿不校验客户存在,提交时才校验)
        String khdm = str(b.get("客户编码"));
        String khmc = str(b.get("客户名称"));
        if (!khdm.isEmpty()) {
            String hit = jdbc.query("SELECT TOP 1 ISNULL(mc,N'') FROM dbo.dm_kh WHERE dm=? AND ISNULL(asp_cancel,'N')<>'Y'",
                    rs -> rs.next() ? rs.getString(1) : null, khdm);
            if (hit != null && !hit.isBlank()) khmc = hit;
        }

        Double orderQty = numOrNull(b.get("订单数量"));
        Double planQty = numOrNull(b.get("生产数量"));
        Date plDate = dateOf(b.get("工单日期"));
        Date stDate = dateOf(b.get("计划开工日期"));
        Date dueDate = dateOf(b.get("交期"));
        String route = str(b.get("工艺路线"));
        String memo = str(b.get("备注"));

        String draftNo;
        if (id > 0) {
            Map<String, Object> head = requireDraft(id);
            draftNo = str(head.get("草稿号"));
            jdbc.update("UPDATE dbo.wo_draft_head SET 工单类型=?, 产品编码=?, 产品名称=?, 规格型号=?, 计量单位=?,"
                            + " 客户编码=?, 客户名称=?, 订单数量=?, 生产数量=?, 工单日期=?, 计划开工日期=?, 交期=?,"
                            + " 工艺路线=?, 备注=?, asp_user2=?, asp_time2=? WHERE id=?",
                    kind, productCode, nullIfEmpty(productName), nullIfEmpty(spec), nullIfEmpty(unit),
                    nullIfEmpty(khdm), nullIfEmpty(khmc), orderQty, planQty, plDate, stDate, dueDate,
                    nullIfEmpty(route), nullIfEmpty(memo), user, localNow(), id);
            // 旧行软删(草稿行不需要历史;保留留痕,重存即新行)
            jdbc.update("UPDATE dbo.wo_draft_line SET asp_cancel='Y', asp_user2=?, asp_time2=?"
                    + " WHERE 单头id=? AND ISNULL(asp_cancel,'N')<>'Y'", user, localNow(), id);
        } else {
            draftNo = formNo.next(DRAFT_PREFIX, user);
            jdbc.update("INSERT INTO dbo.wo_draft_head (草稿号, 状态, 工单类型, 产品编码, 产品名称, 规格型号, 计量单位,"
                            + " 客户编码, 客户名称, 订单数量, 生产数量, 工单日期, 计划开工日期, 交期, 工艺路线, 备注,"
                            + " asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)"
                            + " VALUES (?, N'草稿', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N')",
                    draftNo, kind, productCode, nullIfEmpty(productName), nullIfEmpty(spec), nullIfEmpty(unit),
                    nullIfEmpty(khdm), nullIfEmpty(khmc), orderQty, planQty, plDate, stDate, dueDate,
                    nullIfEmpty(route), nullIfEmpty(memo), user, localNow(), user, localNow());
            Long newId = jdbc.queryForObject("SELECT TOP 1 id FROM dbo.wo_draft_head WHERE 草稿号=?"
                    + " AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC", Long.class, draftNo);
            if (newId == null) throw new IllegalStateException("草稿已建但取 id 失败,请刷新草稿箱核对:" + draftNo);
            id = newId;
        }
        int lines = insertLines(id, kind, b.get("物料清单"), user);
        log.info("[工单草稿] {} {} 保存草稿 id={} 产品={} 物料{}行 by {}",
                draftNo, kind, id, productCode, lines, user);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("草稿id", id);
        out.put("草稿号", draftNo);
        out.put("更新时间", nowText());
        out.put("物料项数", lines);
        return out;
    }

    /** 写草稿子件行(只临时工单;行序按提交顺序重排;空编码行跳过) */
    private int insertLines(long headId, String kind, Object rawLines, String user) {
        if (!WorkOrderCreateService.KIND_TEMP.equals(kind)) return 0;
        List<Map<String, Object>> lines = listOf(rawLines);
        int seq = 0;
        int written = 0;
        for (Map<String, Object> line : lines) {
            String code = str(line.get("子件编码"));
            if (code.isEmpty()) continue;
            seq++;
            Map<String, Object> inv = invOf(code);
            String name = inv.isEmpty() ? str(line.get("子件名称")) : str(inv.get("存货名称"));
            String spec = inv.isEmpty() ? str(line.get("子件规格")) : str(inv.get("规格型号"));
            String unit = inv.isEmpty() ? str(line.get("计量单位")) : str(inv.get("计量单位"));
            jdbc.update("INSERT INTO dbo.wo_draft_line (单头id, 行序, 子件编码, 子件名称, 子件规格, 计量单位,"
                            + " 标准用量, 损耗量, 行备注, asp_user1, asp_time1, asp_cancel)"
                            + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N')",
                    headId, seq, code, nullIfEmpty(name), nullIfEmpty(spec), nullIfEmpty(unit),
                    round4(numOrNull(line.get("标准用量")) == null ? 0 : numOrNull(line.get("标准用量"))),
                    round4(numOrNull(line.get("损耗量")) == null ? 0 : numOrNull(line.get("损耗量"))),
                    nullIfEmpty(str(line.get("行备注"))), user, localNow());
            written++;
        }
        return written;
    }

    // ────────────────────────── ② 草稿箱 ──────────────────────────

    /** 草稿列表(草稿箱):只列 状态=草稿 且未删除,按最后修改时间倒序 */
    public List<Map<String, Object>> list(String keyword) {
        String kw = keyword == null ? "" : keyword.trim();
        String like = "%" + kw + "%";
        return jdbc.queryForList(
                "SELECT h.id AS 草稿id, h.草稿号, h.工单类型, h.产品编码,"
                        + " ISNULL(NULLIF(h.产品名称,N''), ISNULL(i.存货名称,N'')) AS 产品名称,"
                        + " ISNULL(NULLIF(h.规格型号,N''), ISNULL(i.规格型号,N'')) AS 规格型号,"
                        + " ISNULL(h.客户编码,N'') AS 客户编码,"
                        + " ISNULL(NULLIF(h.客户名称,N''), ISNULL(k.mc,N'')) AS 客户名称,"
                        + " ISNULL(h.订单数量,0) AS 订单数量, ISNULL(h.生产数量,0) AS 生产数量,"
                        + " CONVERT(varchar(10), h.工单日期, 120) AS 工单日期,"
                        + " CONVERT(varchar(10), h.交期, 120) AS 交期,"
                        + " ISNULL(h.工艺路线,N'') AS 工艺路线,"
                        + " ISNULL(h.asp_user1,N'') AS 创建人, ISNULL(h.asp_user2,N'') AS 最后修改人,"
                        + " CONVERT(varchar(16), h.asp_time2, 120) AS 更新时间,"
                        + " (SELECT COUNT(*) FROM dbo.wo_draft_line l WHERE l.单头id=h.id"
                        + "   AND ISNULL(l.asp_cancel,'N')<>'Y') AS 物料项数"
                        + " FROM dbo.wo_draft_head h"
                        + " LEFT JOIN dbo.bs_inv i ON i.存货编码=h.产品编码 AND ISNULL(i.asp_cancel,'N')<>'Y'"
                        + " LEFT JOIN dbo.dm_kh k ON k.dm=h.客户编码"
                        + " WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND h.状态=N'草稿'"
                        + "   AND (?=N'' OR h.草稿号 LIKE ? OR h.产品编码 LIKE ? OR ISNULL(h.产品名称,N'') LIKE ?)"
                        + " ORDER BY h.asp_time2 DESC, h.id DESC", kw, like, like, like);
    }

    /** 草稿详情(继续编辑/提交前读取):表头全字段 + 物料清单行 */
    public Map<String, Object> get(long id) {
        Map<String, Object> head = requireDraft(id);
        Map<String, Object> out = new LinkedHashMap<>();
        for (String k : new String[]{"草稿id", "草稿号", "状态", "工单类型", "产品编码", "产品名称", "规格型号", "计量单位",
                "客户编码", "客户名称", "订单数量", "生产数量", "工单日期", "计划开工日期", "交期", "工艺路线",
                "备注", "正式工单号", "创建人", "更新时间"}) {
            out.put(k, head.get(k));
        }
        out.put("物料清单", jdbc.queryForList(
                "SELECT ISNULL(行序,0) AS 行序, ISNULL(子件编码,N'') AS 子件编码,"
                        + " ISNULL(子件名称,N'') AS 子件名称, ISNULL(子件规格,N'') AS 子件规格,"
                        + " ISNULL(计量单位,N'') AS 计量单位, ISNULL(标准用量,0) AS 标准用量,"
                        + " ISNULL(损耗量,0) AS 损耗量, ISNULL(行备注,N'') AS 行备注"
                        + " FROM dbo.wo_draft_line WHERE 单头id=? AND ISNULL(asp_cancel,'N')<>'Y'"
                        + " ORDER BY ISNULL(行序,999), id", id));
        return out;
    }

    /** 删除草稿(软删;只允许草稿态) */
    @Transactional
    public Map<String, Object> delete(long id, String user) {
        Map<String, Object> head = requireDraft(id);
        jdbc.update("UPDATE dbo.wo_draft_head SET asp_cancel='Y', asp_user2=?, asp_time2=? WHERE id=?",
                user, localNow(), id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("草稿号", str(head.get("草稿号")));
        log.info("[工单草稿] {} 删除草稿 id={} by {}", str(head.get("草稿号")), id, user);
        return out;
    }

    /** 草稿数量(生产工单页草稿箱角标) */
    public int count() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM dbo.wo_draft_head"
                + " WHERE ISNULL(asp_cancel,'N')<>'Y' AND 状态=N'草稿'", Integer.class);
        return n == null ? 0 : n;
    }

    // ────────────────────────── ③ 提交生成正式工单 ──────────────────────────

    /**
     * 提交草稿 → 生成正式生产工单。
     *
     * <p>组装成与 {@code /px/workOrderList/create} **完全相同**的 body,直接调
     * {@link WorkOrderCreateService#create} —— 两条入口共用一份建单实现与校验,
     * 不在这里另写"提交版 SQL"(否则规则必然分叉)。
     *
     * <p>成功后才把草稿置为「已提交」并回填正式工单号;失败(校验不过)时抛业务异常,
     * 草稿保持草稿态可继续改。
     */
    @Transactional
    public Map<String, Object> submit(long id, String user) {
        Map<String, Object> detail = get(id);
        String draftNo = str(detail.get("草稿号"));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("工单类型", detail.get("工单类型"));
        body.put("产品编码", detail.get("产品编码"));
        body.put("客户编码", detail.get("客户编码"));
        body.put("订单数量", detail.get("订单数量"));
        body.put("生产数量", detail.get("生产数量"));
        body.put("工单日期", detail.get("工单日期"));
        body.put("计划开工日期", detail.get("计划开工日期"));
        body.put("交期", detail.get("交期"));
        body.put("工艺路线", detail.get("工艺路线"));
        body.put("备注", detail.get("备注"));
        body.put("物料清单", detail.get("物料清单"));
        Map<String, Object> created = createService.create(body, user);
        String plNo = str(created.get("工单号"));
        jdbc.update("UPDATE dbo.wo_draft_head SET 状态=N'已提交', 正式工单号=?, asp_user2=?, asp_time2=?"
                + " WHERE id=?", nullIfEmpty(plNo), user, localNow(), id);
        log.info("[工单草稿] {} 提交为正式工单 {} (行id={}) by {}", draftNo, plNo, created.get("行id"), user);
        Map<String, Object> out = new LinkedHashMap<>(created);
        out.put("草稿号", draftNo);
        return out;
    }

    // ────────────────────────── 工具 ──────────────────────────

    /**
     * 读草稿头并要求「存在 + 状态=草稿 + 未删除」。
     *
     * @throws IllegalArgumentException 不存在/已提交/已删除
     */
    private Map<String, Object> requireDraft(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT h.id AS 草稿id, h.草稿号, h.状态, h.工单类型, h.产品编码, ISNULL(h.产品名称,N'') AS 产品名称,"
                        + " ISNULL(h.规格型号,N'') AS 规格型号, ISNULL(h.计量单位,N'') AS 计量单位,"
                        + " ISNULL(h.客户编码,N'') AS 客户编码, ISNULL(h.客户名称,N'') AS 客户名称,"
                        + " ISNULL(h.订单数量,0) AS 订单数量, ISNULL(h.生产数量,0) AS 生产数量,"
                        + " CONVERT(varchar(10), h.工单日期, 120) AS 工单日期,"
                        + " CONVERT(varchar(10), h.计划开工日期, 120) AS 计划开工日期,"
                        + " CONVERT(varchar(10), h.交期, 120) AS 交期,"
                        + " ISNULL(h.工艺路线,N'') AS 工艺路线, ISNULL(h.备注,N'') AS 备注,"
                        + " ISNULL(h.正式工单号,N'') AS 正式工单号, ISNULL(h.asp_user1,N'') AS 创建人,"
                        + " CONVERT(varchar(16), h.asp_time2, 120) AS 更新时间"
                        + " FROM dbo.wo_draft_head h WHERE h.id=? AND ISNULL(h.asp_cancel,'N')<>'Y'", id);
        if (rows.isEmpty()) throw new IllegalArgumentException("该草稿不存在或已删除");
        Map<String, Object> head = rows.get(0);
        if (!STATE_DRAFT.equals(str(head.get("状态")))) {
            throw new IllegalArgumentException("该草稿不存在或已提交(当前状态:" + str(head.get("状态")) + ")");
        }
        return head;
    }

    private Map<String, Object> productOf(String code) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT 存货编码, 存货名称, ISNULL(规格型号,N'') AS 规格型号,"
                            + " ISNULL(NULLIF(ISNULL(计量单位,N''),N''), ISNULL(生产单位,N'')) AS 计量单位"
                            + " FROM dbo.bs_inv WHERE 存货编码=? AND ISNULL(asp_cancel,'N')<>'Y'", code);
            return rows.isEmpty() ? Map.of() : rows.get(0);
        } catch (RuntimeException e) {
            return Map.of();
        }
    }

    private Map<String, Object> invOf(String code) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT 存货名称, ISNULL(规格型号,N'') AS 规格型号,"
                            + " ISNULL(NULLIF(ISNULL(计量单位,N''),N''), ISNULL(生产单位,N'')) AS 计量单位"
                            + " FROM dbo.bs_inv WHERE 存货编码=? AND ISNULL(asp_cancel,'N')<>'Y'", code);
            return rows.isEmpty() ? Map.of() : rows.get(0);
        } catch (RuntimeException e) {
            return Map.of();
        }
    }

    private static String nowText() {
        return java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
    }

    /**
     * 写库用的「当前时间」(JVM 本地墙钟,非 GETDATE/SYSDATETIME)。
     *
     * <p>为什么不用 {@code SYSDATETIME()}:本机 SQL Server 在 Docker 容器里 TZ=UTC,
     * {@code SYSDATETIME()} 比北京时间慢 8 小时 ⇒ 草稿箱「更新时间」会显示 06:45 而页面头部
     * (返回给前端的 nowText)显示 14:45,同一份数据两个时间、现场只会报「时间不对」。
     * 草稿表是本次新建、只有本应用写入 ⇒ 统一落本地时间,与页面显示一致。
     * (先例:完工明细「完工时间」同样用 LocalDateTime.now(),见 wo-completion-done-time 备忘。)
     */
    private static Timestamp localNow() {
        return Timestamp.valueOf(LocalDateTime.now());
    }

    private static Date dateOf(Object v) {
        String s = str(v);
        if (s.isEmpty()) return null;
        String day = s.length() >= 10 ? s.substring(0, 10) : s;
        try {
            return Date.valueOf(LocalDate.parse(day, DateTimeFormatter.ofPattern("yyyy-MM-dd")));
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("日期格式应为 yyyy-MM-dd:" + s);
        }
    }

    private static String nullIfEmpty(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }

    private static long longOf(Object v) {
        if (v instanceof Number n) return n.longValue();
        String s = str(v);
        if (s.isEmpty()) return 0;
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Double numOrNull(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return n.doubleValue();
        String s = str(v);
        if (s.isEmpty()) return null;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static double round4(double v) {
        return Math.round(v * 10000d) / 10000d;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> listOf(Object v) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (v instanceof List<?> l) {
            for (Object o : l) if (o instanceof Map<?, ?> m) out.add(new LinkedHashMap<>((Map<String, Object>) m));
        }
        return out;
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }
}
