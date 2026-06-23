'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Estado global "ayuda activada" (persistido en localStorage).
const KEY = 'ayuda-activa'
const EVENT = 'ayuda-change'

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(KEY) === '1'
}
function getServerSnapshot(): boolean { return false }
function subscribe(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', cb)
  window.addEventListener(EVENT, cb)
  return () => { window.removeEventListener('storage', cb); window.removeEventListener(EVENT, cb) }
}
export function useAyuda() {
  const activa = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const setActiva = useCallback((v: boolean) => {
    window.localStorage.setItem(KEY, v ? '1' : '0')
    window.dispatchEvent(new Event(EVENT))
  }, [])
  return { activa, setActiva, toggle: () => setActiva(!activa) }
}

// ---------------- Ayuda por módulo ----------------
export interface AyudaModulo { titulo: string; que: string; pasos: string[] }

export const AYUDA: Record<string, AyudaModulo> = {
  inicio: { titulo: 'Inicio', que: 'Resumen de toda la empresa de un vistazo: lo clave del mes y lo que requiere atención.', pasos: ['Mira "Este mes" para ver cómo va el negocio.', 'Revisa "Requiere atención": órdenes de hoy, stock bajo, cobros…', 'Usa los accesos rápidos para entrar a cada sección.'] },
  dashboard: { titulo: 'Dashboard', que: 'Cómo va la empresa este mes a pesar del desfase entre ventas, cobros y facturación.', pasos: ['La tarjeta grande = ventas aprobadas del mes (cobradas o no).', 'Cambia de mes con las flechas.', 'Abajo, KPIs detallados y avisos.'] },
  presupuestos: { titulo: 'Presupuestos', que: 'El corazón de la app: cada presupuesto aceptado es una venta que se sigue hasta cobrar y facturar.', pasos: ['Crea o sube un presupuesto (también con IA en Documentos).', 'Añade sus gastos para ver el margen real.', 'Cuando lo programes, se genera la Orden de Trabajo automáticamente.'] },
  facturacion: { titulo: 'Facturación prevista', que: 'Ver el desfase: cuándo se vende, se cobra, se ejecuta y se factura, mes a mes.', pasos: ['Cada fila es un mes.', 'Compara las columnas para anticipar entradas de dinero.'] },
  margenes: { titulo: 'Márgenes', que: 'Qué presupuestos son rentables y cuáles no (semáforo verde/ámbar/rojo).', pasos: ['Ordena por peor margen para detectar problemas.', 'Rojo = margen < 30%.'] },
  alertas: { titulo: 'Alertas', que: 'Todos los avisos importantes juntos: margen bajo, sobrecostes, cobros vencidos, sin facturar…', pasos: ['Pulsa un cliente para ir a su presupuesto.', 'Prioriza los rojos.'] },
  documentos: { titulo: 'Documentos IA', que: 'Sube un presupuesto (PDF o foto) y la IA extrae los datos para crear el presupuesto.', pasos: ['Sube el documento.', 'Revisa los datos (los de confianza baja en rojo).', 'Crea el presupuesto.'] },
  planificacion: { titulo: 'Planificación', que: 'Calendario del trabajo programado y tus tareas, con avisos.', pasos: ['Pulsa un día para ver su agenda (OTs y tareas).', 'Crea tareas con fecha, prioridad y responsable.', 'Marca las tareas como hechas.'] },
  clientes: { titulo: 'Clientes', que: 'Tu fichero de clientes con búsqueda y ficha (presupuestos e historial).', pasos: ['Busca por nombre, CIF, población o teléfono.', 'Entra en un cliente para ver su ficha y sus presupuestos.'] },
  'sin-servicio': { titulo: 'Recordatorios', que: 'Clientes que llevan tiempo sin un servicio, para volver a contactarlos.', pasos: ['Ajusta el umbral (6 meses / 1 año / 2 años).', 'Llama al cliente y márcalo como contactado.'] },
  ordenes: { titulo: 'Órdenes de trabajo', que: 'El trabajo a ejecutar: qué hacer, quién, cuándo, con fotos, consumos e incidencias.', pasos: ['Crea la OT o genérala desde un presupuesto.', 'Asigna técnicos y fecha.', 'En la ficha: cambia estado, sube fotos, registra material e incidencias.'] },
  inventario: { titulo: 'Inventario', que: 'Materiales (con stock y QR) y equipos. Controla existencias y mínimos.', pasos: ['Crea materiales/equipos y genera su QR.', 'Ajusta el stock cuando entre o salga material.', 'Vigila las alertas de stock bajo.'] },
  movimientos: { titulo: 'Movimientos', que: 'Historial de entradas, salidas, consumos y ajustes de inventario.', pasos: ['Filtra por tipo, trabajador, ítem o fechas.', 'Registra un movimiento ligado a una OT y trabajador.'] },
  escanear: { titulo: 'Escanear', que: 'Localiza un material o equipo con su código QR usando la cámara.', pasos: ['Pulsa "Abrir cámara" y apunta al QR.', 'O busca por código si no hay cámara.', 'Ajusta el stock al instante.'] },
  albaranes: { titulo: 'Albaranes', que: 'Albaranes de entrega con fotos, firmas y PDF.', pasos: ['Crea el albarán (autorellena con el cliente).', 'Añade fotos y recoge las firmas.', 'Descarga el PDF para enviar o imprimir.'] },
  trabajadores: { titulo: 'Trabajadores', que: 'Usuarios de la app: alta, rol, contraseñas y accesos.', pasos: ['Crea un trabajador con su contraseña.', 'Con "Accesos" eliges a qué módulos entra.', 'Los técnicos solo ven sus OT y lo necesario.'] },
}

