package com.yinjia.mes.controller;

import com.yinjia.mes.dto.ApiResult;
import com.yinjia.mes.service.AttachmentService;
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
 */
@RestController
@RequestMapping("/api/attachment")
public class AttachmentController {

    private final AttachmentService service;

    public AttachmentController(AttachmentService service) {
        this.service = service;
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

    /** 列表:GET ?panelCode&docNo&field。 */
    @GetMapping("/list")
    public ApiResult<List<Map<String, Object>>> list(@RequestParam String panelCode,
                                                     @RequestParam String docNo,
                                                     @RequestParam String field) {
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
     *  文件名=原文件名(RFC 5987 UTF-8),浏览器另存时保留原名。 */
    @GetMapping("/{id}/download")
    public ResponseEntity<FileSystemResource> download(@PathVariable long id) {
        Map<String, Object> row = service.loadForDownload(id);
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

    private static String currentUsername(Authentication authentication) {
        return authentication == null ? "" : authentication.getName();
    }
}
