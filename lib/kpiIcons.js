import {
  faArrowRotateLeft,
  faCalendarDays,
  faCircleCheck,
  faCirclePlus,
  faClipboardList,
  faTriangleExclamation,
  faUserClock,
  faUserGroup
} from '@fortawesome/free-solid-svg-icons'

/** Iconos KPI — estilo sólido (equivalente libre al pack Sharp de Font Awesome). */
export const KPI_ICONS = {
  totalCasos: faClipboardList,
  casosMes: faCalendarDays,
  nuevo: faCirclePlus,
  reingreso: faArrowRotateLeft,
  tratado: faCircleCheck,
  sinTratar: faTriangleExclamation,
  contactos: faUserGroup,
  edadMediana: faUserClock
}

export const ESTADO_KPI_ICONS = {
  nuevo: KPI_ICONS.nuevo,
  reingreso: KPI_ICONS.reingreso,
  tratado: KPI_ICONS.tratado
}
