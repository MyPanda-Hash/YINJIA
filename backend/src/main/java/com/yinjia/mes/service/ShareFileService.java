package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 共享文件库(研发管理·全公司共享资料):标准/测试报告/认证报告等。
 * 1 行 yj_share_file = 1 份文件,文件本体复用 yj_attachment(锚点=面板+文件编号+「文件」列)。
 * 分类树 yj_share_file_cat 可自行增减(有文件或子分类时禁删)。
 * 权限:上传/修改=面板 add|edit 词,删除=add|edit|delete 词(管理员恒过),
 * 其余角色仅查阅(view,query,由迁移种子默认授予全部角色)——不走审批流。
 */
@Service
public class ShareFileService {

    public static final String PANEL = "RD_SHARE_FILE";
    private static final String FIELD_KEY = "文件";

    private final JdbcTemplate jdbc;
    private final AttachmentService attachments;
    private final PanelPermissionService perms;

    public ShareFileService(JdbcTemplate jdbc, AttachmentService attachments, PanelPermissionService perms) {
        this.jdbc = jdbc;
        this.attachments = attachments;
        this.perms = perms;
    }

    /** 前端按钮门禁:能否上传/改(含分类维护)、能否删除。管理员恒真。 */
    public Map<String, Object> permOfCurrentUser() {
        Map<String, Object> out = new LinkedHashMap<>();
        boolean canUpload = perms.hasAnyPerm(PANEL, "add", "edit");
        out.put("canUpload", canUpload);
        out.put("canMaintain", canUpload);
        out.put("canDelete", perms.hasAnyPerm(PANEL, "add", "edit", "delete"));
        return out;
    }

    // ══════════ 分类树 ══════════

    /** 全量分类(平铺含父子与含子孙文件数,前端组树;分类量小全量下发)。 */
    public List<Map<String, Object>> categories() {
        List<Map<String, Object>> cats = jdbc.queryForList(
                "SELECT id, parent_id AS parentId, cat_name AS name, seq FROM yj_share_file_cat ORDER BY seq, id");
        Map<Integer, Integer> direct = new HashMap<>();
        jdbc.query("SELECT [分类], COUNT(*) FROM yj_share_file GROUP BY [分类]", rs -> {
            direct.put(rs.getInt(1), rs.getInt(2));
        });
        Map<Integer, List<Integer>> children = new HashMap<>();
        for (Map<String, Object> c : cats) {
            Object pid = c.get("parentId");
            children.computeIfAbsent(pid == null ? null : (Integer) pid, k -> new ArrayList<>())
                    .add((Integer) c.get("id"));
        }
        Map<Integer, Integer> inclusive = new HashMap<>();
        for (Map<String, Object> c : cats) inclusive.put((Integer) c.get("id"), 0);
        for (Map<String, Object> c : cats) {
            int self = (Integer) c.get("id");
            int sum = direct.getOrDefault(self, 0);
            Set<Integer> seen = new HashSet<>();
            List<Integer> stack = new ArrayList<>(children.getOrDefault(self, List.of()));
            while (!stack.isEmpty()) {
                int cur = stack.remove(stack.size() - 1);
                if (!seen.add(cur)) continue;
                sum += direct.getOrDefault(cur, 0);
                stack.addAll(children.getOrDefault(cur, List.of()));
            }
            inclusive.put(self, sum);
        }
        for (Map<String, Object> c : cats) {
            int id = (Integer) c.get("id");
            c.put("count", inclusive.getOrDefault(id, 0));
        }
        return cats;
    }

    /** 新增分类(空表种子由迁移负责,这里只做用户级新增)。 */
    public void addCategory(Integer parentId, String name, Integer seq, String user) {
        String n = requireName(name);
        if (parentId != null) requireCat(parentId);
        jdbc.update("INSERT INTO yj_share_file_cat (parent_id, cat_name, seq, asp_user1, asp_time1) VALUES (?,?,?,?,SYSDATETIME())",
                parentId, n, seq == null ? 0 : seq, user);
    }

