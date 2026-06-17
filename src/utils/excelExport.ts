import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── Colores Corporativos ───
const BRAND_BLUE = '1E3A5F';
const BRAND_BLUE_LIGHT = 'EBF5FF';
const HEADER_FONT_COLOR = 'FFFFFF';
const BORDER_COLOR = 'B0BEC5';
const TOTAL_BG = 'E8F0FE';
const ACCENT_GREEN = '16A34A';
const ACCENT_RED = 'DC2626';

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
  style?: 'currency' | 'number' | 'text' | 'date' | 'percent';
  alignment?: 'left' | 'center' | 'right';
}

export interface SheetData {
  sheetName: string;
  title?: string;
  subtitle?: string;
  columns: ColumnDef[];
  rows: Record<string, any>[];
  totals?: Record<string, number | string>;
  companyInfo?: { ruc: string; name: string; period: string };
}

// ─── Thin border helper ───
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: BORDER_COLOR } },
  left: { style: 'thin', color: { argb: BORDER_COLOR } },
  bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
  right: { style: 'thin', color: { argb: BORDER_COLOR } },
};

function applyColumnFormat(col: ColumnDef, cell: ExcelJS.Cell) {
  const align = col.alignment || (col.style === 'currency' || col.style === 'number' || col.style === 'percent' ? 'right' : 'left');
  cell.alignment = { horizontal: align, vertical: 'middle' };

  if (col.style === 'currency') {
    cell.numFmt = '#,##0.00';
  } else if (col.style === 'number') {
    cell.numFmt = '#,##0';
  } else if (col.style === 'percent') {
    cell.numFmt = '0.00%';
  }
}

/**
 * Adds a styled sheet to a workbook
 */
export function addStyledSheet(wb: ExcelJS.Workbook, data: SheetData): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(data.sheetName);
  let currentRow = 1;

  // ─── Company Info Header ───
  if (data.companyInfo) {
    const titleRow = ws.getRow(currentRow);
    ws.mergeCells(currentRow, 1, currentRow, data.columns.length);
    titleRow.getCell(1).value = data.companyInfo.name || 'EMPRESA';
    titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: BRAND_BLUE } };
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    titleRow.height = 24;
    currentRow++;

    const infoRow = ws.getRow(currentRow);
    ws.mergeCells(currentRow, 1, currentRow, data.columns.length);
    infoRow.getCell(1).value = `RUC: ${data.companyInfo.ruc}  |  Periodo: ${data.companyInfo.period}`;
    infoRow.getCell(1).font = { size: 9, color: { argb: '666666' } };
    infoRow.getCell(1).alignment = { horizontal: 'center' };
    currentRow++;
  }

  // ─── Title ───
  if (data.title) {
    const tRow = ws.getRow(currentRow);
    ws.mergeCells(currentRow, 1, currentRow, data.columns.length);
    tRow.getCell(1).value = data.title;
    tRow.getCell(1).font = { bold: true, size: 12, color: { argb: BRAND_BLUE } };
    tRow.getCell(1).alignment = { horizontal: 'center' };
    tRow.height = 22;
    currentRow++;
  }

  if (data.subtitle) {
    const sRow = ws.getRow(currentRow);
    ws.mergeCells(currentRow, 1, currentRow, data.columns.length);
    sRow.getCell(1).value = data.subtitle;
    sRow.getCell(1).font = { size: 9, italic: true, color: { argb: '888888' } };
    sRow.getCell(1).alignment = { horizontal: 'center' };
    currentRow++;
  }

  // blank row
  currentRow++;

  // ─── Column Headers ───
  const headerRowNum = currentRow;
  const headerRow = ws.getRow(headerRowNum);
  data.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 10, color: { argb: HEADER_FONT_COLOR } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BLUE } };
    cell.alignment = { horizontal: col.alignment || 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
    ws.getColumn(i + 1).width = col.width || 15;
  });
  headerRow.height = 28;
  currentRow++;

  // ─── Data Rows ───
  data.rows.forEach((rowData, rowIdx) => {
    const row = ws.getRow(currentRow);
    data.columns.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      let value = rowData[col.key];

      // Auto-convert string numbers
      if (typeof value === 'string' && (col.style === 'currency' || col.style === 'number')) {
        const parsed = parseFloat(value.replace(/,/g, ''));
        if (!isNaN(parsed)) value = parsed;
      }

      cell.value = value ?? '';
      cell.border = thinBorder;
      cell.font = { size: 9 };
      applyColumnFormat(col, cell);

      // Alternating row colors
      if (rowIdx % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BLUE_LIGHT } };
      }

      // Color currency values
      if (col.style === 'currency' && typeof value === 'number') {
        cell.font = { size: 9, bold: true, color: { argb: value < 0 ? ACCENT_RED : '333333' } };
      }
    });
    row.height = 18;
    currentRow++;
  });

  // ─── Totals Row ───
  if (data.totals) {
    const totRow = ws.getRow(currentRow);
    data.columns.forEach((col, i) => {
      const cell = totRow.getCell(i + 1);
      const val = data.totals![col.key];
      cell.value = val ?? '';
      cell.border = {
        top: { style: 'double', color: { argb: BRAND_BLUE } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'double', color: { argb: BRAND_BLUE } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      cell.font = { bold: true, size: 10, color: { argb: BRAND_BLUE } };
      applyColumnFormat(col, cell);
    });
    totRow.height = 24;
  }

  // Auto-filter on header
  ws.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum, column: data.columns.length },
  };

  return ws;
}

