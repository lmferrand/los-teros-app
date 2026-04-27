export function limpiarTextoCliente(valor: unknown) {
  const base = String(valor || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[(){}\[\]¡!¿?+\u0060\u00B4"';:|\\/<>_*#~^=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return base
}

export function estandarizarNombreComercial(valor: unknown) {
  return limpiarTextoCliente(valor).toUpperCase()
}

export function estandarizarNombreFiscal(valor: unknown) {
  return limpiarTextoCliente(valor).toUpperCase()
}
