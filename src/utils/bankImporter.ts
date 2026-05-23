import * as XLSX from 'xlsx';

export interface BankStatementLine {
  id?: string;
  fecha: string;
  referencia: string;
  glosa: string;
  monto: number;
  reconciled_journal_id?: string | null;
}

/**
 * Parses an Excel or CSV file of a bank statement
 */
export async function parseBankStatement(file: File): Promise<BankStatementLine[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve([]);
          return;
        }
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rows.length === 0) {
          resolve([]);
          return;
        }

        const lines: BankStatementLine[] = [];
        
        // Find column mappings
        let headerRowIndex = -1;
        let colMap: Record<string, number> = {
          fecha: -1,
          glosa: -1,
          referencia: -1,
          monto: -1,
          cargo: -1,
          abono: -1
        };

        for (let i = 0; i < Math.min(rows.length, 15); i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;
          
          let foundDate = false;
          let foundAmountOrCargo = false;

          row.forEach((cell, cellIdx) => {
            if (cell === null || cell === undefined) return;
            const str = String(cell).toLowerCase().trim();
            
            if (str.includes('fecha') || str.includes('fec.')) {
              colMap.fecha = cellIdx;
              foundDate = true;
            }
            if (str.includes('glosa') || str.includes('descrip') || str.includes('concepto') || str.includes('detalle') || str.includes('leyenda')) {
              colMap.glosa = cellIdx;
            }
            if (str.includes('referencia') || str.includes('operacion') || str.includes('nro. op') || str.includes('nro op') || str.includes('documento') || str.includes('ref.')) {
              colMap.referencia = cellIdx;
            }
            if (str.includes('monto') || str.includes('importe') || str.includes('valor') || str.includes('cantidad')) {
              colMap.monto = cellIdx;
              foundAmountOrCargo = true;
            }
            if (str.includes('cargo') || str.includes('debit') || str.includes('retiro') || str.includes('salida') || str.includes('egreso')) {
              colMap.cargo = cellIdx;
              foundAmountOrCargo = true;
            }
            if (str.includes('abono') || str.includes('credit') || str.includes('deposito') || str.includes('ingreso')) {
              colMap.abono = cellIdx;
              foundAmountOrCargo = true;
            }
          });

          if (foundDate && foundAmountOrCargo) {
            headerRowIndex = i;
            break;
          }
        }

        // Default mapping if not found
        if (headerRowIndex === -1) {
          colMap = { fecha: 0, referencia: 1, glosa: 2, monto: 3, cargo: -1, abono: -1 };
          headerRowIndex = 0;
        }

        // Process data rows
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row) || row.length === 0) continue;

          const rawFecha = row[colMap.fecha];
          if (rawFecha === null || rawFecha === undefined || String(rawFecha).trim() === '') continue;

          // Parse fecha
          let fechaStr = '';
          if (typeof rawFecha === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(rawFecha);
            fechaStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
          } else {
            const s = String(rawFecha).trim();
            const parts = s.split(/[-/.]/);
            if (parts.length === 3) {
              if (parts[0].length === 4) {
                fechaStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              } else if (parts[2].length === 4) {
                fechaStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              } else {
                fechaStr = s;
              }
            } else {
              fechaStr = s;
            }
          }

          // Parse monto
          let monto = 0;
          if (colMap.monto !== -1 && row[colMap.monto] !== undefined) {
            monto = parseFloat(String(row[colMap.monto] || '0').replace(/[^0-9.-]/g, '')) || 0;
          } else {
            const cargoStr = colMap.cargo !== -1 && row[colMap.cargo] !== undefined ? String(row[colMap.cargo]) : '0';
            const abonoStr = colMap.abono !== -1 && row[colMap.abono] !== undefined ? String(row[colMap.abono]) : '0';
            const cargo = Math.abs(parseFloat(cargoStr.replace(/[^0-9.-]/g, '')) || 0);
            const abono = Math.abs(parseFloat(abonoStr.replace(/[^0-9.-]/g, '')) || 0);
            if (abono > 0) {
              monto = abono;
            } else if (cargo > 0) {
              monto = -cargo;
            }
          }

          const glosa = String(row[colMap.glosa] !== undefined ? row[colMap.glosa] : 'MOVIMIENTO BANCARIO').trim();
          const referencia = String(row[colMap.referencia] !== undefined ? row[colMap.referencia] : '').trim();

          // Double check if valid date
          if (fechaStr && !isNaN(Date.parse(fechaStr))) {
            lines.push({
              id: `bank-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
              fecha: fechaStr.substring(0, 10),
              referencia,
              glosa,
              monto
            });
          }
        }

        resolve(lines);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsBinaryString(file);
  });
}
