package com.yinjia.mes.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 单据头字段附件(yj_attachment):文件本体存磁盘(存储名=UUID+安全扩展,杜绝路径穿越),
 * 元数据入库,原文件名保留展示;上传/删除后把「原文件名列表(、分隔)」同步回头表对应列,
 * 使列表查看/纸张打印/导出 PDF 只见文件名(WYSIWYG 打印即所见)。
 * 附件锚点 = panel_code + doc_no(单据编号)+ field_key(字段中文键=头表列名),
 * 故新建未保存(尚无单据编号)的单据不能上传,由前端拦截提示。
 */
@Service
public class AttachmentService {

    /** 头字段列同步值上限(与既有头表 nvarchar(500) 列宽对齐)。 */
    private static final int SYNC_VALUE_MAX = 500;
    private static final int FILE_NAME_MAX = 260;

    private final JdbcTemplate jdbc;
    private final Path dir;
    private final long maxBytes;

    public AttachmentService(JdbcTemplate jdbc,
                             @Value("${yinjia.attachment.dir:uploads/attachments}") String dir,
                             @Value("${yinjia.attachment.max-size-mb:20}") int maxSizeMb) {
        this.jdbc = jdbc;
        this.dir = Paths.get(dir).toAbsolutePath().normalize();
        this.maxBytes = (long) maxSizeMb * 1024 * 1024;
    }

    /** 上传一个附件:校验 → 存盘 → 入库 → 同步头字段;返回该字段全部附件与文件名串。 */
    public Map<String, Object> upload(String panelCode, String docNo, String fieldKey,
                                      MultipartFile file, String username) throws IOException {
        requireAnchor(panelCode, docNo, fieldKey);
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("请选择要上传的文件");
        if (file.getSize() > maxBytes)
            throw new IllegalArgumentException("附件不能超过 " + (maxBytes / 1024 / 1024) + "MB");
        String fileName = sanitizeFileName(file.getOriginalFilename());
        String stored = UUID.randomUUID().toString().replace("-", "") + safeExt(fileName);
        Files.createDirectories(dir);
        Path target = resolveStored(stored);
        file.transferTo(target.toFile());
        jdbc.update("INSERT INTO yj_attachment (panel_code, doc_no, field_key, file_name, stored_name, "
                        + "file_size, content_type, asp_user1, asp_time1) VALUES (?,?,?,?,?,?,?,?,SYSDATETIME())",
                panelCode, docNo, fieldKey, fileName, stored, file.getSize(),
                trimTo(file.getContentType(), 200), username);
        syncHeadField(panelCode, docNo, fieldKey, username);
        return payload(panelCode, docNo, fieldKey);
    }

    /** 某字段的全部附件(原文件名/大小/类型/上传人/上传时间)。 */
    public List<Map<String, Object>> list(String panelCode, String docNo, String fieldKey) {
        requireAnchor(panelCode, docNo, fieldKey);
        return jdbc.queryForList("SELECT id, file_name AS fileName, file_size AS fileSize, "
                        + "content_type AS contentType, asp_user1 AS uploader, "
                        + "CONVERT(varchar(19), asp_time1, 120) AS uploadTime "
                        + "FROM yj_attachment WHERE panel_code=? AND doc_no=? AND field_key=? ORDER BY id",
                panelCode, docNo, fieldKey);
    }

    /** 删除附件(硬删行+磁盘文件),随后重新同步头字段。 */
    public Map<String, Object> delete(long id, String username) throws IOException {
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT panel_code, doc_no, field_key, stored_name FROM yj_attachment WHERE id=?", id);
        String panelCode = String.valueOf(row.get("panel_code"));
        String docNo = String.valueOf(row.get("doc_no"));
        String fieldKey = String.valueOf(row.get("field_key"));
        jdbc.update("DELETE FROM yj_attachment WHERE id=?", id);
        Files.deleteIfExists(resolveStored(String.valueOf(row.get("stored_name"))));
        syncHeadField(panelCode, docNo, fieldKey, username);
        return payload(panelCode, docNo, fieldKey);
    }