    /** 改名/排序/移动父级(防自环:新父级不得是自己或自己的子孙)。 */
    public void updateCategory(int id, Integer parentId, String name, Integer seq, String user) {
        requireCat(id);
        String n = requireName(name);
        if (parentId != null) {
            if (parentId == id) throw new IllegalArgumentException("上级分类不能是自己");
            int cur = parentId;
            Set<Integer> seen = new HashSet<>();
            while (cur != 0) {
                if (!seen.add(cur)) throw new IllegalArgumentException("分类层级成环,数据异常");
                if (cur == id) throw new IllegalArgumentException("上级分类不能是自己的子分类");
                Integer parent = jdbc.queryForObject(
                        "SELECT parent_id FROM yj_share_file_cat WHERE id=?", Integer.class, cur);
                cur = parent == null ? 0 : parent;
            }
            requireCat(parentId);
        }
        jdbc.update("UPDATE yj_share_file_cat SET parent_id=?, cat_name=?, seq=?, asp_user2=?, asp_time2=SYSDATETIME() WHERE id=?",
                parentId, n, seq == null ? 0 : seq, user, id);
    }

    /** 删除分类:仅叶子且其下无文件时可删。 */
    public void deleteCategory(int id) {
        requireCat(id);
        Integer childs = jdbc.queryForObject("SELECT COUNT(*) FROM yj_share_file_cat WHERE parent_id=?", Integer.class, id);
        if (childs != null && childs > 0) throw new IllegalArgumentException("该分类下还有子分类,请先删除或移走子分类");
        Integer files = jdbc.queryForObject("SELECT COUNT(*) FROM yj_share_file WHERE [分类]=?", Integer.class, id);
        if (files != null && files > 0) throw new IllegalArgumentException("该分类下还有文件,请先删除或移走文件");
        jdbc.update("DELETE FROM yj_share_file_cat WHERE id=?", id);
    }

    // ══════════ 文件列表 ══════════

