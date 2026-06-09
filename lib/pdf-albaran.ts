'use client'

import { jsPDF } from 'jspdf'
import type { AlbaranConRefs } from './db/albaranes'

async function urlADataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url)
    const b = await r.blob()
    return await new Promise((res) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = () => res(null)
      fr.readAsDataURL(b)
    })
  } catch { return null }
}

function fechaDia(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-ES')
}

export async function generarPdfAlbaran(a: AlbaranConRefs) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  let y = 48

  // Logo (escudo) + cabecera
  const logo = await urlADataUrl('/escudo.png')
  if (logo) { try { doc.addImage(logo, 'PNG', M, y - 14, 46, 46) } catch { /* noop */ } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(14, 165, 233)
  doc.text('ALBARÁN DE ENTREGA', M + 58, y + 6)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100)
  doc.text('Extracciones Teros', M + 58, y + 22)
  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text(a.numero || '', W - M, y, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100)
  doc.text(`Fecha: ${fechaDia(a.fecha)}`, W - M, y + 16, { align: 'right' })

  y += 56
  doc.setDrawColor(225); doc.line(M, y, W - M, y); y += 24

  // Datos del cliente
  doc.setTextColor(15, 23, 42); doc.setFont('helvetica', 'bold'); doc.setFontSize(11)
  doc.text('Cliente', M, y); y += 16
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(60)
  const lineas = [
    a.razon_social || a.clientes?.nombre || '',
    a.cif ? `CIF: ${a.cif}` : '',
    a.domicilio || '',
    [a.localidad, a.provincia].filter(Boolean).join(', '),
    [a.telefono, a.email].filter(Boolean).join(' · '),
  ].filter(Boolean)
  for (const l of lineas) { doc.text(l, M, y); y += 14 }
  if (a.ordenes?.codigo) { doc.text(`OT asociada: ${a.ordenes.codigo}`, M, y); y += 14 }

  y += 12
  doc.setDrawColor(235); doc.line(M, y, W - M, y); y += 22

  // Descripción / observaciones
  function bloque(titulo: string, texto: string | null) {
    if (!texto) return
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(15, 23, 42)
    doc.text(titulo, M, y); y += 14
    doc.setFont('helvetica', 'normal'); doc.setTextColor(60)
    const wrapped = doc.splitTextToSize(texto, W - M * 2)
    doc.text(wrapped, M, y); y += wrapped.length * 13 + 10
  }
  bloque('Descripción', a.descripcion)
  bloque('Instalación', a.instalacion)
  bloque('Observaciones', a.observaciones)

  // Firmas (al pie)
  const yFirma = 700
  const colW = (W - M * 2 - 20) / 2
  doc.setDrawColor(225)
  const firmaEmp = a.firma_empleado_url ? await urlADataUrl(a.firma_empleado_url) : null
  const firmaCli = a.firma_cliente_url ? await urlADataUrl(a.firma_cliente_url) : null
  const cajas = [
    { x: M, label: 'Firma empleado', img: firmaEmp, fecha: a.firmado_empleado_at },
    { x: M + colW + 20, label: 'Firma cliente', img: firmaCli, fecha: a.firmado_cliente_at },
  ]
  for (const c of cajas) {
    doc.line(c.x, yFirma + 60, c.x + colW, yFirma + 60)
    if (c.img) { try { doc.addImage(c.img, 'PNG', c.x + 10, yFirma, colW - 20, 56) } catch { /* noop */ } }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42)
    doc.text(c.label, c.x, yFirma + 76)
    if (c.fecha) { doc.setFont('helvetica', 'normal'); doc.setTextColor(120); doc.text(fechaDia(c.fecha), c.x, yFirma + 90) }
  }

  doc.save(`${a.numero || 'albaran'}.pdf`)
}
