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

/**
 * Rangos etarios en intervalos de 5 años hasta 75–79; desde los 80 años: solo «80+».
 * `value` identifica el filtro del panel y las categorías de la pirámide.
 */
export const AGE_QUINQUENIAL_GROUPS = [
  { value: '0_4', label: '0–4 años', min: 0, max: 4 },
  { value: '5_9', label: '5–9 años', min: 5, max: 9 },
  { value: '10_14', label: '10–14 años', min: 10, max: 14 },
  { value: '15_19', label: '15–19 años', min: 15, max: 19 },
  { value: '20_24', label: '20–24 años', min: 20, max: 24 },
  { value: '25_29', label: '25–29 años', min: 25, max: 29 },
  { value: '30_34', label: '30–34 años', min: 30, max: 34 },
  { value: '35_39', label: '35–39 años', min: 35, max: 39 },
  { value: '40_44', label: '40–44 años', min: 40, max: 44 },
  { value: '45_49', label: '45–49 años', min: 45, max: 49 },
  { value: '50_54', label: '50–54 años', min: 50, max: 54 },
  { value: '55_59', label: '55–59 años', min: 55, max: 59 },
  { value: '60_64', label: '60–64 años', min: 60, max: 64 },
  { value: '65_69', label: '65–69 años', min: 65, max: 69 },
  { value: '70_74', label: '70–74 años', min: 70, max: 74 },
  { value: '75_79', label: '75–79 años', min: 75, max: 79 },
  { value: '80_plus', label: '80+', min: 80, max: 120 }
]

export const AGE_GROUP_OPTIONS = [
  { value: 'all', label: 'Todos' },
  ...AGE_QUINQUENIAL_GROUPS.map(({ value, label }) => ({ value, label }))
]

export function ageGroupRange(group) {
  const row = AGE_QUINQUENIAL_GROUPS.find((g) => g.value === group)
  return row ? { min: row.min, max: row.max } : null
}