/**
 * Export a single sheet as a downloadable .xlsx
 */
export async function exportSingleSheet(data: SheetData, filename: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SoftContable';
  wb.created = new Date();
  addStyledSheet(wb, data);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
}

/**
 * Export multiple sheets as a single downloadable .xlsx
 */
export async function exportMultipleSheets(sheets: SheetData[], filename: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SoftContable';
  wb.created = new Date();

  sheets.forEach(s => addStyledSheet(wb, s));

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
}

/**
 * Export Libro Diario 5.2 physical structure with multi-level groups and proper corporate design
 */
export async function exportLd52FisicoToXLSX(
  entries: any[],
  columnTotals: any,
  companyInfo: { ruc: string; name: string; period: string },
  filename: string
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SoftContable';
  wb.created = new Date();

  const ws = wb.addWorksheet('Libro Diario 5.2 Físico');
  let currentRow = 1;

  // 1. Company Info Header
  const titleRow = ws.getRow(currentRow);
  ws.mergeCells(currentRow, 1, currentRow, 70);
  titleRow.getCell(1).value = companyInfo.name || 'EMPRESA';
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: BRAND_BLUE } };
  titleRow.getCell(1).alignment = { horizontal: 'center' };
  titleRow.height = 24;
  currentRow++;

  const infoRow = ws.getRow(currentRow);
  ws.mergeCells(currentRow, 1, currentRow, 70);
  infoRow.getCell(1).value = `RUC: ${companyInfo.ruc}  |  Periodo: ${companyInfo.period}`;
  infoRow.getCell(1).font = { size: 9, color: { argb: '666666' } };
  infoRow.getCell(1).alignment = { horizontal: 'center' };
  currentRow++;

  const tRow = ws.getRow(currentRow);
  ws.mergeCells(currentRow, 1, currentRow, 70);
  tRow.getCell(1).value = 'LIBRO DIARIO DE FORMATO SIMPLIFICADO - FORMATO FÍSICO/MECANIZADO 5.2';
  tRow.getCell(1).font = { bold: true, size: 12, color: { argb: BRAND_BLUE } };
  tRow.getCell(1).alignment = { horizontal: 'center' };
  tRow.height = 22;
  currentRow++;

  // blank row
  currentRow++;

  // 2. Group Headers (Row 1 of table header)
  const groupRow = ws.getRow(currentRow);
  groupRow.height = 26;

  const groups = [
    { start: 1, end: 4, text: 'DATOS DE CABECERA', color: '9D174D' },
    { start: 5, end: 22, text: 'ACTIVO', color: '1E3A8A' },
    { start: 23, end: 32, text: 'PASIVO', color: '064E3B' },
    { start: 33, end: 38, text: 'PATRIMONIO', color: '78350F' },
    { start: 39, end: 60, text: 'CUENTAS DE GASTOS (E6 / E9)', color: '881337' },
    { start: 61, end: 70, text: 'CUENTAS DE INGRESOS (E7)', color: '115E59' },
  ];

  groups.forEach(g => {
    ws.mergeCells(currentRow, g.start, currentRow, g.end);
    const cell = groupRow.getCell(g.start);
    cell.value = g.text;
    cell.font = { bold: true, size: 9, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: g.color } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    // Set border for merged range
    for (let c = g.start; c <= g.end; c++) {
      groupRow.getCell(c).border = thinBorder;
    }
  });
  currentRow++;

  // 3. Sub-column headers (Row 2 of table header)
  const subCols = [
    { header: 'CUO', key: 'cuo', width: 15, alignment: 'center' },
    { header: 'FECHA', key: 'fecha', width: 12, alignment: 'center' },
    { header: 'GLOSA', key: 'glosa', width: 35 },
    { header: 'CAR', key: 'car', width: 12, alignment: 'center' },
    
    // Activo
    { header: '10 D', key: 'c10_d', width: 11, style: 'currency' },
    { header: '10 H', key: 'c10_h', width: 11, style: 'currency' },
    { header: '12 D', key: 'c12_d', width: 11, style: 'currency' },
    { header: '12 H', key: 'c12_h', width: 11, style: 'currency' },
    { header: '16 D', key: 'c16_d', width: 11, style: 'currency' },
    { header: '16 H', key: 'c16_h', width: 11, style: 'currency' },
    { header: '20 D', key: 'c20_d', width: 11, style: 'currency' },
    { header: '20 H', key: 'c20_h', width: 11, style: 'currency' },
    { header: '21 D', key: 'c21_d', width: 11, style: 'currency' },
    { header: '21 H', key: 'c21_h', width: 11, style: 'currency' },
    { header: '33 D', key: 'c33_d', width: 11, style: 'currency' },
    { header: '33 H', key: 'c33_h', width: 11, style: 'currency' },
    { header: '34 D', key: 'c34_d', width: 11, style: 'currency' },
    { header: '34 H', key: 'c34_h', width: 11, style: 'currency' },
    { header: '38 D', key: 'c38_d', width: 11, style: 'currency' },
    { header: '38 H', key: 'c38_h', width: 11, style: 'currency' },
    { header: '39 D', key: 'c39_d', width: 11, style: 'currency' },
    { header: '39 H', key: 'c39_h', width: 11, style: 'currency' },

    // Pasivo
    { header: '4011 D', key: 'c4011D', width: 11, style: 'currency' },
    { header: '4011 C', key: 'c4011C', width: 11, style: 'currency' },
    { header: '4017 D', key: 'c4017D', width: 11, style: 'currency' },
    { header: '4017 C', key: 'c4017C', width: 11, style: 'currency' },
    { header: '402 D', key: 'c402_d', width: 11, style: 'currency' },
    { header: '402 H', key: 'c402_h', width: 11, style: 'currency' },
    { header: '42 D', key: 'c42_d', width: 11, style: 'currency' },
    { header: '42 H', key: 'c42_h', width: 11, style: 'currency' },
    { header: '46 D', key: 'c46_d', width: 11, style: 'currency' },
    { header: '46 H', key: 'c46_h', width: 11, style: 'currency' },

    // Patrimonio
    { header: '50 D', key: 'c50_d', width: 11, style: 'currency' },
    { header: '50 H', key: 'c50_h', width: 11, style: 'currency' },
    { header: '58 D', key: 'c58_d', width: 11, style: 'currency' },
    { header: '58 H', key: 'c58_h', width: 11, style: 'currency' },
    { header: '59 D', key: 'c59_d', width: 11, style: 'currency' },
    { header: '59 H', key: 'c59_h', width: 11, style: 'currency' },

    // Gastos
    { header: '60 D', key: 'c60_d', width: 11, style: 'currency' },
    { header: '60 H', key: 'c60_h', width: 11, style: 'currency' },
    { header: '61 D', key: 'c61_d', width: 11, style: 'currency' },
    { header: '61 H', key: 'c61_h', width: 11, style: 'currency' },
    { header: '62 D', key: 'c62_d', width: 11, style: 'currency' },
    { header: '62 H', key: 'c62_h', width: 11, style: 'currency' },
    { header: '63 D', key: 'c63_d', width: 11, style: 'currency' },
    { header: '63 H', key: 'c63_h', width: 11, style: 'currency' },
    { header: '65 D', key: 'c65_d', width: 11, style: 'currency' },
    { header: '65 H', key: 'c65_h', width: 11, style: 'currency' },
    { header: '66 D', key: 'c66_d', width: 11, style: 'currency' },
    { header: '66 H', key: 'c66_h', width: 11, style: 'currency' },
    { header: '67 D', key: 'c67_d', width: 11, style: 'currency' },
    { header: '67 H', key: 'c67_h', width: 11, style: 'currency' },
    { header: '68 D', key: 'c68_d', width: 11, style: 'currency' },
    { header: '68 H', key: 'c68_h', width: 11, style: 'currency' },
    { header: '69 D', key: 'c69_d', width: 11, style: 'currency' },
    { header: '69 H', key: 'c69_h', width: 11, style: 'currency' },
    { header: '96 D', key: 'c96_d', width: 11, style: 'currency' },
    { header: '96 H', key: 'c96_h', width: 11, style: 'currency' },
    { header: '97 D', key: 'c97_d', width: 11, style: 'currency' },
    { header: '97 H', key: 'c97_h', width: 11, style: 'currency' },

    // Ingresos
    { header: '70 D', key: 'c70_d', width: 11, style: 'currency' },
    { header: '70 H', key: 'c70_h', width: 11, style: 'currency' },
    { header: '75 D', key: 'c75_d', width: 11, style: 'currency' },
    { header: '75 H', key: 'c75_h', width: 11, style: 'currency' },
    { header: '76 D', key: 'c76_d', width: 11, style: 'currency' },
    { header: '76 H', key: 'c76_h', width: 11, style: 'currency' },
    { header: '77 D', key: 'c77_d', width: 11, style: 'currency' },
    { header: '77 H', key: 'c77_h', width: 11, style: 'currency' },
    { header: '79 D', key: 'c79_d', width: 11, style: 'currency' },
    { header: '79 H', key: 'c79_h', width: 11, style: 'currency' },
  ];

  const subHeaderRow = ws.getRow(currentRow);
  subHeaderRow.height = 20;
  subCols.forEach((col, i) => {
    const cell = subHeaderRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, size: 8 };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getColumn(i + 1).width = col.width || 11;
  });
  currentRow++;

  // 4. Data Rows
  entries.forEach((rowData, rowIdx) => {
    const row = ws.getRow(currentRow);
    subCols.forEach((col, i) => {
      const cell = row.getCell(i + 1);
      let value = rowData[col.key];
      cell.value = value ?? '';
      cell.border = thinBorder;
      cell.font = { size: 8 };
      
      const align = (col.alignment || (col.style === 'currency' ? 'right' : 'left')) as ExcelJS.Alignment['horizontal'];
      cell.alignment = { horizontal: align, vertical: 'middle' };
      if (col.style === 'currency') {
        cell.numFmt = '#,##0.00';
        if (typeof value === 'number' && value !== 0) {
          cell.font = { size: 8, bold: true };
        }
      }

      // Alternating row colors
      if (rowIdx % 2 === 0) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_BLUE_LIGHT } };
      }
    });
    row.height = 16;
    currentRow++;
  });

  // 5. Totals Row
  const totalRow = ws.getRow(currentRow);
  totalRow.height = 22;
  subCols.forEach((col, i) => {
    const cell = totalRow.getCell(i + 1);
    if (i === 0) {
      cell.value = 'TOTALES';
    } else {
      cell.value = columnTotals[col.key] ?? '';
    }
    cell.font = { bold: true, size: 9, color: { argb: BRAND_BLUE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
    cell.border = {
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      bottom: { style: 'double', color: { argb: BRAND_BLUE } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } }
    };
    
    const align = (col.alignment || (col.style === 'currency' ? 'right' : 'left')) as ExcelJS.Alignment['horizontal'];
    cell.alignment = { horizontal: align, vertical: 'middle' };
    if (col.style === 'currency') {
      cell.numFmt = '#,##0.00';
    }
  });

  // Auto-filter on subheaders
  ws.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: 70 },
  };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
}