    /** 下载/查看:按 id 取元数据与文件(路径仅由服务端生成的存储名解析)。
     *  一并回传 panel_code —— 调用方据此做「有没有该面板查看权」的闸门
     *  (用户口径 2026-10-16:「有查看这个面板权限的人就可以查看上传的附件」)。 */
    public Map<String, Object> loadForDownload(long id) {
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT panel_code AS panelCode, file_name AS fileName, stored_name AS storedName, "
                        + "content_type AS contentType FROM yj_attachment WHERE id=?", id);
        Path path = resolveStored(String.valueOf(row.get("storedName")));
        if (!Files.isReadable(path)) throw new IllegalArgumentException("附件文件不存在或已被删除");
        row.put("path", path);
        return row;
    }

    /** 前端载荷:附件列表 + 文件名串(、分隔,与头字段列同步值一致)。 */
    private Map<String, Object> payload(String panelCode, String docNo, String fieldKey) {
        List<Map<String, Object>> files = list(panelCode, docNo, fieldKey);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("files", files);
        out.put("names", joinedNames(panelCode, docNo, fieldKey));
        return out;
    }

    /**
     * 同步字段列 = 原文件名列表(、分隔)。头表/明细表与单号列取自 yj_panel,
     * 字段键必须是该面板在 yj_field 注册过的列名(防动态列名注入),未注册则只存附件不同步。
     *
     * <p><b>明细行附件(2026-11-09)</b>:用户口径「附件…加在明细字段内,就是表格里面,每一行都有可能要拍照保存」
     * ⇒ 三张实验室记录表的「手机照片」从表头下移到明细行,锚点键写成
     * {@code 手机照片-<明细行 id>}(见 tools/migrate-lab-mobile-row-photo-20261109.sql)。
     * 本方法据此分流:
     * <ul>
     *   <li>键里带 {@code -<数字>} 后缀、且去掉后缀的**基础字段**在 yj_field 登记为明细字段
     *       ({@code place} 含 {@code detail}) ⇒ 只更新那一行({@code WHERE id=? AND 单据编号=?});</li>
     *   <li>其余情况一律走原来的**头表**更新,既有面板(采购订单 附件1..6 等)行为一字不动。</li>
     * </ul>
     * 面板在 yj_panel 里查不到(页面级虚拟面板,如 PROC_FLOW_CARD)= 只存附件不同步。
     */
    private void syncHeadField(String panelCode, String docNo, String fieldKey, String username) {
        String joined = joinedNames(panelCode, docNo, fieldKey);
        List<Map<String, Object>> panels = jdbc.queryForList(
                "SELECT head_table, line_table, group_col, pk_col FROM yj_panel WHERE panel_code=?", panelCode);
        if (panels.isEmpty()) return;
        Map<String, Object> panel = panels.get(0);
        String groupCol = str(panel.get("group_col"));
        if (groupCol.isBlank()) return;

        // ① 字段键 → (基础字段, 明细行 id)。后缀只认「-数字」;整键已登记时不动它。
        String baseKey = fieldKey;
        String rowId = null;
        if (registeredField(panelCode, fieldKey).isEmpty()) {
            int dash = fieldKey.lastIndexOf('-');
            if (dash > 0 && dash < fieldKey.length() - 1
                    && fieldKey.substring(dash + 1).matches("\\d{1,10}")) {
                String base = fieldKey.substring(0, dash);
                if (!registeredField(panelCode, base).isEmpty()) {
                    baseKey = base;
                    rowId = fieldKey.substring(dash + 1);
                }
            }
        }
        Map<String, Object> field = registeredField(panelCode, baseKey);
        String place = str(field.get("place"));

        // ② 明细行附件:只更新该行(行 id 是锚点的一部分,换行/加行都不会串行)
        if (rowId != null && place.contains("detail")) {
            String lineTable = str(panel.get("line_table"));
            String pkCol = str(panel.get("pk_col"));
            if (lineTable.isBlank() || pkCol.isBlank()) return;
            if (!lineTableCols(lineTable).contains(baseKey)) return;
            jdbc.update("UPDATE [" + lineTable + "] SET [" + baseKey + "]=?, asp_user2=?, asp_time2=SYSDATETIME() "
                            + "WHERE [" + pkCol + "]=? AND [" + groupCol + "]=?",
                    joined, username, Long.valueOf(rowId), docNo);
            return;
        }

        // ③ 表头附件(原逻辑,一字未动)
        String headTable = str(panel.get("head_table"));
        if (headTable.isBlank() || field.isEmpty()) return;
        jdbc.update("UPDATE [" + headTable + "] SET [" + baseKey + "]=?, asp_user2=?, asp_time2=SYSDATETIME() "
                + "WHERE [" + groupCol + "]=?", joined, username, docNo);
    }

    /** 该面板在 yj_field 登记过这个列名吗(返回 place/data_type,未登记 = 空 Map)。
     *  列名走参数绑定,拼接只用于已登记过的列名 —— 防动态列名注入。 */
    private Map<String, Object> registeredField(String panelCode, String colName) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT place, data_type, ref_panel FROM yj_field WHERE panel_code=? AND col_name=?",
                panelCode, colName);
        return rows.isEmpty() ? Map.of() : rows.get(0);
    }

    /** 表里的物理列名(只用于校验"登记的字段真有这一列",避免 UPDATE 撞不存在的列)。 */
    private Set<String> lineTableCols(String table) {
        try {
            return new java.util.HashSet<>(jdbc.queryForList(
                    "SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID(?)", String.class, "dbo." + table));
        } catch (Exception e) {
            return Set.of();
        }
    }

    private String joinedNames(String panelCode, String docNo, String fieldKey) {
        List<String> names = jdbc.queryForList(
                "SELECT file_name FROM yj_attachment WHERE panel_code=? AND doc_no=? AND field_key=? ORDER BY id",
                String.class, panelCode, docNo, fieldKey);
        String joined = String.join("、", names);
        return joined.length() > SYNC_VALUE_MAX ? joined.substring(0, SYNC_VALUE_MAX) : joined;
    }

    private void requireAnchor(String panelCode, String docNo, String fieldKey) {
        if (isBlank(panelCode) || isBlank(docNo) || isBlank(fieldKey))
            throw new IllegalArgumentException("附件参数不完整(panelCode/docNo/field)");
        if (docNo.trim().length() > 60) throw new IllegalArgumentException("单据编号超长");
        if (fieldKey.trim().length() > 100) throw new IllegalArgumentException("字段键超长");
    }

    /** 原始文件名净化:去路径段、去控制符、限长;空名拒绝。 */
    private String sanitizeFileName(String raw) {
        String name = raw == null ? "" : raw.replace("\\", "/");
        int slash = name.lastIndexOf('/');
        if (slash >= 0) name = name.substring(slash + 1);
        name = name.replaceAll("[\\r\\n\\t\\u0000]", "").trim();
        if (name.isBlank()) throw new IllegalArgumentException("文件名无效");
        if (name.length() > FILE_NAME_MAX) {
            String ext = safeExt(name);
            name = name.substring(0, FILE_NAME_MAX - ext.length()) + ext;
        }
        return name;
    }

    /** 安全扩展名:原文件名末段为 1..12 位字母数字时保留(.小写),否则不带扩展。 */
    private String safeExt(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot < 0 || dot == fileName.length() - 1) return "";
        String ext = fileName.substring(dot + 1);
        return ext.matches("[A-Za-z0-9]{1,12}") ? "." + ext.toLowerCase() : "";
    }

    /** 存储名只由服务端生成(UUID+安全扩展);解析后必须仍位于附件目录内(双保险)。 */
    private Path resolveStored(String storedName) {
        Path p = dir.resolve(storedName).normalize();
        if (!p.startsWith(dir)) throw new IllegalArgumentException("附件路径非法");
        return p;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trimTo(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }
}
