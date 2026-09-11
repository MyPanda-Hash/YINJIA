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

    /** 下载/查看:按 id 取元数据与文件(路径仅由服务端生成的存储名解析)。 */
    public Map<String, Object> loadForDownload(long id) {
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT file_name AS fileName, stored_name AS storedName, "
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

    /** 同步头字段列 = 原文件名列表(、分隔)。头表/单号列取自 yj_panel,
     *  字段键必须是该面板在 yj_field 注册过的列名(防动态列名注入),未注册则只存附件不同步。 */
    private void syncHeadField(String panelCode, String docNo, String fieldKey, String username) {
        String joined = joinedNames(panelCode, docNo, fieldKey);
        Map<String, Object> panel = jdbc.queryForMap(
                "SELECT head_table, group_col FROM yj_panel WHERE panel_code=?", panelCode);
        String headTable = str(panel.get("head_table"));
        String groupCol = str(panel.get("group_col"));
        if (headTable.isBlank() || groupCol.isBlank()) return;
        Integer registered = jdbc.queryForObject(
                "SELECT COUNT(*) FROM yj_field WHERE panel_code=? AND col_name=?", Integer.class, panelCode, fieldKey);
        if (registered == null || registered == 0) return;
        jdbc.update("UPDATE [" + headTable + "] SET [" + fieldKey + "]=?, asp_user2=?, asp_time2=SYSDATETIME() "
                + "WHERE [" + groupCol + "]=?", joined, username, docNo);
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
