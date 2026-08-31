package com.yinjia.mes.ocr;

import java.io.InputStream;
import java.util.List;

/** 云 OCR 边界(移植自 light-mes):校验与结构映射在服务层完成。 */
public interface OcrGateway {

    OcrDocument recognize(InputStream image) throws OcrGatewayException;

    record OcrDocument(String requestId, String rawText, List<OcrLine> lines, List<OcrTable> tables) {
        public OcrDocument {
            rawText = rawText == null ? "" : rawText;
            lines = lines == null ? List.of() : List.copyOf(lines);
            tables = tables == null ? List.of() : List.copyOf(tables);
        }
    }

    record OcrLine(String text, Integer confidence) {
    }

    record OcrTable(List<OcrCell> cells) {
        public OcrTable {
            cells = cells == null ? List.of() : List.copyOf(cells);
        }
    }

    record OcrCell(int rowStart, int rowEnd, int columnStart, int columnEnd, String text) {
    }
}
