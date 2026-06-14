/**
 * Tarjeta de KPI — estilos en globals.css (.dashboardKpiCard*).
 */

import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Skeleton from './Skeleton'

config.autoAddCss = false

export default function KpiCard({
  title,
  value,
  icon = null,
  color = '#0d9488',
  loading = false,
  subtitle = null
}) {
  const formatValue = (val) => {
    if (val === null || val === undefined) return 'N/A'
    if (typeof val === 'number') return val.toLocaleString('es-CL')
    return val
  }

  return (
    <article
      className="dashboardKpiCard"
      style={{ '--dashboard-kpi-accent': color }}
    >
      <div className="dashboardKpiCard__top">
        {icon ? (
          <span className="dashboardKpiCard__icon" aria-hidden="true">
            <FontAwesomeIcon icon={icon} />
          </span>
        ) : null}
        <h3 className="dashboardKpiCard__title">{title}</h3>
      </div>
      <div className="dashboardKpiCard__value">
        {loading ? <Skeleton block height="1.45rem" width="65%" /> : formatValue(value)}
      </div>
      <div className="dashboardKpiCard__accentBar" aria-hidden="true" />
      {subtitle ? <p className="dashboardKpiCard__subtitle">{subtitle}</p> : null}
    </article>
  )
}
