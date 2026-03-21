'use client'

import { useMemo, useState } from 'react'
import { useFollowupAlerts } from '@/src/hooks/useFollowupAlerts'
import { useOverdueFollowups } from '@/src/hooks/useOverdueFollowups'
import { downloadCsv } from '@/lib/csvExport'

const COLS = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'rut', label: 'RUT' },
  { key: 'comuna', label: 'Comuna' },
  { key: 'ultimo_control', label: 'Último control' },
  { key: 'proximo_control', label: 'Próximo control' },
  { key: 'dias_atraso', label: 'Días atraso' },
  { key: 'es_gestante', label: 'Gestante' }
]

export default function FollowupAlertsSection() {
  const { data: alerts, loading: alertsLoading, error: alertsError } = useFollowupAlerts()
  const { data: rows, loading: listLoading, error: listError } = useOverdueFollowups(1500)

  const [comunaFilter, setComunaFilter] = useState('')

  const filteredRows = useMemo(() => {
    if (!rows?.length) return []
    const q = comunaFilter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => (r.comuna || '').toLowerCase().includes(q))
  }, [rows, comunaFilter])

  const handleExport = () => {
    const exportRows = filteredRows.map((r) => ({
      ...r,
      es_gestante: r.es_gestante ? 'Sí' : 'No',
      ultimo_control: r.ultimo_control || '',
      proximo_control: r.proximo_control || ''
    }))
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(exportRows, COLS, `controles_atrasados_${stamp}.csv`)
  }

  const error = alertsError || listError

  return (
    <section className="followupSection" aria-labelledby="followup-heading">
      <header className="followupSectionHeader">
        <div className="followupSectionTitleRow">
          <span className="followupSectionTitleAccent" aria-hidden />
          <h2 id="followup-heading" className="followupSectionTitle">
            Seguimiento clínico
          </h2>
        </div>
        <p className="followupSectionSubtitle">
          Alertas operativas y listado de pacientes con próximo control vencido. Puedes filtrar por
          comuna y exportar el resultado.
        </p>
      </header>

      {error && (
        <div className="followupError">
          <strong>Seguimiento:</strong> {error}
        </div>
      )}

      <div className="followupAlertsGrid">
        <FollowupAlertCard
          icon={<IconAlertTriangle />}
          iconClass="followupAlertCardIconSvg followupAlertCardIconSvgDanger"
          label="Controles atrasados"
          value={alerts?.controles_atrasados}
          loading={alertsLoading}
          barColor="linear-gradient(90deg, #ef4444, #f87171)"
          valueColor="#b91c1c"
        />
        <FollowupAlertCard
          icon={<IconUser />}
          iconClass="followupAlertCardIconSvg followupAlertCardIconSvgWarning"
          label="Gestantes sin seguimiento reciente"
          subtitle="Sin control en 60 días o sin registro"
          value={alerts?.gestantes_sin_seguimiento}
          loading={alertsLoading}
          barColor="linear-gradient(90deg, #f59e0b, #fbbf24)"
          valueColor="#c2410c"
        />
        <FollowupAlertCard
          icon={<IconCalendar />}
          iconClass="followupAlertCardIconSvg followupAlertCardIconSvgAccent"
          label="Inasistencias (30 días)"
          value={alerts?.inasistentes_30d}
          loading={alertsLoading}
          barColor="linear-gradient(90deg, var(--dashboard-accent), #2dd4bf)"
          valueColor="#0f766e"
        />
      </div>

      <div className="followupPanel" style={{ marginTop: '1.25rem' }}>
        <div className="followupPanelToolbar">
          <h3 className="followupPanelTitle">
            <span className="followupPanelTitleIconSvg" aria-hidden>
              <IconList />
            </span>
            Casos con próximo control vencido
          </h3>
          <div className="followupToolbarActions">
            <label className="followupToolbarLabel">
              Filtrar comuna
              <input
                type="text"
                className="followupToolbarInput"
                value={comunaFilter}
                onChange={(e) => setComunaFilter(e.target.value)}
                placeholder="Ej: La Serena"
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="followupBtnExport"
              onClick={handleExport}
              disabled={!filteredRows.length || listLoading}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {listLoading ? (
          <div className="followupLoading">Cargando lista…</div>
        ) : (
          <div className="followupTableWrap">
            <table className="followupTable">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>RUT</th>
                  <th>Comuna</th>
                  <th>Último</th>
                  <th>Próximo</th>
                  <th>Atraso</th>
                  <th>Gest.</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="followupEmpty">
                        {rows?.length === 0
                          ? 'No hay registros con próximo control vencido.'
                          : 'Ninguna fila coincide con el filtro de comuna.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id_persona}>
                      <td style={{ maxWidth: '220px' }}>{r.nombre}</td>
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {r.rut}
                      </td>
                      <td>{r.comuna}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.ultimo_control || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{r.proximo_control}</td>
                      <td>
                        <span className="followupBadgeDelay">{r.dias_atraso} d</span>
                      </td>
                      <td>
                        {r.es_gestante ? (
                          <span className="followupBadgeGestante">Sí</span>
                        ) : (
                          <span className="followupBadgeNo">No</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="followupFooterNote">
          Exportación respeta el filtro de comuna · <strong>{filteredRows.length}</strong> fila(s)
          visible(s)
        </p>
      </div>
    </section>
  )
}

function FollowupAlertCard({
  icon,
  iconClass,
  label,
  subtitle,
  value,
  loading,
  barColor,
  valueColor
}) {
  const display =
    loading || value === undefined || value === null
      ? null
      : typeof value === 'number'
        ? value.toLocaleString('es-CL')
        : value

  return (
    <article className="followupAlertCard">
      <div className="followupAlertCardHead">
        <span className={iconClass} aria-hidden>
          {icon}
        </span>
        <div>
          <div className="followupAlertCardLabel">{label}</div>
          {subtitle && <div className="followupAlertCardSub">{subtitle}</div>}
        </div>
      </div>
      <div
        className="followupAlertCardValue"
        style={{ color: loading ? '#94a3b8' : valueColor || 'var(--dashboard-text)' }}
      >
        {loading ? <span className="followupAlertCardValueMuted">Cargando…</span> : display ?? '—'}
      </div>
      <div className="followupAlertCardBar" style={{ background: barColor }} />
    </article>
  )
}

function IconAlertTriangle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 9v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconList() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
