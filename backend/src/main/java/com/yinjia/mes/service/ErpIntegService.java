package com.yinjia.mes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ERP 集成配置服务(2026-10-18,用户口径:「erp 集成配置清单,分为导入与转出两种面板,
 * 每个面板再分类,把 api 接口、对应的设备、字段间的映射,做成一个可视化、可以统一配置编辑的面板」)。
 *
 * <p>数据落在三张配置表(见 {@code tools/migrate-erp-integ-config-20261018.sql}):
 * <ul>
 *   <li>{@code erp_integ_api} —— 接口清单:方向(导入/转出)+ 分类(基础资料/单据/设备)+ 接口地址 +
 *       对应 MES 面板 + 启用/排序;</li>
 *   <li>{@code erp_integ_field} —— 字段映射:一行 = 一个 MES 字段/常量 → 金蝶接口字段,带映射层级
 *       (表头/明细/档案)、转换规则、是否必填;</li>
 *   <li>{@code erp_integ_device} —— 设备绑定:接口 × 设备(设备编码取 {@code bs_equip}),带用途。</li>
 * </ul>
 *
 * <p>⚠ 口径(与 KingdeePushService 的分工):本服务**只维护配置**,不推送任何单据、不改任何业务表。
 * 转出侧种子里的接口地址与字段名是照 {@code KingdeePushService} 现役代码实录的(可核对),
 * 金蝶侧未开通/未实测的接口一律 启用=0 并在说明里写清原因 —— 配置界面不假装那些接口能用。
 */
@Service
public class ErpIntegService {

    public static final String DIR_IMPORT = "导入";
    public static final String DIR_EXPORT = "转出";

    /** 分类词表(两向共用;前端「分类」列按它分组) */
    public static final List<String> CATEGORIES = List.of("基础资料", "单据", "设备");

    /**
     * 转换规则词表 —— 与 {@code KingdeePushService} 里实际发生的処理对齐:
     * 直传 / 常量 / 档案解析(按金蝶档案换 *id) / 日期格式化 / 数值转字符串(proto 校验) / 查重。
     */
    public static final List<String> TRANSFORMS = List.of(
            "直传", "常量", "档案解析", "日期格式化", "数值转字符串", "查重");

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;

