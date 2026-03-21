'use client'

import { useState, useMemo } from 'react'

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
      {/* Embudo estilo línea (filtro) */}
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
 * Filtros globales en una sola línea; panel desplegable al pulsar el icono embudo.
 */
export default function DashboardGlobalFilters({
  globalYear,
  onGlobalYearChange,
  globalComuna,
  onGlobalComunaChange,
  comunaOptions = [],
  caseTypeFilter,
  onCaseTypeChange,
  sexFilter,
  onSexChange,
  ageGroupFilter,
  onAgeGroupChange,
  onResetFilters
}) {
  const [open, setOpen] = useState(false)

  const activeCount = useMemo(() => {
    let n = 0
    if (globalYear !== 'all') n++
    if (globalComuna) n++
    if (caseTypeFilter !== 'all') n++
    if (sexFilter !== 'all') n++
    if (ageGroupFilter !== 'all') n++
    return n
  }, [globalYear, globalComuna, caseTypeFilter, sexFilter, ageGroupFilter])

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
        <button
          type="button"
          className="dashboardFiltersToggleBar"
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
            {activeCount > 0 && (
              <span className="dashboardFiltersBadge" aria-label={`${activeCount} filtros activos`}>
                {activeCount}
              </span>
            )}
          </span>
          <IconChevron open={open} className="dashboardFiltersChevron" />
        </button>

        <div
          id={toggleId}
          role="region"
          aria-labelledby="dashboard-filters-trigger"
          hidden={!open}
          className="dashboardFiltersPanel"
        >
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
                title="Con año distinto de «Todos», el gráfico temporal usa 1 ene – fin de ese año"
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
              <label htmlFor="dash-filter-comuna" className="dashboardFilterInlineLabel">
                Comuna
              </label>
              <select
                id="dash-filter-comuna"
                className="dashboardFilterSelectCompact"
                value={globalComuna}
                onChange={(e) => onGlobalComunaChange(e.target.value)}
              >
                <option value="">Todas</option>
                {comunaOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <span className="dashboardFiltersSep" aria-hidden />

            <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-case" className="dashboardFilterInlineLabel">
                Tipo
              </label>
              <select
                id="dash-filter-case"
                className="dashboardFilterSelectCompact"
                value={caseTypeFilter}
                onChange={(e) => onCaseTypeChange(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="agudo">Agudos</option>
                <option value="bajo_control">Bajo control</option>
                <option value="gestante">Gestantes</option>
              </select>
            </div>

            <span className="dashboardFiltersSep" aria-hidden />

            <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-sex" className="dashboardFilterInlineLabel">
                Sexo
              </label>
              <select
                id="dash-filter-sex"
                className="dashboardFilterSelectCompact"
                value={sexFilter}
                onChange={(e) => onSexChange(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
              </select>
            </div>

            <span className="dashboardFiltersSep" aria-hidden />

            <div className="dashboardFilterChip">
              <label htmlFor="dash-filter-age" className="dashboardFilterInlineLabel">
                Edad
              </label>
              <select
                id="dash-filter-age"
                className="dashboardFilterSelectCompact"
                value={ageGroupFilter}
                onChange={(e) => onAgeGroupChange(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="0_14">0-14</option>
                <option value="15_29">15-29</option>
                <option value="30_44">30-44</option>
                <option value="45_59">45-59</option>
                <option value="60_plus">60+</option>
              </select>
            </div>

            {typeof onResetFilters === 'function' && (
              <div className="dashboardFiltersResetWrap">
                <button
                  type="button"
                  className="dashboardFiltersResetBtn"
                  onClick={() => onResetFilters()}
                  disabled={activeCount === 0}
                  aria-label="Restablecer todos los filtros a valores por defecto"
                  title="Quita año, comuna y perfil del caso (vuelve a «Todos»)"
                >
                  Restablecer
                </button>
              </div>
            )}
          </div>
          <p className="dashboardFilterHintInline">
            Mapa y ranking por comuna usan tipo, sexo y edad. El año acota el período del gráfico temporal.
          </p>
        </div>
      </div>
    </section>
  )
}
