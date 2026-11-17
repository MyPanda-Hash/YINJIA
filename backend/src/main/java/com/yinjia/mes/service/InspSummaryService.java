package com.yinjia.mes.service;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataValidation;
import org.apache.poi.ss.usermodel.DataValidationConstraint;
import org.apache.poi.ss.usermodel.DataValidationHelper;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFDataValidation;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 样品检验汇总表(2026-11-17)。
 *
 * <p><b>用户口径</b>:「为当前的样品检验增加汇总表,能够查看到一天或者一周,送好多个样品,测试啥的总表。
 * 要按一个时间范围,去导出有多少人送了啥样品测试啥,安排检测工作。」确认过的三条:
 * <ol>
 *   <li>形态 = 样品检验下的**独立页面**(不进通用单据面板);</li>
 *   <li>视角 = **按送样人** + **按委托单/样品**(一单一行,列出该单要测的项目);</li>
 *   <li>本期不做"安排人/计划日期"这类可写字段 —— 导出 Excel 线下排班。</li>
 * </ol>
 *
 * <p><b>数据</b>:检验委托单头 {@code qc_insp_commission_head} × 行
 * {@code qc_insp_commission_detail},一条 SQL 取回(一行 = 委托单的一个检测项目;
 * 没有行时也保留单据,按"0 个项目"计),再在内存里折叠成两个视角 + 汇总数。
 * 之所以不在 SQL 里 GROUP BY 三遍:两周内单据量很小(每张 10~20 行),单次取回更简单、
 * 三个视角的数字天然同源,不会出现"按人合计 ≠ 按单合计"。
 *
 * <p><b>单据状态</b>口径与 {@link QcFlowService}/{@code QueryService} 完全一致:
 * {@code yj_doc_status} 有行按 已作废 &gt; 已中止 &gt; 审批中 &gt; 已审核 &gt; 草稿 折叠;
 * 没行(旧数据)先看审核时间、再看单头「单据状态」列、最后兜底草稿。
 * 汇总默认**排除已作废/已中止**的单(那是废单,不该算进检测工作量);显式按状态筛选时照给定值查。
 *
 * <p><b>只读</b>:本服务不改任何业务数据;权限闸门在 Controller(页面级虚拟面板
 * {@link PagePanelRegistry#INSP_SUMMARY})。
 */
@Service
public class InspSummaryService {

    /** 单次最多取回的项目行(按天/周汇总远达不到;防"查全库"把内存和界面拖死) */
    private static final int MAX_ROWS = 20000;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;

    public InspSummaryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 汇总取数(只读)。
     *
     * @param body 条件:{@code 日期起} / {@code 日期止}(必填,YYYY-MM-DD;缺省 = 今天)、
     *             {@code 送样人}(模糊)、{@code 单据状态}(草稿/审批中/已审核/已作废/已中止/全部)、
     *             {@code keyword}(单号/样品名称/检验类别/委托单位/检测项目 任一段)
     * @return {@code {数据时间, 查询条件, 汇总, 按送样人:[…], 按单据:[{…, 明细:[…]}]}}
     */
    public Map<String, Object> summary(Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        String from = nz(str(b.get("日期起")));
        String to = nz(str(b.get("日期止")));
        if (from.isEmpty()) from = java.time.LocalDate.now().toString();
        if (to.isEmpty()) to = from;
        if (from.compareTo(to) > 0) {                 // 传反了不报错:按同一区间查(与查询弹窗的容错一致)
            String t = from;
            from = to;
            to = t;
        }
        String sender = str(b.get("送样人"));
        String status = nz(str(b.get("单据状态")));
        String keyword = str(b.get("keyword"));

        List<Object> args = new ArrayList<>();
        StringBuilder inner = new StringBuilder();
        inner.append("SELECT ")
                .append(" h.单据编号 AS 单据编号, h.单据日期 AS 单据日期,")
                .append(" ISNULL(NULLIF(LTRIM(RTRIM(h.联系人)), N''), N'未填送样人') AS 送样人,")
                .append(" ISNULL(h.委托单位, N'') AS 委托单位,")
                .append(" ISNULL(h.样品名称, N'') AS 样品名称,")
                .append(" ISNULL(h.样品型号规格, N'') AS 样品类别,")
                .append(" ISNULL(h.样品数量, N'') AS 样品数量,")
                .append(" ISNULL(h.检验类别, N'') AS 检验类别,")
                .append(" ISNULL(h.检验项目及要求, N'') AS 检验项目及要求,")
                .append(" ISNULL(h.备注, N'') AS 备注,")
                .append(" h.合计收费 AS 合计收费, ISNULL(h.审核人, N'') AS 审核人, h.审核时间 AS 审核时间,")
                .append(" d.行号 AS 行号,")
                .append(" ISNULL(d.检测元素, N'') AS 检测元素,")
                .append(" ISNULL(d.测试方法, N'') AS 测试方法,")
                .append(" ISNULL(d.测试周期, N'') AS 测试周期,")
                .append(" d.收费 AS 项目收费,")
                .append(" ").append(statusExpr()).append(" AS 单据状态")
                .append(" FROM dbo.qc_insp_commission_head h")
                .append(" LEFT JOIN dbo.qc_insp_commission_detail d ON d.单据编号 = h.单据编号")
                .append(" OUTER APPLY (SELECT TOP 1 s.shr, s.canceled, s.stopped, s.pending")
                .append("   FROM dbo.yj_doc_status s")
                .append("  WHERE s.panel_code = N'INSP_COMMISSION' AND s.doc_no = h.单据编号")
                .append("  ORDER BY s.id DESC) ds")
                .append(" WHERE ISNULL(h.asp_cancel, N'N') <> N'Y'")
                .append("   AND h.单据日期 >= ? AND h.单据日期 <= ?");
        args.add(from);
        args.add(to);

        if (sender != null) {
            inner.append(" AND ISNULL(NULLIF(LTRIM(RTRIM(h.联系人)), N''), N'未填送样人') LIKE ?");
            args.add("%" + sender + "%");
        }
        if (keyword != null) {
            String like = "%" + keyword + "%";
            inner.append(" AND (h.单据编号 LIKE ? OR ISNULL(h.样品名称, N'') LIKE ?")
                    .append(" OR ISNULL(h.检验类别, N'') LIKE ? OR ISNULL(h.委托单位, N'') LIKE ?")
                    .append(" OR ISNULL(d.检测元素, N'') LIKE ?)");
            for (int i = 0; i < 5; i++) args.add(like);
        }

        StringBuilder sql = new StringBuilder("SELECT TOP ").append(MAX_ROWS).append(" * FROM (")
                .append(inner).append(") t WHERE ");
        if (status.isEmpty() || "全部".equals(status)) {
            // 废单不进工作量:已作废/已中止要显式筛状态才看(与"待检任务量"口径一致)
            sql.append("单据状态 IN (N'草稿', N'审批中', N'已审核')");
        } else {
            sql.append("单据状态 = ?");
            args.add(status);
        }
        sql.append(" ORDER BY 单据日期 DESC, 单据编号 DESC, 行号");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());

        // ── 折叠成「按单据」 ────────────────────────────────────────────────────
        Map<String, Map<String, Object>> docs = new LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            String no = str(r.get("单据编号"));
            if (no == null) continue;
            Map<String, Object> doc = docs.get(no);
            if (doc == null) {
                doc = new LinkedHashMap<>();
                doc.put("单据编号", no);
                doc.put("单据日期", dateText(r.get("单据日期")));
                doc.put("送样人", nz(str(r.get("送样人"))));
                doc.put("委托单位", nz(str(r.get("委托单位"))));
                doc.put("样品名称", nz(str(r.get("样品名称"))));
                doc.put("样品类别", nz(str(r.get("样品类别"))));
                doc.put("样品数量", nz(str(r.get("样品数量"))));
                doc.put("检验类别", nz(str(r.get("检验类别"))));
                doc.put("检验项目及要求", nz(str(r.get("检验项目及要求"))));
                doc.put("备注", nz(str(r.get("备注"))));
                doc.put("单据状态", nz(str(r.get("单据状态"))));
                doc.put("审核人", nz(str(r.get("审核人"))));
                doc.put("审核时间", timeText(r.get("审核时间")));
                doc.put("合计收费", zeroIfNull(decimalOf(r.get("合计收费"))));
                doc.put("检测项目数", 0);
                doc.put("检测项目", new LinkedHashSet<String>());
                doc.put("测试方法", new LinkedHashSet<String>());
                doc.put("项目收费合计", BigDecimal.ZERO);
                doc.put("明细", new ArrayList<Map<String, Object>>());
                docs.put(no, doc);
            }
            String item = nz(str(r.get("检测元素")));
            if (item.isEmpty()) continue;               // 只有单头、还没有检验项目行
            @SuppressWarnings("unchecked")
            Set<String> items = (Set<String>) doc.get("检测项目");
            items.add(item);
            String method = nz(str(r.get("测试方法")));
            if (!method.isEmpty()) {
                @SuppressWarnings("unchecked")
                Set<String> methods = (Set<String>) doc.get("测试方法");
                methods.add(method);
            }
            BigDecimal fee = decimalOf(r.get("项目收费"));
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> details = (List<Map<String, Object>>) doc.get("明细");
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("行号", intOf(r.get("行号"), details.size() + 1));
            d.put("检测元素", item);
            d.put("测试方法", method);
            d.put("测试周期", nz(str(r.get("测试周期"))));
            d.put("收费", zeroIfNull(fee));
            details.add(d);
            doc.put("项目收费合计", ((BigDecimal) doc.get("项目收费合计")).add(zeroIfNull(fee)));
        }

        // 单据级收尾:项目数、项目/方法串、收费(单头合计收费优先,没有则用行合计)
        List<Map<String, Object>> byDoc = new ArrayList<>();
        for (Map<String, Object> doc : docs.values()) {
            @SuppressWarnings("unchecked")
            Set<String> items = (Set<String>) doc.get("检测项目");
            @SuppressWarnings("unchecked")
            Set<String> methods = (Set<String>) doc.get("测试方法");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> details = (List<Map<String, Object>>) doc.get("明细");
            doc.put("检测项目数", details.size());
            doc.put("检测项目", String.join("、", items));
            doc.put("测试方法", String.join("、", methods));
            BigDecimal headFee = (BigDecimal) doc.get("合计收费");
            BigDecimal itemFee = (BigDecimal) doc.get("项目收费合计");
            boolean headFeeEmpty = headFee == null || headFee.compareTo(BigDecimal.ZERO) == 0;
            doc.put("合计收费", headFeeEmpty ? itemFee : headFee);
            byDoc.add(doc);
        }

        // ── 折叠成「按送样人」────────────────────────────────────────────────────
        Map<String, Map<String, Object>> senderMap = new LinkedHashMap<>();
        for (Map<String, Object> doc : byDoc) {
            String who = nz(str(doc.get("送样人")));
            if (who.isEmpty()) who = "未填送样人";
            Map<String, Object> s = senderMap.get(who);
            if (s == null) {
                s = new LinkedHashMap<>();
                s.put("送样人", who);
                s.put("送样单数", 0);
                s.put("检测项目项次", 0);
                s.put("收费合计", BigDecimal.ZERO);
                s.put("涉及样品", new LinkedHashSet<String>());
                s.put("检测项目", new LinkedHashSet<String>());
                s.put("最近送样日期", "");
                s.put("已审核单数", 0);
                s.put("待检单数", 0);
                senderMap.put(who, s);
            }
            s.put("送样单数", ((Number) s.get("送样单数")).intValue() + 1);
            s.put("检测项目项次", ((Number) s.get("检测项目项次")).intValue() + ((Number) doc.get("检测项目数")).intValue());
            s.put("收费合计", ((BigDecimal) s.get("收费合计")).add((BigDecimal) doc.get("合计收费")));
            String sample = nz(str(doc.get("样品名称")));
            if (!sample.isEmpty()) {
                @SuppressWarnings("unchecked")
                Set<String> samples = (Set<String>) s.get("涉及样品");
                samples.add(sample);
            }
            @SuppressWarnings("unchecked")
            Set<String> sItems = (Set<String>) s.get("检测项目");
            String items = nz(str(doc.get("检测项目")));
            if (!items.isEmpty()) sItems.add(items);
            String day = nz(str(doc.get("单据日期")));
            if (day.compareTo(nz(str(s.get("最近送样日期")))) > 0) s.put("最近送样日期", day);
            if ("已审核".equals(str(doc.get("单据状态")))) {
                s.put("已审核单数", ((Number) s.get("已审核单数")).intValue() + 1);
            } else {
                s.put("待检单数", ((Number) s.get("待检单数")).intValue() + 1);
            }
        }
        List<Map<String, Object>> bySender = new ArrayList<>(senderMap.values());
        for (Map<String, Object> s : bySender) {
            @SuppressWarnings("unchecked")
            Set<String> samples = (Set<String>) s.get("涉及样品");
            @SuppressWarnings("unchecked")
            Set<String> items = (Set<String>) s.get("检测项目");
            s.put("涉及样品", String.join("、", samples));
            // 「检测项目」是多张单的并集:按"单内项目串"去重会重复,这里展开成一维再取并集
            LinkedHashSet<String> flat = new LinkedHashSet<>();
            for (String one : items) {
                for (String part : one.split("、")) {
                    if (!part.isBlank()) flat.add(part.trim());
                }
            }
            s.put("检测项目", String.join("、", flat));
        }
        // 排序:送得多的排前面,同单数按收费、再按最近日期、最后按姓名
        bySender.sort((x, y) -> {
            int c = Integer.compare(((Number) y.get("送样单数")).intValue(), ((Number) x.get("送样单数")).intValue());
            if (c != 0) return c;
            c = ((BigDecimal) y.get("收费合计")).compareTo((BigDecimal) x.get("收费合计"));
            if (c != 0) return c;
            c = str(y.get("最近送样日期")).compareTo(str(x.get("最近送样日期")));
            if (c != 0) return c;
            return str(x.get("送样人")).compareTo(str(y.get("送样人")));
        });

        // ── 汇总数 ────────────────────────────────────────────────────────────
        int 已审核 = 0;
        int 待检 = 0;
        BigDecimal 收费 = BigDecimal.ZERO;
        int 项次 = 0;
        for (Map<String, Object> doc : byDoc) {
            if ("已审核".equals(str(doc.get("单据状态")))) 已审核++;
            else 待检++;
            收费 = 收费.add((BigDecimal) doc.get("合计收费"));
            项次 += ((Number) doc.get("检测项目数")).intValue();
        }
        Map<String, Object> stat = new LinkedHashMap<>();
        stat.put("送样人数", bySender.size());
        stat.put("送样单数", byDoc.size());
        stat.put("检测项目项次", 项次);
        stat.put("收费合计", 收费);
        stat.put("已审核单数", 已审核);
        stat.put("待检单数", 待检);

        Map<String, Object> cond = new LinkedHashMap<>();
        cond.put("日期起", from);
        cond.put("日期止", to);
        cond.put("送样人", sender == null ? "" : sender);
        cond.put("单据状态", status.isEmpty() ? "全部" : status);
        cond.put("keyword", keyword == null ? "" : keyword);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("数据时间", LocalDateTime.now().format(TS));
        out.put("查询条件", cond);
        out.put("汇总", stat);
        out.put("按送样人", bySender);
        out.put("按单据", byDoc);
        return out;
    }

    /** 导出结果:文件名 + 工作簿字节(Controller 直接落响应头) */
    public record ExportFile(String fileName, byte[] bytes) { }

    /** 送检信息汇总表的表头(列顺序 = 用户 2026-11-17 给的纸表格式,不可随意调) */
    private static final String[] EXPORT_COLUMNS = {
            "时间", "送样人", "委托单编号", "样品名称", "数量", "测试项目",
            "是否接收", "是否检测", "数据或报告输出", "备注",
    };
    /** 后三列是「人工勾选/下拉」列(不读库,导出空白 + Excel 数据验证下拉,线下安排检测用) */
    private static final int EXPORT_COL_接收 = 6;
    private static final int EXPORT_COL_检测 = 7;
    private static final int EXPORT_COL_输出 = 8;
    /** 校验下拉覆盖到数据行之后这么多行,便于在导出文件里继续补行 */
    private static final int EXPORT_VALIDATION_BUFFER = 200;

    /**
     * 导出「送检信息汇总表」(.xlsx,单 sheet)。
     *
     * <p>用户口径(2026-11-17 截图):表头 = 时间 / 送样人 / 委托单编号 / 样品名称 / 数量 / 测试项目 /
     * 是否接收 / 是否检测 / 数据或报告输出 / 备注;一行 = 一张检验委托单;后三列在 Excel 里是
     * **下拉选**(是否接收、是否检测 = √;数据或报告输出 = 数据 / 报告 / 数据+报告),导出时不填值。
     *
     * <p>为什么放在服务端用 POI 而不是前端 xlsx 库:SheetJS 社区版**写不出 Excel 数据验证**
     * (下拉列表),POI 5.x 是项目既有依赖(报表链),能直接落 DataValidation + 列宽/冻结/筛选,
     * 也就顺手把「导出格式」的话事权收到服务端一份。
     *
     * @param body 与 {@link #summary(Map)} 同一套查询条件(日期段/送样人/状态/关键字)
     */
    public ExportFile export(Map<String, Object> body) {
        Map<String, Object> data = summary(body);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> docs = (List<Map<String, Object>>) data.getOrDefault("按单据", List.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> cond = (Map<String, Object>) data.getOrDefault("查询条件", Map.of());

        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("送检信息汇总表");
            CellStyle headStyle = headerStyle(wb);
            CellStyle bodyStyle = bodyStyle(wb, false);
            CellStyle wrapStyle = bodyStyle(wb, true);

            Row head = sheet.createRow(0);
            head.setHeightInPoints(24f);
            for (int i = 0; i < EXPORT_COLUMNS.length; i++) {
                Cell c = head.createCell(i);
                c.setCellValue(EXPORT_COLUMNS[i]);
                c.setCellStyle(headStyle);
            }
            int[] widths = {14, 12, 20, 22, 10, 42, 12, 12, 18, 26};
            for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i] * 256);

            int r = 1;
            for (Map<String, Object> d : docs) {
                Row row = sheet.createRow(r);
                row.setHeightInPoints(22f);
                setCell(row, 0, strOf(d.get("单据日期")), bodyStyle);
                setCell(row, 1, strOf(d.get("送样人")), bodyStyle);
                setCell(row, 2, strOf(d.get("单据编号")), bodyStyle);
                setCell(row, 3, strOf(d.get("样品名称")), bodyStyle);
                setCell(row, 4, strOf(d.get("样品数量")), bodyStyle);
                setCell(row, 5, strOf(d.get("检测项目")), wrapStyle);
                // 三列人工勾选列:导出留空(下拉由下方 DataValidation 提供)
                setCell(row, EXPORT_COL_接收, "", bodyStyle);
                setCell(row, EXPORT_COL_检测, "", bodyStyle);
                setCell(row, EXPORT_COL_输出, "", bodyStyle);
                setCell(row, 9, strOf(d.get("备注")), wrapStyle);
                r++;
            }
            int lastDataRow = Math.max(1, r - 1);

            addListValidation(sheet, EXPORT_COL_接收, lastDataRow, new String[]{"√"},
                    "是否接收", "下拉选 √");
            addListValidation(sheet, EXPORT_COL_检测, lastDataRow, new String[]{"√"},
                    "是否检测", "下拉选 √");
            addListValidation(sheet, EXPORT_COL_输出, lastDataRow, new String[]{"数据", "报告", "数据+报告"},
                    "数据或报告输出", "下拉选:数据 / 报告 / 数据+报告");

            sheet.createFreezePane(0, 1);
            if (!docs.isEmpty()) {
                sheet.setAutoFilter(new CellRangeAddress(0, lastDataRow, 0, EXPORT_COLUMNS.length - 1));
            }
            wb.write(out);
            String from = compactDate(strOf(cond.get("日期起")));
            String to = compactDate(strOf(cond.get("日期止")));
            String fileName = "送检信息汇总表_" + from + (to.isEmpty() || to.equals(from) ? "" : "-" + to) + ".xlsx";
            return new ExportFile(fileName, out.toByteArray());
        } catch (IOException e) {
            throw new IllegalStateException("生成送检信息汇总表失败：" + e.getMessage(), e);
        }
    }

    private static String strOf(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private static void setCell(Row row, int col, String value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value == null ? "" : value);
        c.setCellStyle(style);
    }

    /** 表头:加粗、浅灰底、居中、细边框(与用户纸表截图同款) */
    private static CellStyle headerStyle(XSSFWorkbook wb) {
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 11);
        f.setFontName("宋体");
        CellStyle s = wb.createCellStyle();
        s.setFont(f);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        border(s);
        return s;
    }

    /** 正文:细边框、垂直居中;wrap=true 用于「测试项目/备注」这种可能多行的长文本 */
    private static CellStyle bodyStyle(XSSFWorkbook wb, boolean wrap) {
        Font f = wb.createFont();
        f.setFontHeightInPoints((short) 11);
        f.setFontName("宋体");
        CellStyle s = wb.createCellStyle();
        s.setFont(f);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setAlignment(HorizontalAlignment.LEFT);
        if (wrap) s.setWrapText(true);
        border(s);
        return s;
    }

    private static void border(CellStyle s) {
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
    }

    /**
     * 给某列加 Excel 下拉(数据验证)。
     *
     * @param endDataRow 最后一条数据行(0 基);下拉范围从第 1 行覆盖到 endDataRow + 200,
     *                   这样用户在导出文件里继续补行也能选
     */
    private static void addListValidation(Sheet sheet, int col, int endDataRow,
                                          String[] options, String promptTitle, String promptText) {
        DataValidationHelper helper = sheet.getDataValidationHelper();
        DataValidationConstraint constraint = helper.createExplicitListConstraint(options);
        CellRangeAddressList range = new CellRangeAddressList(1, endDataRow + EXPORT_VALIDATION_BUFFER, col, col);
        DataValidation dv = helper.createValidation(constraint, range);
        dv.setEmptyCellAllowed(true);
        dv.setShowPromptBox(true);
        dv.createPromptBox(promptTitle, promptText);
        dv.setShowErrorBox(true);
        dv.setErrorStyle(DataValidation.ErrorStyle.STOP);
        dv.createErrorBox("请从下拉中选择", "可选值:" + String.join(" / ", options));
        if (dv instanceof XSSFDataValidation x) {
            // ⚠ 这里必须传 true,箭头才会显示 —— 两层 inversion:
            //   ① POI 源码:XSSFDataValidation.setSuppressDropDownArrow(s) 实际写 showDropDown = !s;
            //   ② OOXML/Excel 语义:showDropDown="1" 表示**隐藏**箭头(openpyxl 直接把它别名为
            //      hide_drop_down)。⇒ 只有 suppress=true 才落成 showDropDown="0",Excel 才给下拉箭头。
            x.setSuppressDropDownArrow(true);
        }
        sheet.addValidationData(dv);
    }

    /** 2026-11-01 → 20261101(文件名用) */
    private static String compactDate(String s) {
        return s == null ? "" : s.replace("-", "").trim();
    }

    /** 单据状态表达式(与 QcFlowService.statusOf 同一优先级,别名 ds 固定) */
    private static String statusExpr() {
        return "CASE WHEN ds.shr IS NULL AND ds.canceled IS NULL AND ds.stopped IS NULL AND ds.pending IS NULL"
                + " THEN COALESCE(CASE WHEN h.审核时间 IS NOT NULL THEN N'已审核'"
                + " ELSE NULLIF(h.单据状态, N'') END, N'草稿')"
                + " WHEN ISNULL(ds.canceled, 'N') = 'Y' THEN N'已作废'"
                + " WHEN ISNULL(ds.stopped, 'N') = 'Y' THEN N'已中止'"
                + " WHEN ISNULL(ds.pending, 'N') = 'Y' THEN N'审批中'"
                + " WHEN ISNULL(ds.shr, N'') <> N'' THEN N'已审核'"
                + " ELSE N'草稿' END";
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v);
        return s.isBlank() ? null : s.trim();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static BigDecimal decimalOf(Object v) {
        if (v == null) return BigDecimal.ZERO;
        if (v instanceof BigDecimal d) return d;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static BigDecimal zeroIfNull(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static int intOf(Object v, int def) {
        if (v instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (RuntimeException e) {
            return def;
        }
    }

    /** 日期列 → yyyy-MM-dd(库列是 date/datetime;别把 Timestamp 原样下发,前端会带出 00:00:00) */
    private static String dateText(Object v) {
        if (v == null) return "";
        if (v instanceof Date d) return d.toLocalDate().toString();
        if (v instanceof Timestamp ts) return ts.toLocalDateTime().toLocalDate().toString();
        String s = String.valueOf(v).trim();
        return s.length() > 10 ? s.substring(0, 10) : s;
    }

    /** 时间列 → yyyy-MM-dd HH:mm:ss(空值给空串,界面显示「-」) */
    private static String timeText(Object v) {
        if (v == null) return "";
        if (v instanceof Timestamp ts) return ts.toLocalDateTime().format(TS);
        if (v instanceof Date d) return d.toLocalDate().toString();
        return String.valueOf(v).trim();
    }
}
