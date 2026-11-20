package com.yinjia.mes.service;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 仪器使用汇总表(2026-11-20)—— 实验室内所有仪器的使用记录总表,可筛选、勾选、导出 Excel。
 *
 * <p><b>用户口径</b>:「为当前的试验仪器记录表创建一个汇总表,汇总表需要查看的内容如图1所示。
 * 汇总表实现可以参考样品检验汇总表」。表样列(顺序即纸面顺序):仪器名称/型号 | 日期 | 起止时间 |
 * 仪器状态 | 是否内校 | 项目名称/内容 | 数量 | 使用人 | 备注。
 *
 * <p>2026-11-19 曾在仪器使用记录表面板内加过第 2 页签「使用记录汇总」;2026-11-20 用户口径
 * 「不要这个页签」⇒ 页签撤除,汇总改为**独立页面**(与 {@link InspSummaryService} 同构:
 * 时间区间筛选 + 统计条 + 表格勾选 + 导出 xlsx),两者共用同一份取数口径。
 *
 * <p><b>数据</b>:{@code rd_instr_use_detail} × {@code rd_instr_use_head},一行 = 一条使用记录
 * (不是一张单一行:同一张单可以登记多台仪器/多个项目)。仪器名称优先取明细行上由「一台仪器一组」
 * 写下的 {@code [仪器名称/型号]},为空退回表头同名列;日期优先取明细 {@code [使用日期]},
 * 为空退回表头 {@code [单据日期]}。头/行任一 {@code asp_cancel='Y'} 的记录都不进汇总
 * (与列表页删除口径一致)。
 *
 * <p><b>日期列是 nvarchar</b>(源表按纸样填 {@code yyyy-MM-dd}):排序/过滤用
 * {@code CASE WHEN ISDATE(...) = 1 THEN CONVERT(date, ...) END} 兜底,脏值不参与也不报错;
 * <b>不用 TRY_CONVERT</b> —— 本机 SQL Server 兼容级别不认它(实测消息 195)。
 *
 * <p><b>只读</b>:不落库、不建表、不产生单据;权限闸门在 Controller
 * (页面级虚拟面板 {@link PagePanelRegistry#INSTR_SUMMARY} 的 view / export 词)。
 */
@Service
public class InstrSummaryService {

    /** 单次最多取回的使用记录行(一天最多几十条;上限只防"查全库"把内存和界面拖死) */
    public static final int MAX_ROWS = 5000;
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 用户表样的 9 列(顺序不可随意调:纸面/导出都按这个顺序) */
    public static final String[] COLS = {
            "仪器名称/型号", "日期", "起止时间", "仪器状态", "是否内校",
            "项目名称/内容", "数量", "使用人", "备注",
    };

    private final JdbcTemplate jdbc;

    public InstrSummaryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 汇总取数(只读)。
     *
     * @param body 条件:{@code 日期起} / {@code 日期止}(YYYY-MM-DD,任一端可空 = 不限)、
     *             {@code 仪器名称/型号}(模糊)、{@code 使用人}(模糊)、
     *             {@code keyword}(项目名称/内容、备注、仪器、使用人 任一段模糊)
     * @return {@code {数据时间, 查询条件, 汇总:{记录条数, 涉及仪器, 使用人数, 涉及项目}, 列表:[…], 截断}}
     */
    public Map<String, Object> summary(Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        String from = nz(str(b.get("日期起")));
        String to = nz(str(b.get("日期止")));
        if (!from.isEmpty() && !to.isEmpty() && from.compareTo(to) > 0) {
            String t = from;                       // 传反了不报错:按同一区间查(与查询弹窗的容错一致)
            from = to;
            to = t;
        }
        String instrument = str(b.get("仪器名称/型号"));
        String user = str(b.get("使用人"));
        String keyword = str(b.get("keyword"));

        String instrumentExpr = instrumentExpr();
        String dateExpr = dateExpr();
        StringBuilder sql = new StringBuilder("SELECT TOP ").append(MAX_ROWS).append(" ")
                .append(" d.id AS [记录id],")
                .append(" ").append(instrumentExpr).append(" AS [仪器名称/型号],")
                .append(" ").append(dateTextExpr()).append(" AS [日期],")
                .append(" ISNULL(d.[起止时间], N'') AS [起止时间],")
                .append(" ISNULL(d.[仪器状态], N'') AS [仪器状态],")
                .append(" ISNULL(d.[是否内校], N'') AS [是否内校],")
                .append(" ISNULL(d.[项目名称/内容], N'') AS [项目名称/内容],")
                .append(" ISNULL(d.[样品数量], N'') AS [数量],")
                .append(" ISNULL(d.[使用人], N'') AS [使用人],")
                .append(" ISNULL(d.[备注], N'') AS [备注],")
                .append(" h.[单据编号] AS [单据编号]")
                .append(" FROM dbo.rd_instr_use_detail d")
                .append(" JOIN dbo.rd_instr_use_head h ON h.[单据编号] = d.[单据编号]")
                .append(" WHERE ISNULL(d.asp_cancel, N'N') <> N'Y'")
                .append("   AND ISNULL(h.asp_cancel, N'N') <> N'Y'");

        List<Object> args = new ArrayList<>();
        if (!from.isEmpty()) {
            sql.append("   AND ").append(dateExpr).append(" >= CONVERT(date, ?) ");
            args.add(from);
        }
        if (!to.isEmpty()) {
            sql.append("   AND ").append(dateExpr).append(" <= CONVERT(date, ?) ");
            args.add(to);
        }
        if (instrument != null) {
            sql.append("   AND ").append(instrumentExpr).append(" LIKE ? ");
            args.add("%" + instrument + "%");
        }
        if (user != null) {
            sql.append("   AND ISNULL(d.[使用人], N'') LIKE ? ");
            args.add("%" + user + "%");
        }
        if (keyword != null) {
            String like = "%" + keyword + "%";
            sql.append("   AND (").append(instrumentExpr).append(" LIKE ?")
                    .append(" OR ISNULL(d.[项目名称/内容], N'') LIKE ?")
                    .append(" OR ISNULL(d.[备注], N'') LIKE ?")
                    .append(" OR ISNULL(d.[使用人], N'') LIKE ?)");
            for (int i = 0; i < 4; i++) args.add(like);
        }
        sql.append(" ORDER BY ").append(dateExpr).append(" DESC, d.[使用日期] DESC, d.id DESC");

        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        List<Map<String, Object>> list = new ArrayList<>(rows.size());
        Set<String> instruments = new LinkedHashSet<>();
        Set<String> users = new LinkedHashSet<>();
        Set<String> projects = new LinkedHashSet<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("记录id", r.get("记录id"));
            row.put("单据编号", nz(str(r.get("单据编号"))));
            for (String c : COLS) row.put(c, nz(str(r.get(c))));
            list.add(row);
            addDistinct(instruments, str(r.get("仪器名称/型号")));
            addDistinct(users, str(r.get("使用人")));
            addDistinct(projects, str(r.get("项目名称/内容")));
        }

        Map<String, Object> stat = new LinkedHashMap<>();
        stat.put("记录条数", list.size());
        stat.put("涉及仪器", instruments.size());
        stat.put("使用人数", users.size());
        stat.put("涉及项目", projects.size());

        Map<String, Object> cond = new LinkedHashMap<>();
        cond.put("日期起", from);
        cond.put("日期止", to);
        cond.put("仪器名称/型号", instrument == null ? "" : instrument);
        cond.put("使用人", user == null ? "" : user);
        cond.put("keyword", keyword == null ? "" : keyword);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("数据时间", LocalDateTime.now().format(TS));
        out.put("查询条件", cond);
        out.put("汇总", stat);
        out.put("列表", list);
        // 截断提示:行数到上限 = 还有没取回来的记录,页面要明确告诉用户「缩小时间范围」
        out.put("截断", list.size() >= MAX_ROWS);
        return out;
    }

    /** 导出结果:文件名 + 工作簿字节(Controller 直接落响应头) */
    public record ExportFile(String fileName, byte[] bytes) { }

    /**
     * 导出「实验室仪器使用记录表」(.xlsx,单 sheet)。
     *
     * <p>版式按用户 2026-11-20 给的图:第 1 行是跨 9 列的居中大标题「实验室仪器使用记录表」,
     * 第 2 行是表头(灰底),之后一行 = 一条使用记录;A4 横向、按宽度缩放到一页,
     * 表头冻结 + 自动筛选(方便线下继续整理)。
     *
     * @param body 与 {@link #summary(Map)} 同一套查询条件;
     *             另可带 {@code 记录id: [Long…]} = **只导选中的行**(页面勾选后传,空/缺省 = 全部)
     */
    public ExportFile export(Map<String, Object> body) {
        Map<String, Object> data = summary(body);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) data.getOrDefault("列表", List.of());
        @SuppressWarnings("unchecked")
        Map<String, Object> cond = (Map<String, Object>) data.getOrDefault("查询条件", Map.of());
        Set<Long> picked = pickedIds(body);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            if (picked == null || picked.contains(idOf(r.get("记录id")))) out.add(r);
        }

        try (XSSFWorkbook wb = new XSSFWorkbook(); ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            Sheet sheet = wb.createSheet("仪器使用汇总");
            CellStyle titleStyle = titleStyle(wb);
            CellStyle headStyle = headStyle(wb);
            CellStyle bodyStyle = bodyStyle(wb, false);
            CellStyle wrapStyle = bodyStyle(wb, true);

            // ── 第 1 行:跨 9 列的大标题(用户图样) ──
            Row title = sheet.createRow(0);
            title.setHeightInPoints(30f);
            Cell tc = title.createCell(0);
            tc.setCellValue("实验室仪器使用记录表");
            tc.setCellStyle(titleStyle);
            for (int i = 1; i < COLS.length; i++) title.createCell(i).setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, COLS.length - 1));

            // ── 第 2 行:表头 ──
            Row head = sheet.createRow(1);
            head.setHeightInPoints(22f);
            for (int i = 0; i < COLS.length; i++) {
                Cell c = head.createCell(i);
                c.setCellValue(COLS[i]);
                c.setCellStyle(headStyle);
            }
            int[] widths = {20, 12, 14, 11, 10, 30, 8, 11, 22};
            for (int i = 0; i < widths.length; i++) sheet.setColumnWidth(i, widths[i] * 256);

            int r = 2;
            for (Map<String, Object> row : out) {
                Row x = sheet.createRow(r);
                x.setHeightInPoints(20f);
                for (int i = 0; i < COLS.length; i++) {
                    // 「项目名称/内容」「备注」可能多行:换行样式,行高给够
                    setCell(x, i, strOf(row.get(COLS[i])), isWide(i) ? wrapStyle : bodyStyle);
                }
                r++;
            }
            // 空表也让表头行有下边框:补一行空白(与纸面表样一致,便于直接打印)
            if (out.isEmpty()) {
                Row blank = sheet.createRow(2);
                blank.setHeightInPoints(20f);
                for (int i = 0; i < COLS.length; i++) setCell(blank, i, "", bodyStyle);
                r = 3;
            }

            sheet.createFreezePane(0, 2);
            sheet.setAutoFilter(new CellRangeAddress(1, Math.max(1, r - 1), 0, COLS.length - 1));
            // 纸面版式:A4 横向 + 缩放到 1 页宽(用户图样是一整行 9 列)
            sheet.getPrintSetup().setLandscape(true);
            sheet.getPrintSetup().setPaperSize(org.apache.poi.ss.usermodel.PrintSetup.A4_PAPERSIZE);
            sheet.setFitToPage(true);
            // 「适配 1 页宽」在 POI 里没有 Sheet 级 setFitWidth(接口上只有 setFitToPage),
            // 只能落到 CTWorksheet/CTPageSetup:fitToWidth=1、fitToHeight=0(高度不限)。
            org.openxmlformats.schemas.spreadsheetml.x2006.main.CTWorksheet ct =
                    ((org.apache.poi.xssf.usermodel.XSSFSheet) sheet).getCTWorksheet();
            if (!ct.isSetPageSetup()) ct.addNewPageSetup();
            ct.getPageSetup().setFitToWidth(1);
            ct.getPageSetup().setFitToHeight(0);

            wb.write(bos);
            String from = compactDate(strOf(cond.get("日期起")));
            String to = compactDate(strOf(cond.get("日期止")));
            String range = from.isEmpty() && to.isEmpty() ? "全部"
                    : (from.isEmpty() ? "" : from) + (to.isEmpty() || to.equals(from) ? "" : "-" + to);
            String fileName = "实验室仪器使用记录表_" + range + ".xlsx";
            return new ExportFile(fileName, bos.toByteArray());
        } catch (IOException e) {
            throw new IllegalStateException("生成实验室仪器使用记录表失败:" + e.getMessage(), e);
        }
    }

    /** 「仪器名称/型号」列:明细优先(「一台仪器一组」写在这里),为空退回表头同名列 */
    private static String instrumentExpr() {
        return "ISNULL(NULLIF(LTRIM(RTRIM(d.[仪器名称/型号])), N''), ISNULL(h.[仪器名称/型号], N''))";
    }

    /** 日期原值:明细使用日期优先,为空退回表头单据日期(仍是 nvarchar) */
    private static String rawDateExpr() {
        return "ISNULL(NULLIF(LTRIM(RTRIM(d.[使用日期])), N''), ISNULL(h.[单据日期], N''))";
    }

    /** 日期比较用表达式:脏值(非日期字符串)返回 NULL,不参与过滤/排序也不报错 */
    private static String dateExpr() {
        String raw = rawDateExpr();
        return "CASE WHEN ISDATE(" + raw + ") = 1 THEN CONVERT(date, " + raw + ") END";
    }

    /** 日期显示值:能解析成日期的统一给 yyyy-MM-dd(去掉可能带的时间部分),否则原样 */
    private static String dateTextExpr() {
        String raw = rawDateExpr();
        return "CASE WHEN ISDATE(" + raw + ") = 1 THEN CONVERT(varchar(10), CONVERT(date, " + raw + "), 23)"
                + " ELSE " + raw + " END";
    }

    private static void addDistinct(Set<String> set, String v) {
        String s = v == null ? "" : v.trim();
        if (!s.isEmpty()) set.add(s);
    }

    /** 只导勾选行:body 里的 {@code 记录id} 支持数组 / 逗号串 / 单值;缺省或空 = 不过滤 */
    private static Set<Long> pickedIds(Map<String, Object> body) {
        if (body == null) return null;
        Object v = body.get("记录id");
        if (v == null) return null;
        Set<Long> ids = new LinkedHashSet<>();
        if (v instanceof Iterable<?> it) {
            for (Object o : it) {
                Long id = parseId(o);
                if (id != null) ids.add(id);
            }
        } else {
            for (String part : String.valueOf(v).split("[,，\\s]+")) {
                Long id = parseId(part);
                if (id != null) ids.add(id);
            }
        }
        return ids.isEmpty() ? null : ids;
    }

    private static Long parseId(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static long idOf(Object v) {
        Long id = parseId(v);
        return id == null ? -1L : id;
    }

    /** 需要换行样式的列:项目名称/内容(5)、备注(8) */
    private static boolean isWide(int col) {
        return col == 5 || col == 8;
    }

    private static void setCell(Row row, int col, String value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value == null ? "" : value);
        c.setCellStyle(style);
    }

    /** 大标题:16pt 加粗、居中、无边框(用户图样是一条跨列标题) */
    private static CellStyle titleStyle(XSSFWorkbook wb) {
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 16);
        f.setFontName("宋体");
        CellStyle s = wb.createCellStyle();
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }

    /** 表头:加粗、浅灰底、居中、细边框(与用户纸表截图同款) */
    private static CellStyle headStyle(XSSFWorkbook wb) {
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

    /** 正文:细边框、垂直居中;wrap=true 用于「项目名称/内容/备注」这种可能多行的长文本 */
    private static CellStyle bodyStyle(XSSFWorkbook wb, boolean wrap) {
        Font f = wb.createFont();
        f.setFontHeightInPoints((short) 11);
        f.setFontName("宋体");
        CellStyle s = wb.createCellStyle();
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.LEFT);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
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

    /** 2026-11-01 → 20261101(文件名用) */
    private static String compactDate(String s) {
        return s == null ? "" : s.replace("-", "").trim();
    }

    private static String strOf(Object v) {
        return v == null ? "" : String.valueOf(v).trim();
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v);
        return s.isBlank() ? null : s.trim();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
