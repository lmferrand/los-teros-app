export function limpiarTextoCliente(valor: unknown) {
  const base = String(valor || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/[(){}\[\]¡!¿?+\u0060\u00B4"';:|\\/<>_*#~^=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return base
}

function limpiarEnvolturasNombre(valor: string) {
  let texto = valor.trim()
  if (!texto) return ''

  const pares: Array<[string, string]> = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ]

  let cambio = true
  while (cambio && texto.length > 0) {
    cambio = false
    texto = texto.trim()

    for (const [open, close] of pares) {
      if (texto.startsWith(open) && texto.endsWith(close) && texto.length >= 2) {
        texto = texto.slice(1, -1).trim()
        cambio = true
      }
    }

    const sinPrefijo = texto.replace(/^[\s¡!¿?+`´"']+/, '')
    const sinSufijo = sinPrefijo.replace(/[\s¡!¿?+`´"']+$/, '')
    if (sinSufijo !== texto) {
      texto = sinSufijo.trim()
      cambio = true
    }
  }

  return texto.replace(/\s+/g, ' ').trim()
}

function limpiarNombreCliente(valor: unknown) {
  const base = String(valor || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return limpiarEnvolturasNombre(base)
}

export function estandarizarNombreComercial(valor: unknown) {
  return limpiarNombreCliente(valor).toUpperCase()
}

export function estandarizarNombreFiscal(valor: unknown) {
  return limpiarNombreCliente(valor).toUpperCase()
}
