package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.AttachmentService;
import com.yinjia.mes.service.DocPreviewService;
import com.yinjia.mes.service.PanelPermissionService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * 单据头字段附件接口(/api/attachment,yj_attachment):
 * 上传(multipart 单文件)/列表/删除/下载查看。原文件名保留;头字段列由服务端同步为文件名列表。
 * 错误走既有约定:IllegalArgumentException→HTTP 400(ApiResult 体),不会触发前端登出。
 *
 * 查看权限(2026-10-16 用户口径「有查看这个面板权限的人就可以查看上传的附件」):
 * 列表与下载按附件所属**面板的查看权**把关(requirePanelView:管理员恒过,角色可见 ∪ 参照目标 ∪ 同模块);
 * 此前面板能打开、附件却可能点不开(前端只在可编辑时渲染附件格),现在两端对齐。
 */
@RestController
@RequestMapping("/api/attachment")
public class AttachmentController {

    private final AttachmentService service;
    private final PanelPermissionService perms;
    private final DocPreviewService docPreview;

    public AttachmentController(AttachmentService service, PanelPermissionService perms,
                                DocPreviewService docPreview) {
        this.service = service;
        this.perms = perms;
        this.docPreview = docPreview;
    }

    /** 上传:POST multipart {file} + panelCode/docNo/field;返回 {files, names}。 */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<Map<String, Object>> upload(@RequestPart("file") MultipartFile file,
                                                 @RequestParam("panelCode") String panelCode,
                                                 @RequestParam("docNo") String docNo,
                                                 @RequestParam("field") String field,
                                                 Authentication authentication) throws IOException {
        return ApiResult.ok(service.upload(panelCode, docNo, field, file, currentUsername(authentication)));
    }

    /** 列表:GET ?panelCode&docNo&field(需该面板查看权)。 */
    @GetMapping("/list")
    public ApiResult<List<Map<String, Object>>> list(@RequestParam String panelCode,
                                                     @RequestParam String docNo,
                                                     @RequestParam String field) {
        perms.requirePanelView(panelCode);
        return ApiResult.ok(service.list(panelCode, docNo, field));
    }

    /** 删除:POST {id};返回删除后的 {files, names}。 */
    @PostMapping("/delete")
    public ApiResult<Map<String, Object>> delete(@RequestBody Map<String, Object> body,
                                                 Authentication authentication) throws IOException {
        Object id = body.get("id");
        if (!(id instanceof Number n)) return ApiResult.fail(400, "id 无效");
        return ApiResult.ok(service.delete(n.longValue(), currentUsername(authentication)));
    }

    /** 下载/查看:GET /{id}/download —— 图片/PDF/文本 inline 浏览器直接看,其余附件形式下载;
     *  文件名=原文件名(RFC 5987 UTF-8),浏览器另存时保留原名。
     *  权限:附件所属面板有查看权即可(不再只是"登录了就能按 id 拿文件")。 */
    @GetMapping("/{id}/download")
    public ResponseEntity<FileSystemResource> download(@PathVariable long id) {
        Map<String, Object> row = service.loadForDownload(id);
        perms.requirePanelView(String.valueOf(row.get("panelCode")));
        String fileName = String.valueOf(row.get("fileName"));
        String contentType = row.get("contentType") == null
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE : String.valueOf(row.get("contentType"));
        Path path = (Path) row.get("path");
        boolean inline = contentType.startsWith("image/") || contentType.startsWith("text/")
                || contentType.equals("application/pdf");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(contentType));
        headers.setContentDisposition(ContentDisposition.builder(inline ? "inline" : "attachment")
                .filename(fileName, StandardCharsets.UTF_8).build());
        return ResponseEntity.ok().headers(headers).body(new FileSystemResource(path));
    }

    /**
     * 老二进制 Word(.doc)在线预览:GET /{id}/preview-doc → 自包含 HTML。
     *
     * <p>为什么单开一条:现场附件《开题报告-修改版.doc》是 OLE2 真·老 Word(文件头 D0CF11E0),
     * 浏览器与前端 docx-preview 都解析不了(2026-10-28 用户口径「加预览,不用每次都下载再看」)。
     * HWPF 只能在后端做;解析失败一律 400,由前端捕获后降级为下载,不返回半截 HTML。
     *
     * <p>权限与下载同源:面板查看权(perms.requirePanelView),与「单据能不能编辑」无关 ——
     * 未保存新单里传的附件、审批中、已归档的单据都同样可预览。
     */
    @GetMapping(value = "/{id}/preview-doc", produces = MediaType.TEXT_HTML_VALUE + ";charset=UTF-8")
    public ResponseEntity<String> previewDoc(@PathVariable long id) {
        Map<String, Object> row = service.loadForDownload(id);
        perms.requirePanelView(String.valueOf(row.get("panelCode")));
        String html = docPreview.docToHtml((Path) row.get("path"), String.valueOf(row.get("fileName")));
        return ResponseEntity.ok()
                .contentType(new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8))
                .header("Cache-Control", "no-store")
                .body(html);
    }

    private static String currentUsername(Authentication authentication) {
        return authentication == null ? "" : authentication.getName();
    }
}
