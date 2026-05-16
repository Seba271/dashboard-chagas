'use client'

import { useState, useMemo } from 'react'
import {
  ESTADO_OPTIONS,
  GENERO_OPTIONS,
  AGE_GROUP_OPTIONS
} from '@/lib/caseEnums'
import { sectorOptionLabel } from '@/lib/sectorDisplay'

function IconFunnel({ className }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M22 3H2l8 9.32V20l4 2v-9.68L22 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconChevron({ open, className }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Filtros globales del modelo epidemiológico (sector, estado, año, género, grupo etario).
 */
export default function DashboardGlobalFilters({
  globalYear,
  onGlobalYearChange,
  sectorId,
  onSectorChange,
  sectorOptions = [],
  estadoFilter,
  onEstadoChange,
  generoFilter,
  onGeneroChange,
  ageGroupFilter,
  onAgeGroupChange,
  ocupacionFilter = 'all',
  onOcupacionChange,
  ocupacionOptions = [],
  ocupacionLoading = false,
  onResetFilters
}) {
  const [open, setOpen] = useState(false)

  const activeCount = useMemo(() => {
    let n = 0
    if (globalYear !== 'all') n++
    if (sectorId && sectorId !== 'all') n++
    if (estadoFilter !== 'all') n++
    if (generoFilter !== 'all') n++
    if (ageGroupFilter !== 'all') n++
    if (ocupacionFilter && ocupacionFilter !== 'all') n++
    return n
  }, [globalYear, sectorId, estadoFilter, generoFilter, ageGroupFilter, ocupacionFilter])

  const yearChoices = () => {
    const y = new Date().getFullYear()
    const list = [{ value: 'all', label: 'Todos' }]
    for (let i = y + 1; i >= y - 5; i--) {
      list.push({ value: String(i), label: String(i) })
    }
    return list
  }

  const toggleId = 'dashboard-filters-panel'

  return (
    <section className="dashboardGlobalFilters no-print" aria-label="Filtros globales del dashboard">
      <div className="dashboardGlobalFiltersCard">
        <div className="dashboardFiltersToggleBarOuter">
          <button
            type="button"
            className="dashboardFiltersToggleBar dashboardFiltersToggleBar--main"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={toggleId}
            id="dashboard-filters-trigger"
          >
            <span className="dashboardFiltersToggleLeft">
              <span className="dashboardFiltersFunnelWrap" aria-hidden>
                <IconFunnel className="dashboardFiltersFunnelIcon" />
              </span>
              <span className="dashboardFiltersToggleText">Filtros del panel</span>
            </span>
          </button>
          <div className="dashboardFiltersToggleInfoSlot no-print">
            <span className="dashboardInfoTooltip">
              <button
                type="button"
                className="dashboardInfoTooltipBtn"
                aria-label="Ver qué recortan los filtros del panel"
                aria-describedby="filters-scope-tooltip"
              >
                i
              </button>
              <span id="filters-scope-tooltip" role="tooltip" className="dashboardInfoTooltipBubble">
                Año, sector (solo cuatro lugares poblados del programa), estado, género, grupo etario y ocupación recortan KPIs, mapa, ranking y demás
                gráficos del panel. Con año <strong>Todos</strong> se consideran todos los registros
                en base de datos (sin límite de fechas en el panel). El gráfico <em>Casos en el
                tiempo</em> tiene su propio rango Desde/Hasta debajo del gráfico.
              </span>
            </span>
          </div>
          {activeCount > 0 && (
            <button
              type="button"
              className="dashboardFiltersToggleBar dashboardFiltersToggleBar--badge"
              onClick={() => setOpen((v) => !v)}
              tabIndex={-1}
              aria-hidden="true"
            >
              <span className="dashboardFiltersBadge" aria-label={`${activeCount} filtros activos`}>
                {activeCount}
              </span>
            </button>
          )}
          <button
            type="button"
            className="dashboardFiltersToggleBar dashboardFiltersToggleBar--chevron"
            onClick={() => setOpen((v) => !v)}
            tabIndex={-1}
            aria-hidden="true"
          >
            <IconChevron open={open} className="dashboardFiltersChevron" />
          </button>
        </div>

        <div
          id={toggleId}
          role="region"
          aria-labelledby="dashboard-filters-trigger"
          hidden={!open}
          className="dashboardFiltersPanel"
        >
          <div className="dashboardFiltersRow">
            <div className="dashboardFiltersOneLine">
              <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-year" className="dashboardFilterInlineLabel">
                Año
              </label>
              <select
                id="dash-filter-year"
                className="dashboardFilterSelectCompact dashboardFilterSelectYear"
                value={globalYear}
                onChange={(e) => onGlobalYearChange(e.target.value)}
              >
                {yearChoices().map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="dashboardFiltersSep" aria-hidden />

            <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-sector" className="dashboardFilterInlineLabel">
                Sector
              </label>
              <select
                id="dash-filter-sector"
                className="dashboardFilterSelectCompact"
                value={sectorId}
                onChange={(e) => onSectorChange(e.target.value)}
              >
                <option value="all">Todos</option>
                {sectorOptions.map((s) => (
                  <option key={s.id_sector} value={String(s.id_sector)}>
                    {sectorOptionLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <span className="dashboardFiltersSep" aria-hidden />

            <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-estado" className="dashboardFilterInlineLabel">
                Estado
              </label>
              <select
                id="dash-filter-estado"
                className="dashboardFilterSelectCompact"
                value={estadoFilter}
                onChange={(e) => onEstadoChange(e.target.value)}
              >
                <option value="all">Todos</option>
                {ESTADO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="dashboardFiltersSep" aria-hidden />

            <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-genero" className="dashboardFilterInlineLabel">
                Género
              </label>
              <select
                id="dash-filter-genero"
                className="dashboardFilterSelectCompact"
                value={generoFilter}
                onChange={(e) => onGeneroChange(e.target.value)}
              >
                <option value="all">Todos</option>
                {GENERO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="dashboardFiltersSep" aria-hidden />

            <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-age" className="dashboardFilterInlineLabel">
                Grupo etario
              </label>
              <select
                id="dash-filter-age"
                className="dashboardFilterSelectCompact"
                value={ageGroupFilter}
                onChange={(e) => onAgeGroupChange(e.target.value)}
              >
                {AGE_GROUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="dashboardFiltersSep" aria-hidden />

            <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-ocupacion" className="dashboardFilterInlineLabel">
                Ocupación
              </label>
              <select
                id="dash-filter-ocupacion"
                className="dashboardFilterSelectCompact"
                value={ocupacionFilter}
                onChange={(e) => onOcupacionChange?.(e.target.value)}
                disabled={ocupacionLoading || ocupacionOptions.length === 0}
              >
                <option value="all">Todas</option>
                {ocupacionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {typeof onResetFilters === 'function' && (
            <div className="dashboardFiltersResetWrap">
              <button
                type="button"
                className="dashboardFiltersResetBtn"
                onClick={() => onResetFilters()}
                disabled={activeCount === 0}
                aria-label="Restablecer todos los filtros a valores por defecto"
              >
                Restablecer
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </section>
  )
}
