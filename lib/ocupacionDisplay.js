import { ocupacionLabelFromCaso } from '@/lib/ocupacionMapper'

/** Etiqueta de ocupación desde join FK → `catalogo_ocupaciones.nombre`. */
export function resolveOcupacionLabel(caso) {
  return ocupacionLabelFromCaso(caso)
}

/** Añade `ocupacion_label` (alias de `ocupacion_nombre`) para componentes legacy. */
export function enrichCaseOcupacion(caso) {
  if (!caso) return caso
  return {
    ...caso,
    ocupacion_label: ocupacionLabelFromCaso(caso)
  }
}
