/**
 * Enums y catálogos del modelo epidemiológico.
 *
 * Estos valores DEBEN coincidir exactamente con los enums definidos en Supabase:
 *   - estado_caso_enum: nuevo, reingreso, tratado
 *   - genero_enum:      femenino, masculino, otro, no_informa
 *
 * Si cambias los valores en la BD, ajusta SOLO este archivo: el dashboard,
 * filtros y formulario lo consumen.
 */

export const ESTADO_OPTIONS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'reingreso', label: 'Reingreso' },
  { value: 'tratado', label: 'Tratado' }
]

export const ESTADO_VALUES = ESTADO_OPTIONS.map((o) => o.value)

export const ESTADO_LABEL = ESTADO_OPTIONS.reduce((acc, o) => {
  acc[o.value] = o.label
  return acc
}, {})

/**
 * Colores semáforo de los estados — mismos en KPIs, gráficos, ranking y mapa.
 *  - nuevo:     rojo       (caso recién detectado, requiere acción)
 *  - reingreso: amarillo   (caso vuelve a entrar al programa)
 *  - tratado:   verde      (caso cerrado / terminado)
 */
export const ESTADO_COLOR = {
  nuevo: '#dc2626',
  reingreso: '#f59e0b',
  tratado: '#16a34a'
}

export const GENERO_OPTIONS = [
  { value: 'femenino', label: 'Femenino' },
  { value: 'masculino', label: 'Masculino' },
  { value: 'otro', label: 'Otro' },
  { value: 'no_informa', label: 'No informa' }
]

export const GENERO_VALUES = GENERO_OPTIONS.map((o) => o.value)

export const GENERO_LABEL = GENERO_OPTIONS.reduce((acc, o) => {
  acc[o.value] = o.label
  return acc
}, {})

export const AGE_GROUP_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: '0_14', label: '0-14' },
  { value: '15_29', label: '15-29' },
  { value: '30_44', label: '30-44' },
  { value: '45_59', label: '45-59' },
  { value: '60_plus', label: '60+' }
]

export function ageGroupRange(group) {
  switch (group) {
    case '0_14':
      return { min: 0, max: 14 }
    case '15_29':
      return { min: 15, max: 29 }
    case '30_44':
      return { min: 30, max: 44 }
    case '45_59':
      return { min: 45, max: 59 }
    case '60_plus':
      return { min: 60, max: 120 }
    default:
      return null
  }
}