    public ErpIntegService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 全量配置:接口 + 其字段映射 + 其设备绑定(界面左侧树/中间列表/右侧面板一屏装下) */
    public Map<String, Object> config() {
        List<Map<String, Object>> items = jdbc.queryForList(
                "SELECT [接口编码], [方向], [分类], [接口名称], [提供方], [接口地址], [请求方式],"
                        + " [对应面板], [目标对象], [触发方式], [启用], [排序], [说明]"
                        + "  FROM erp_integ_api WHERE ISNULL(asp_cancel, N'N') <> N'Y'"
                        + " ORDER BY CASE [方向] WHEN N'导入' THEN 0 ELSE 1 END, [分类], [排序], [接口编码]");

        Map<String, List<Map<String, Object>>> fields = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT [id], [接口编码], [序号], [映射层级], [MES字段], [ERP字段], [转换规则],"
                        + " [是否必填], [启用], [备注]"
                        + "  FROM erp_integ_field WHERE ISNULL(asp_cancel, N'N') <> N'Y'"
                        + " ORDER BY [接口编码], [序号], [id]")) {
            fields.computeIfAbsent(str(r.get("接口编码")), k -> new ArrayList<>()).add(r);
        }

        Map<String, List<Map<String, Object>>> devices = new LinkedHashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "SELECT [id], [接口编码], [设备编码], [设备名称], [设备用途], [备注],"
                        + "        ISNULL((SELECT TOP 1 CAST(ISNULL(停用,0) AS int) FROM bs_equip e"
                        + "                 WHERE e.设备编码 = d.设备编码), 0) AS [停用]"
                        + "  FROM erp_integ_device d WHERE ISNULL(d.asp_cancel, N'N') <> N'Y'"
                        + " ORDER BY [接口编码], [设备编码]")) {
            devices.computeIfAbsent(str(r.get("接口编码")), k -> new ArrayList<>()).add(r);
        }

        for (Map<String, Object> it : items) {
            String code = str(it.get("接口编码"));
            it.put("fields", fields.getOrDefault(code, List.of()));
            it.put("devices", devices.getOrDefault(code, List.of()));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("categories", CATEGORIES);
        out.put("transforms", TRANSFORMS);
        out.put("stats", stats(items));
        return out;
    }

    /** 顶部统计(界面抬头「N 个接口 / 已启用 M / K 条映射 / D 台设备」) */
    private Map<String, Object> stats(List<Map<String, Object>> items) {
        int enabled = 0, fields = 0, devices = 0;
        for (Map<String, Object> it : items) {
            if (isTrue(it.get("启用"))) enabled++;
            fields += ((List<?>) it.getOrDefault("fields", List.of())).size();
            devices += ((List<?>) it.getOrDefault("devices", List.of())).size();
        }
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("接口数", items.size());
        s.put("启用数", enabled);
        s.put("字段映射数", fields);
        s.put("设备绑定数", devices);
        return s;
    }

    /** 配置页依赖的元数据:设备档案(去重、未停用)、面板清单、转换规则、分类词 */
    public Map<String, Object> meta() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("devices", jdbc.queryForList(
                "SELECT 设备编码, 设备名称, ISNULL(所属部门, N'') AS 所属部门"
                        + "  FROM (SELECT DISTINCT 设备编码, 设备名称, 所属部门 FROM bs_equip"
                        + "         WHERE ISNULL(asp_cancel, N'N') <> N'Y' AND ISNULL(停用, 0) = 0) t"
                        + " ORDER BY 设备编码"));
        out.put("panels", jdbc.queryForList(
                "SELECT panel_code AS 面板编码, panel_name AS 面板名称, ISNULL(module_group, N'') AS 模块"
                        + "  FROM yj_panel ORDER BY panel_code"));
        out.put("categories", CATEGORIES);
        out.put("transforms", TRANSFORMS);
        return out;
    }

    /** 某个面板的字段清单(界面「MES 字段」下拉按面板带出,与 yj_field 元数据同源) */
    public List<Map<String, Object>> panelFields(String panelCode) {
        if (panelCode == null || panelCode.isBlank()) return List.of();
        return jdbc.queryForList(
                "SELECT [label] AS 字段名, [place] AS 位置, [seq] AS 顺序 FROM yj_field"
                        + " WHERE panel_code = ? AND ISNULL(visible, 1) = 1"
                        + " ORDER BY [seq], [id]", panelCode);
    }

    /** 新增/更新一个接口(按接口编码 upsert;编码是业务键,改名请改编码再存) */
    @Transactional
    public void saveItem(Map<String, Object> body) {
        String code = str(body.get("接口编码"));
        if (code.isEmpty()) throw new IllegalArgumentException("接口编码不能为空");
        String dir = str(body.get("方向"));
        if (!DIR_IMPORT.equals(dir) && !DIR_EXPORT.equals(dir))
            throw new IllegalArgumentException("方向只能是「导入」或「转出」");
        String cat = str(body.get("分类"));
        if (cat.isEmpty()) cat = "单据";
        String name = str(body.get("接口名称"));
        if (name.isEmpty()) throw new IllegalArgumentException("接口名称不能为空");

        String now = LocalDateTime.now().format(FMT);
        String user = currentUser();
        Integer exists = jdbc.queryForObject(
                "SELECT COUNT(*) FROM erp_integ_api WHERE [接口编码] = ?", Integer.class, code);
        Object sort = body.get("排序");
        if (exists != null && exists > 0) {
            jdbc.update("UPDATE erp_integ_api SET [方向] = ?, [分类] = ?, [接口名称] = ?, [提供方] = ?,"
                            + " [接口地址] = ?, [请求方式] = ?, [对应面板] = ?, [目标对象] = ?, [触发方式] = ?,"
                            + " [启用] = ?, [排序] = ?, [说明] = ?, asp_user2 = ?, asp_time2 = ?"
                            + " WHERE [接口编码] = ?",
                    dir, cat, name, str(body.get("提供方")), str(body.get("接口地址")), str(body.get("请求方式")),
                    str(body.get("对应面板")), str(body.get("目标对象")), str(body.get("触发方式")),
                    isTrue(body.get("启用")) ? 1 : 0, toInt(sort, 0), str(body.get("说明")), user, now, code);
        } else {
            Integer maxSeq = jdbc.queryForObject(
                    "SELECT ISNULL(MAX([排序]), 0) FROM erp_integ_api WHERE [方向] = ?", Integer.class, dir);
            int seq = sort == null || str(sort).isEmpty() ? (maxSeq == null ? 0 : maxSeq) + 10 : toInt(sort, 0);
            jdbc.update("INSERT INTO erp_integ_api ([接口编码], [方向], [分类], [接口名称], [提供方], [接口地址],"
                            + " [请求方式], [对应面板], [目标对象], [触发方式], [启用], [排序], [说明],"
                            + " asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,N'N')",
                    code, dir, cat, name, str(body.get("提供方")), str(body.get("接口地址")),
                    str(body.get("请求方式")), str(body.get("对应面板")), str(body.get("目标对象")),
                    str(body.get("触发方式")), isTrue(body.get("启用")) ? 1 : 0, seq, str(body.get("说明")),
                    user, now, user, now);
        }
    }

    /** 删除一个接口(连同其字段映射与设备绑定;配置类数据不留残行) */
    @Transactional
    public void deleteItem(String code) {
        if (code == null || code.isBlank()) throw new IllegalArgumentException("接口编码不能为空");
        jdbc.update("DELETE FROM erp_integ_field WHERE [接口编码] = ?", code);
        jdbc.update("DELETE FROM erp_integ_device WHERE [接口编码] = ?", code);
        jdbc.update("DELETE FROM erp_integ_api WHERE [接口编码] = ?", code);
    }

    /** 整表替换某接口的字段映射(界面保存时提交全部行,顺序即 序号) */
    @Transactional
    public void saveFields(String code, List<Map<String, Object>> rows) {
        requireItem(code);
        String user = currentUser();
        String now = LocalDateTime.now().format(FMT);
        String dir = jdbc.queryForObject(
                "SELECT [方向] FROM erp_integ_api WHERE [接口编码] = ?", String.class, code);
        jdbc.update("DELETE FROM erp_integ_field WHERE [接口编码] = ?", code);
        int seq = 0;
        for (Map<String, Object> r : rows == null ? List.<Map<String, Object>>of() : rows) {
            String mes = str(r.get("MES字段"));
            String erp = str(r.get("ERP字段"));
            if (mes.isEmpty() && erp.isEmpty()) continue;
            seq += 10;
            jdbc.update("INSERT INTO erp_integ_field ([接口编码], [方向], [序号], [映射层级], [MES字段], [ERP字段],"
                            + " [转换规则], [是否必填], [启用], [备注], asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,N'N')",
                    code, dir, seq, str(r.get("映射层级")), mes, erp, str(r.get("转换规则")),
                    isTrue(r.get("是否必填")) ? 1 : 0, r.get("启用") == null || isTrue(r.get("启用")) ? 1 : 0,
                    str(r.get("备注")), user, now, user, now);
        }
    }

    /** 整表替换某接口的设备绑定(设备名称按 bs_equip 现场取名留档) */
    @Transactional
    public void saveDevices(String code, List<Map<String, Object>> rows) {
        requireItem(code);
        String user = currentUser();
        String now = LocalDateTime.now().format(FMT);
        jdbc.update("DELETE FROM erp_integ_device WHERE [接口编码] = ?", code);
        for (Map<String, Object> r : rows == null ? List.<Map<String, Object>>of() : rows) {
            String dev = str(r.get("设备编码"));
            if (dev.isEmpty()) continue;
            List<String> names = jdbc.queryForList(
                    "SELECT TOP 1 设备名称 FROM bs_equip WHERE 设备编码 = ? AND ISNULL(asp_cancel, N'N') <> N'Y'",
                    String.class, dev);
            if (names.isEmpty())
                throw new IllegalArgumentException("设备编码[" + dev + "]不在设备档案(bs_equip)中,不能绑定");
            jdbc.update("INSERT INTO erp_integ_device ([接口编码], [设备编码], [设备名称], [设备用途], [备注],"
                            + " asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel)"
                            + " VALUES (?,?,?,?,?,?,?,?,?,N'N')",
                    code, dev, names.get(0), str(r.get("设备用途")), str(r.get("备注")), user, now, user, now);
        }
    }

    private void requireItem(String code) {
        if (code == null || code.isBlank()) throw new IllegalArgumentException("接口编码不能为空");
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM erp_integ_api WHERE [接口编码] = ?", Integer.class, code);
        if (n == null || n == 0) throw new IllegalArgumentException("接口[" + code + "]不存在(先保存接口信息)");
    }

    private static String currentUser() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        String n = auth == null ? null : auth.getName();
        return n == null || n.isBlank() ? "system" : n;
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o).trim();
    }

    private static boolean isTrue(Object o) {
        if (o == null) return false;
        if (o instanceof Boolean b) return b;
        if (o instanceof Number n) return n.intValue() != 0;
        String s = String.valueOf(o).trim();
        return "1".equals(s) || "true".equalsIgnoreCase(s) || "是".equals(s);
    }

    private static int toInt(Object o, int dft) {
        try {
            return o == null || String.valueOf(o).isBlank() ? dft : Integer.parseInt(String.valueOf(o).trim());
        } catch (NumberFormatException e) {
            return dft;
        }
    }
}