// ---------------- Tutorial paso a paso ----------------
export interface PasoTutorial { titulo: string; texto: string; emoji: string }

export const TUTORIAL: PasoTutorial[] = [
  { emoji: '👋', titulo: 'Bienvenido a Los Teros', texto: 'Esta app gestiona toda la empresa: lo financiero (presupuestos, cobros, márgenes) y lo operativo (órdenes, inventario, clientes…). Te lo enseño en un minuto.' },
  { emoji: '🧭', titulo: 'El menú', texto: 'A la izquierda tienes el menú en dos secciones plegables: "Financiero" y "Operaciones". Pulsa cada una para desplegarla. Arriba, "Inicio" es el resumen general.' },
  { emoji: '📄', titulo: 'Presupuestos = ventas', texto: 'Cada presupuesto aceptado es una venta. Le añades sus gastos y la app calcula el margen real. Puedes crearlos a mano o subirlos con IA en "Documentos".' },
  { emoji: '🛠️', titulo: 'Programar → Orden de trabajo', texto: 'Cuando programas un presupuesto, se crea automáticamente su Orden de Trabajo con el detalle de qué hacer. Ahí asignas técnicos, fecha, fotos y consumos.' },
  { emoji: '📦', titulo: 'Inventario y escáner', texto: 'Controla materiales y equipos con stock y códigos QR. El escáner localiza un ítem con la cámara y registra el consumo.' },
  { emoji: '👥', titulo: 'Clientes y recordatorios', texto: 'Tu fichero de clientes y los avisos de quién lleva tiempo sin servicio para volver a contactarlos.' },
  { emoji: '🔒', titulo: 'Cada uno ve lo suyo', texto: 'Dirección y oficina ven todo. Los técnicos solo ven sus órdenes y lo necesario, sin precios. Lo configuras en "Trabajadores → Accesos".' },
  { emoji: '🙋', titulo: 'Tu perfil y la ayuda', texto: 'Arriba a la derecha está tu perfil: foto, tema claro/oscuro y el interruptor de Ayuda. Con la Ayuda activada, cada pantalla te explica para qué sirve.' },
]