    /**
     * 分页列表:catId 过滤含子孙;keyword 匹配 文件名称/关键词/备注/文件名列。
     * 返回 {total, rows[]},行内含附件 id/文件名/大小/类型(前端预览下载走 /api/attachment/{id}/download)。
     */
    public Map<String, Object> list(Integer catId, String keyword, int pageNo, int pageSize) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (catId != null) {
            Set<Integer> ids = descendantCats(catId);
            where.append(" AND f.[分类] IN (").append(joinInts(ids)).append(')');
        }
        String kw = keyword == null ? "" : keyword.trim();
        if (!kw.isEmpty()) {
            where.append(" AND (f.[文件名称] LIKE ? OR f.[关键词] LIKE ? OR f.[备注] LIKE ? OR f.[文件] LIKE ?)");
            String like = "%" + kw + "%";
            for (int i = 0; i < 4; i++) args.add(like);
        }
        Integer total = jdbc.queryForObject("SELECT COUNT(*) FROM yj_share_file f" + where, Integer.class, args.toArray());
        int size = Math.min(Math.max(pageSize, 1), 100);
        int offset = Math.max(pageNo - 1, 0) * size;
        Object[] qArgs = new Object[args.size() + 2];
        for (int i = 0; i < args.size(); i++) qArgs[i] = args.get(i);
        qArgs[args.size()] = offset;
        qArgs[args.size() + 1] = size;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT f.id, f.[文件编号] AS no, f.[分类] AS catId, f.[文件名称] AS name, f.[版本号] AS version,"
                        + " f.[生效日期] AS effectiveDate, f.[失效日期] AS expiryDate, f.[关键词] AS keywords,"
                        + " f.[备注] AS remark, f.[上传人] AS uploader, CONVERT(varchar(19), f.[上传时间], 120) AS uploadTime,"
                        + " a.id AS attachmentId, a.file_name AS fileName, a.file_size AS fileSize, a.content_type AS contentType"
                        + " FROM yj_share_file f LEFT JOIN yj_attachment a"
                        + " ON a.panel_code='" + PANEL + "' AND a.doc_no=f.[文件编号] AND a.field_key=N'" + FIELD_KEY + "'"
                        + where + " ORDER BY f.id DESC OFFSET ? ROWS FETCH NEXT ? ROWS ONLY",
                qArgs);
        Map<Integer, String> paths = catPaths();
        for (Map<String, Object> r : rows) r.put("catPath", paths.get((Integer) r.get("catId")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total == null ? 0 : total);
        out.put("rows", rows);
        return out;
    }

    // ══════════ 上传/改/删 ══════════

    /** 上传:建记录(文件编号=SF+id 补零)→ 附件入库(失败清记录);1 记录 1 文件。 */
    public Map<String, Object> upload(Integer catId, String name, String version, String effectiveDate,
                                      String expiryDate, String keywords, String remark,
                                      MultipartFile file, String user) throws IOException {
        requireCat(catId);
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("请选择要上传的文件");
        String displayName = name == null || name.isBlank()
                ? stripExt(safePart(file.getOriginalFilename())) : name.trim();
        if (displayName.isEmpty()) throw new IllegalArgumentException("文件名称无效");
        // 占位编号 Java 侧生成(唯一,≤20 字符与列宽对齐),插入后按它精确回查 id 再改为 SF 序号——免并发歧义
        String placeholder = "TMP#" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 15);
        jdbc.update("INSERT INTO yj_share_file ([文件编号], [分类], [文件名称], [版本号], [生效日期], [失效日期],"
                        + " [关键词], [备注], [上传人], [上传时间], asp_user1, asp_time1)"
                        + " VALUES (?,?,?,?,?,?,?,?,?,SYSDATETIME(),?,SYSDATETIME())",
                placeholder, catId, displayName, trim(version), trim(effectiveDate), trim(expiryDate),
                trim(keywords), trim(remark), user, user);
        Integer id = jdbc.queryForObject("SELECT id FROM yj_share_file WHERE [文件编号]=?", Integer.class, placeholder);
        String docNo = "SF" + String.format("%05d", id);
        try {
            jdbc.update("UPDATE yj_share_file SET [文件编号]=? WHERE id=?", docNo, id);
            attachments.upload(PANEL, docNo, FIELD_KEY, file, user);
        } catch (Exception e) {
            jdbc.update("DELETE FROM yj_share_file WHERE id=?", id);
            throw e instanceof RuntimeException re ? re : new IllegalStateException("文件保存失败:" + e.getMessage(), e);
        }
        return rowOf(id);
    }

    /** 改元数据(不动文件本体)。 */
    public Map<String, Object> update(long id, Integer catId, String name, String version,
                                      String effectiveDate, String expiryDate, String keywords,
                                      String remark, String user) {
        requireRow(id);
        requireCat(catId);
        if (name == null || name.isBlank()) throw new IllegalArgumentException("文件名称不能为空");
        jdbc.update("UPDATE yj_share_file SET [分类]=?, [文件名称]=?, [版本号]=?, [生效日期]=?, [失效日期]=?,"
                        + " [关键词]=?, [备注]=?, asp_user2=?, asp_time2=SYSDATETIME() WHERE id=?",
                catId, name.trim(), trim(version), trim(effectiveDate), trim(expiryDate),
                trim(keywords), trim(remark), user, id);
        return rowOf(id);
    }

    /** 换文件:删旧附件(锚点下全部)→ 传新附件。 */
    public Map<String, Object> replaceFile(long id, MultipartFile file, String user) throws IOException {
        requireRow(id);
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("请选择要替换的文件");
        String docNo = docNoOf(id);
        for (long aid : attachmentIds(docNo)) attachments.delete(aid, user);
        attachments.upload(PANEL, docNo, FIELD_KEY, file, user);
        return rowOf(id);
    }

    /** 删除记录:先删附件(磁盘+行),再删记录。 */
    public void delete(long id, String user) throws IOException {
        requireRow(id);
        String docNo = docNoOf(id);
        for (long aid : attachmentIds(docNo)) attachments.delete(aid, user);
        jdbc.update("DELETE FROM yj_share_file WHERE id=?", id);
    }

    // ══════════ 内部工具 ══════════

    private Map<String, Object> rowOf(long id) {
        return jdbc.queryForMap("SELECT id, [文件编号] AS no FROM yj_share_file WHERE id=?", id);
    }

    private String docNoOf(long id) {
        return jdbc.queryForObject("SELECT [文件编号] FROM yj_share_file WHERE id=?", String.class, id);
    }

    private List<Long> attachmentIds(String docNo) {
        return jdbc.queryForList("SELECT id FROM yj_attachment WHERE panel_code=? AND doc_no=? AND field_key=N'"
                + FIELD_KEY + "'", Long.class, PANEL, docNo);
    }

    private void requireRow(long id) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM yj_share_file WHERE id=?", Integer.class, id);
        if (n == null || n == 0) throw new IllegalArgumentException("文件记录不存在(可能已被删除)");
    }

    private void requireCat(Integer id) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM yj_share_file_cat WHERE id=?", Integer.class, id);
        if (n == null || n == 0) throw new IllegalArgumentException("分类不存在(可能已被删除)");
    }

    private static String requireName(String name) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("分类名称不能为空");
        String n = name.trim();
        if (n.length() > 100) throw new IllegalArgumentException("分类名称超长(≤100)");
        return n;
    }

    /** 分类自身+全部子孙 id 集(点父分类看到所有子孙文件)。 */
    private Set<Integer> descendantCats(int root) {
        List<Map<String, Object>> cats = jdbc.queryForList("SELECT id, parent_id FROM yj_share_file_cat");
        Map<Integer, List<Integer>> children = new HashMap<>();
        for (Map<String, Object> c : cats) {
            Object pid = c.get("parent_id");
            children.computeIfAbsent(pid == null ? null : (Integer) pid, k -> new ArrayList<>())
                    .add((Integer) c.get("id"));
        }
        Set<Integer> out = new HashSet<>();
        List<Integer> stack = new ArrayList<>(List.of(root));
        while (!stack.isEmpty()) {
            int cur = stack.remove(stack.size() - 1);
            if (!out.add(cur)) continue;
            stack.addAll(children.getOrDefault(cur, List.of()));
        }
        return out;
    }

    /** 分类全路径(id → "标准/国标行标" 形式),列表展示用。 */
    private Map<Integer, String> catPaths() {
        List<Map<String, Object>> cats = jdbc.queryForList("SELECT id, parent_id, cat_name FROM yj_share_file_cat");
        Map<Integer, String> names = new HashMap<>();
        Map<Integer, Integer> parent = new HashMap<>();
        for (Map<String, Object> c : cats) {
            int id = (Integer) c.get("id");
            names.put(id, String.valueOf(c.get("cat_name")));
            Object p = c.get("parent_id");
            if (p != null) parent.put(id, (Integer) p);
        }
        Map<Integer, String> out = new HashMap<>();
        for (Integer id : names.keySet()) {
            List<String> segs = new ArrayList<>();
            Set<Integer> seen = new HashSet<>();
            int cur = id;
            while (cur != 0 && seen.add(cur)) {
                segs.add(0, names.get(cur));
                cur = parent.getOrDefault(cur, 0);
            }
            out.put(id, String.join("/", segs));
        }
        return out;
    }

    private static String joinInts(Set<Integer> ids) {
        StringBuilder sb = new StringBuilder();
        for (int i : ids) {
            if (sb.length() > 0) sb.append(',');
            sb.append(i);
        }
        return sb.length() == 0 ? "0" : sb.toString();
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }

    private static String safePart(String raw) {
        String name = raw == null ? "" : raw.replace("\\", "/");
        int slash = name.lastIndexOf('/');
        return slash >= 0 ? name.substring(slash + 1) : name;
    }

    private static String stripExt(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
