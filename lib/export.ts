'use client'

import * as XLSX from 'xlsx'

// Exporta una o varias hojas a un archivo .xlsx (descarga en el navegador).
export function exportarExcel(nombreArchivo: string, hojas: { nombre: string; filas: Record<string, unknown>[] }[]) {
  const wb = XLSX.utils.book_new()
  for (const h of hojas) {
    const ws = XLSX.utils.json_to_sheet(h.filas.length ? h.filas : [{}])
    XLSX.utils.book_append_sheet(wb, ws, h.nombre.slice(0, 31))
  }
  XLSX.writeFile(wb, nombreArchivo)
}
