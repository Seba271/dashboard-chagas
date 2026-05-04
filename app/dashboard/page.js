/**
 * Dashboard epidemiológico (modelo anónimo, sin datos clínicos identificables).
 * Orden: filtros → KPIs → análisis (temporal + sector + estado) → mapa → registro de caso.
 */

'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { useSession } from '@/src/hooks/useSession'
import { useProfile } from '@/src/hooks/useProfile'
import { useSectors } from '@/src/hooks/useSectors'
import { useCasesDataset } from '@/src/hooks/useCasesDataset'
import { useOcupaciones } from '@/src/hooks/useOcupaciones'
import { usePrevYearCases } from '@/src/hooks/usePrevYearCases'
import {
  exportCasesSeriesCsv,
  exportSectorRankingCsv,
  exportEstadoBreakdownCsv
} from '@/lib/exportDashboardData'
import { schedulePrintChartResize } from '@/lib/printEchartsResize'
import { ESTADO_OPTIONS, ESTADO_LABEL, ESTADO_COLOR, ESTADO_VALUES } from '@/lib/caseEnums'
import KpiCard from '@/src/components/KpiCard'
import TendencyChart from '@/src/components/Charts/TendencyChart'
import SectorBarChart from '@/src/components/Charts/SectorBarChart'
import SectorRankingTable from '@/src/components/Charts/SectorRankingTable'
import AgeGenderPyramid from '@/src/components/Charts/AgeGenderPyramid'
import SectorEstadoMatrix from '@/src/components/Charts/SectorEstadoMatrix'
import DashboardGlobalFilters from '@/src/components/DashboardGlobalFilters'
import dynamic from 'next/dynamic'

const SimpleMap = dynamic(() => import('@/src/components/Map/SimpleMap'), {
  ssr: false,
  loading: () => <div className="dashboardMapLoading">Cargando mapa...</div>
})

function toLocalDateISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayPlusDaysLocal(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toLocalDateISO(d)
}

function minDateStr(a, b) {
  return a <= b ? a : b
}

function getDefaultDates() {
  const today = new Date()
  const from = new Date(today)
  from.setMonth(from.getMonth() - 12)
  return {
    from: toLocalDateISO(from),
    to: todayPlusDaysLocal(3)
  }
}

/** "hace 5 min", "hace 2 horas", "hace 3 días" o fecha exacta si es muy viejo. */
function formatRelativeTime(iso, now = Date.now()) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const diffMs = Math.max(0, now - t)
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'hace unos segundos'
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `hace ${diffHr} ${diffHr === 1 ? 'hora' : 'horas'}`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 30) return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: sessionLoading, error: sessionError } = useSession()
  const { loading: profileLoading, isAdmin, profile, canAccessDashboard } = useProfile(user)

  useEffect(() => {
    if (!user || profileLoading) return
    if (canAccessDashboard) return
    let cancelled = false
    ;(async () => {
      const supabase = createSupabaseClient()
      await supabase.auth.signOut()
      if (!cancelled) router.replace('/login?motivo=sin_acceso')
    })()
    return () => {
      cancelled = true
    }
  }, [user, profileLoading, canAccessDashboard, router])

  /** Ventana solo para el gráfico "Casos en el tiempo" y la serie año anterior (no recorta KPIs/mapas con año "Todos"). */
  const [dateFrom, setDateFrom] = useState(() => getDefaultDates().from)
  const [dateTo, setDateTo] = useState(() => getDefaultDates().to)
  const [globalYear, setGlobalYear] = useState('all')
  const [sectorId, setSectorId] = useState('all')
  const [estadoFilter, setEstadoFilter] = useState('all')
  const [generoFilter, setGeneroFilter] = useState('all')
  const [ageGroupFilter, setAgeGroupFilter] = useState('all')
  const [ocupacionFilter, setOcupacionFilter] = useState('all')

  const { data: sectors, loading: sectorsLoading, error: sectorsError } = useSectors()
  const { data: ocupaciones, loading: ocupacionesLoading } = useOcupaciones()

  const {
    data: cases,
    loading: casesLoading,
    error: casesError,
    refetch: refetchCases
  } = useCasesDataset({
    yearFilter: globalYear,
    /* Con año "Todos", el panel debe reflejar toda la base; el rango Desde/Hasta es solo del gráfico temporal. */
    dateFrom: globalYear === 'all' ? '' : dateFrom,
    dateTo: globalYear === 'all' ? '' : dateTo,
    sectorId,
    estadoFilter,
    generoFilter,
    ageGroupFilter,
    ocupacionFilter
  })

  /** Serie del período espejo del año anterior (para superponer en el gráfico temporal). */
  const { series: prevCasesSeries } = usePrevYearCases({
    yearFilter: globalYear,
    dateFrom,
    dateTo,
    sectorId,
    estadoFilter,
    generoFilter,
    ageGroupFilter,
    ocupacionFilter
  })

  /** Tick para que el "hace X min" del último update se actualice solo. */
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])

  /** Refresco suave (foco/visibilidad/intervalo) para reflejar inserts recientes. */
  useEffect(() => {
    if (typeof refetchCases !== 'function') return
    const onFocus = () => refetchCases()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refetchCases()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const id = window.setInterval(() => refetchCases(), 60000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearInterval(id)
    }
  }, [refetchCases])

  /** Ajuste de Desde/Hasta cuando cambia el año. */
  useEffect(() => {
    if (globalYear === 'all') {
      const d = getDefaultDates()
      setDateFrom(d.from)
      setDateTo(d.to)
      return
    }
    const y = parseInt(globalYear, 10)
    if (Number.isNaN(y)) return
    const hasta = todayPlusDaysLocal(3)
    setDateFrom(`${y}-01-01`)
    setDateTo(minDateStr(hasta, `${y}-12-31`))
  }, [globalYear])

  const resetFilters = useCallback(() => {
    setGlobalYear('all')
    setSectorId('all')
    setEstadoFilter('all')
    setGeneroFilter('all')
    setAgeGroupFilter('all')
    setOcupacionFilter('all')
  }, [])

  useEffect(() => {
    const onBeforePrint = () => schedulePrintChartResize()
    const onAfterPrint = () => schedulePrintChartResize()
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [])

  const totalCasos = cases?.length ?? 0

  /** Casos del mes en curso. */
  const casosDelMes = useMemo(() => {
    if (!cases?.length) return 0
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    return cases.filter((c) => typeof c.fecha_registro === 'string' && c.fecha_registro.startsWith(ym)).length
  }, [cases])

  /** Conteo por estado. */
  const estadoCounts = useMemo(() => {
    const acc = ESTADO_VALUES.reduce((m, k) => ({ ...m, [k]: 0 }), {})
    for (const c of cases || []) {
      if (acc[c.estado_actual] !== undefined) acc[c.estado_actual]++
    }
    return acc
  }, [cases])

  const estadoBreakdown = useMemo(
    () =>
      ESTADO_OPTIONS.map((o) => ({
        estado: o.value,
        label: o.label,
        value: estadoCounts[o.value] || 0,
        color: ESTADO_COLOR[o.value]
      })),
    [estadoCounts]
  )

  /** Indicadores operativos: backlog y magnitud de contactos directos (riesgo de red). */
  const casosSinTratar = (estadoCounts.nuevo || 0) + (estadoCounts.reingreso || 0)

  const contactosStats = useMemo(() => {
    let suma = 0
    for (const c of cases || []) {
      const n = Number(c.numero_contactos)
      if (Number.isFinite(n) && n >= 0) suma += n
    }
    const nCasos = cases?.length ?? 0
    const promedio = nCasos > 0 ? suma / nCasos : null
    return { suma, promedio }
  }, [cases])

  /** Última actualización del dataset (max actualizado_en o creado_en). */
  const lastUpdatedAt = useMemo(() => {
    if (!cases?.length) return null
    let max = null
    for (const c of cases) {
      const t = c.actualizado_en || c.creado_en
      if (!t) continue
      if (!max || t > max) max = t
    }
    return max
  }, [cases])

  const lastUpdatedRelative = useMemo(
    () => formatRelativeTime(lastUpdatedAt, nowTick),
    [lastUpdatedAt, nowTick]
  )

  const lastUpdatedAbsolute = useMemo(() => {
    if (!lastUpdatedAt) return null
    try {
      return new Date(lastUpdatedAt).toLocaleString('es-CL', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
    } catch (e) {
      return null
    }
  }, [lastUpdatedAt])

  /** Si pasaron más de 24 horas, marcamos el badge como "stale" (color naranja). */
  const lastUpdatedIsStale = useMemo(() => {
    if (!lastUpdatedAt) return false
    const diff = nowTick - new Date(lastUpdatedAt).getTime()
    return Number.isFinite(diff) && diff > 24 * 60 * 60 * 1000
  }, [lastUpdatedAt, nowTick])

  /** Edad mediana del dataset filtrado (entera, redondeada). */
  const edadStats = useMemo(() => {
    const edades = (cases || [])
      .map((c) => Number(c.edad))
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b)
    const n = edades.length
    if (n === 0) return { mediana: null, conEdad: 0 }
    const mid = Math.floor(n / 2)
    const mediana = n % 2 === 0 ? Math.round((edades[mid - 1] + edades[mid]) / 2) : edades[mid]
    return { mediana, conEdad: n }
  }, [cases])

  /** Serie temporal completa del dataset cargado (todos los días con casos). */
  const casesSeries = useMemo(() => {
    if (!cases?.length) return []
    const m = new Map()
    for (const c of cases) {
      const key = typeof c.fecha_registro === 'string' ? c.fecha_registro.slice(0, 10) : null
      if (!key) continue
      m.set(key, (m.get(key) || 0) + 1)
    }
    return [...m.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([month, value]) => ({ month, value }))
  }, [cases])

  /** Misma serie recortada al rango del gráfico temporal (export CSV coherente con lo que ves en el gráfico). */
  const casesSeriesForChart = useMemo(() => {
    if (!casesSeries.length || !dateFrom || !dateTo) return casesSeries
    return casesSeries.filter((p) => p.month >= dateFrom && p.month <= dateTo)
  }, [casesSeries, dateFrom, dateTo])

  /** Ranking por sector (cuenta + comuna). */
  const sectorRanking = useMemo(() => {
    if (!cases?.length) return []
    const m = new Map()
    for (const c of cases) {
      const key = c.id_sector
      if (key == null) continue
      const prev = m.get(key)
      if (prev) {
        prev.value += 1
      } else {
        m.set(key, {
          id_sector: key,
          sector: c.sector_nombre || `Sector ${key}`,
          comuna: c.sector_comuna || '',
          value: 1,
          lat: c.sector_lat,
          lon: c.sector_lon
        })
      }
    }
    return [...m.values()].sort((a, b) => b.value - a.value || (a.sector || '').localeCompare(b.sector || '', 'es'))
  }, [cases])

  /** Sectores con coordenadas válidas (todos los activos, para que el Voronoi divida bien el territorio). */
  const mapSectors = useMemo(() => {
    return (sectors || []).filter(
      (s) =>
        typeof s.latitud_centroide === 'number' &&
        typeof s.longitud_centroide === 'number' &&
        !Number.isNaN(s.latitud_centroide) &&
        !Number.isNaN(s.longitud_centroide)
    )
  }, [sectors])

  /** Mapa: si `ocupacion` coincide con un `codigo` del catálogo, mostramos el `nombre`. */
  const casesForMap = useMemo(() => {
    const labelBy = new Map((ocupaciones || []).map((o) => [o.value, o.label]))
    return (cases || []).map((c) => ({
      ...c,
      ocupacion_label: c.ocupacion ? labelBy.get(c.ocupacion) ?? null : null
    }))
  }, [cases, ocupaciones])

  /** % por estado sobre total filtrado. */
  const pct = useCallback(
    (n) => (totalCasos > 0 ? (n / totalCasos) * 100 : 0),
    [totalCasos]
  )

  const filterSummary = useMemo(() => {
    const parts = []
    if (globalYear !== 'all') parts.push(`Año ${globalYear}`)
    else parts.push('Todos los años')
    if (sectorId && sectorId !== 'all') {
      const s = (sectors || []).find((x) => String(x.id_sector) === String(sectorId))
      parts.push(`Sector: ${s?.nombre_sector ?? sectorId}`)
    } else {
      parts.push('Todos los sectores')
    }
    if (estadoFilter !== 'all') parts.push(`Estado: ${ESTADO_LABEL[estadoFilter] || estadoFilter}`)
    if (generoFilter !== 'all') parts.push(`Género: ${generoFilter}`)
    if (ageGroupFilter !== 'all') parts.push(`Edad: ${ageGroupFilter}`)
    if (ocupacionFilter && ocupacionFilter !== 'all') {
      const o = (ocupaciones || []).find((x) => x.value === ocupacionFilter)
      parts.push(`Ocupación: ${o?.label ?? ocupacionFilter}`)
    }
    return parts.join(' · ')
  }, [globalYear, sectorId, sectors, estadoFilter, generoFilter, ageGroupFilter, ocupacionFilter, ocupaciones])

  const handleLogout = async () => {
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) console.error('Error al cerrar sesión:', error)
      else {
        router.push('/login')
        router.refresh()
      }
    } catch (err) {
      console.error('Error inesperado al cerrar sesión:', err)
    }
  }

  if (sessionLoading || (user && profileLoading)) {
    return (
      <div className="dashboardStateScreen">
        <p>Cargando dashboard...</p>
      </div>
    )
  }

  if (sessionError && !user) {
    return (
      <div className="dashboardStateScreen">
        <div className="dashboardStateCard">
          <p className="dashboardStateError">{sessionError}</p>
          <button type="button" className="dashboardStateBtnPrimary" onClick={() => router.push('/login')}>
            Ir a Login
          </button>
        </div>
      </div>
    )
  }

  if (user && !profileLoading && !canAccessDashboard) {
    return (
      <div className="dashboardStateScreen">
        <p>Esta cuenta no tiene acceso al panel. Cerrando sesión…</p>
      </div>
    )
  }

  return (
    <div className="dashboard-shell dashboardPageRoot">
      <div className="print-only printHeader">
        <h1>Dashboard Chagas — Resumen epidemiológico</h1>
        <p>{new Date().toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })}</p>
      </div>

      <header className="dashboardPageHeader no-print">
        <div className="dashboardPageHeaderTitles">
          <h1>Dashboard Chagas</h1>
          <p>Registro epidemiológico anónimo — Monte Patria</p>
          {lastUpdatedRelative && (
            <span
              className={`dashboardLastUpdated${lastUpdatedIsStale ? ' dashboardLastUpdated--stale' : ''}`}
              title={lastUpdatedAbsolute || ''}
              aria-label={`Datos actualizados ${lastUpdatedRelative}${lastUpdatedAbsolute ? ` — ${lastUpdatedAbsolute}` : ''}`}
            >
              <span className="dashboardLastUpdatedDot" aria-hidden />
              Actualizado {lastUpdatedRelative}
            </span>
          )}
        </div>
        <div className="dashboardPageHeaderActions">
          {isAdmin && (
            <Link
              href="/dashboard/admin"
              className="dashboardHeaderBtn dashboardHeaderBtn--admin"
              title="Gestionar usuarios con acceso al panel epidemiológico"
            >
              <svg className="dashboardHeaderBtnIcon" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0h-.29c-.45 1.43-1.74 2.63-3.71 2.91V19h8v-2.5c0-1.52-2.33-2.7-4-3.16z"
                  fill="currentColor"
                />
              </svg>
              Usuarios y permisos
            </Link>
          )}
          <button
            type="button"
            className="dashboardHeaderBtn dashboardHeaderBtn--secondary"
            onClick={() => window.print()}
            aria-label="Imprimir resumen del dashboard"
          >
            <svg className="dashboardHeaderBtnIcon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 14H8v-4h8v4zm2-4v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4h-2z"
                fill="currentColor"
              />
            </svg>
            Imprimir resumen
          </button>
          <div className="dashboardUserBlock">
            <span>Usuario</span>
            <strong>{user?.email || 'N/A'}</strong>
            {!profileLoading && profile && (
              <span className="dashboardUserRole">{isAdmin ? 'Administrador' : 'Solo lectura'}</span>
            )}
          </div>
          <button
            type="button"
            className="dashboardHeaderBtn dashboardHeaderBtn--logout"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
          >
            <svg className="dashboardHeaderBtnIcon" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"
                fill="currentColor"
              />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="dashboardMain">
        {/* 1. Filtros */}
        <DashboardGlobalFilters
          globalYear={globalYear}
          onGlobalYearChange={setGlobalYear}
          sectorId={sectorId}
          onSectorChange={setSectorId}
          sectorOptions={sectors || []}
          estadoFilter={estadoFilter}
          onEstadoChange={setEstadoFilter}
          generoFilter={generoFilter}
          onGeneroChange={setGeneroFilter}
          ageGroupFilter={ageGroupFilter}
          onAgeGroupChange={setAgeGroupFilter}
          ocupacionFilter={ocupacionFilter}
          onOcupacionChange={setOcupacionFilter}
          ocupacionOptions={ocupaciones || []}
          ocupacionLoading={ocupacionesLoading}
          onResetFilters={resetFilters}
        />

        {/* 2. KPIs */}
        <section className="dashboardSection" aria-labelledby="kpi-heading">
          <div className="dashboardSectionHead">
            <h2 id="kpi-heading" className="dashboardSectionTitle">
              Indicadores epidemiológicos
            </h2>
          </div>

          {(casesError || sectorsError) && (
            <div className="dashboardErrorBox">
              {casesError ? `Error al cargar casos: ${casesError}` : ''}
              {sectorsError ? ` Error al cargar sectores: ${sectorsError}` : ''}
            </div>
          )}

          <div className="dashboardKpiGroup">
            <h3 className="dashboardSubsectionTitle">Casos</h3>
            <div className="kpiGrid">
              <KpiCard
                title="Total casos"
                value={totalCasos}
                icon="🗂️"
                color="#0d9488"
                loading={casesLoading}
                subtitle={filterSummary}
              />
              <KpiCard
                title="Casos del mes"
                value={casosDelMes}
                icon="📅"
                color="#0ea5e9"
                loading={casesLoading}
                subtitle="Mes calendario actual"
              />
            </div>
          </div>

          <div className="dashboardKpiGroup">
            <h3 className="dashboardSubsectionTitle">Distribución por estado</h3>
            <div className="kpiGrid">
              {estadoBreakdown.map((row) => (
                <KpiCard
                  key={row.estado}
                  title={row.label}
                  value={casesLoading ? 'Cargando...' : `${row.value.toLocaleString('es-CL')} (${pct(row.value).toFixed(1)} %)`}
                  icon={row.estado === 'nuevo' ? '✨' : row.estado === 'reingreso' ? '↩️' : '✅'}
                  color={row.color}
                  loading={casesLoading}
                />
              ))}
            </div>
          </div>

          <div className="dashboardKpiGroup">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 className="dashboardSubsectionTitle" style={{ margin: 0 }}>
                Indicadores operativos
              </h3>
              <span className="dashboardInfoTooltip">
                <button
                  type="button"
                  className="dashboardInfoTooltipBtn"
                  aria-label="Ver definición de los indicadores operativos"
                  aria-describedby="ops-info-tooltip"
                >
                  i
                </button>
                <span
                  id="ops-info-tooltip"
                  role="tooltip"
                  className="dashboardInfoTooltipBubble"
                >
                  <strong>Casos sin tratar:</strong> suma de casos en estado{' '}
                  <span style={{ color: '#fca5a5', fontWeight: 600 }}>nuevo</span> y{' '}
                  <span style={{ color: '#fcd34d', fontWeight: 600 }}>reingreso</span> — son los que
                  el programa todavía debe atender.{' '}
                  <strong>Contactos directos:</strong> suma del campo{' '}
                  <em>cantidad de contactos directos</em> en los casos del filtro (solo cantidades,
                  sin datos identificables). <strong>Edad mediana:</strong> mitad de los casos tiene
                  edad inferior y mitad superior a este valor.
                </span>
              </span>
            </div>
            <div className="kpiGrid" style={{ marginTop: '0.65rem' }}>
              <KpiCard
                title="Casos sin tratar"
                value={casosSinTratar}
                icon="⚠️"
                color="#dc2626"
                loading={casesLoading}
                subtitle="Nuevos + reingresos del filtro"
              />
              <KpiCard
                title="Contactos directos (total)"
                value={
                  casesLoading
                    ? 'Cargando...'
                    : totalCasos > 0
                      ? contactosStats.suma.toLocaleString('es-CL')
                      : '—'
                }
                icon="🔗"
                color="#0d9488"
                loading={casesLoading}
                subtitle={
                  totalCasos > 0 && contactosStats.promedio != null
                    ? `Promedio ${contactosStats.promedio.toFixed(1)} contactos por caso en el filtro`
                    : 'Sin casos en el filtro'
                }
              />
              <KpiCard
                title="Edad mediana"
                value={edadStats.mediana != null ? `${edadStats.mediana} años` : '—'}
                icon="🧬"
                color="#7c3aed"
                loading={casesLoading}
                subtitle={
                  edadStats.conEdad > 0
                    ? `Sobre ${edadStats.conEdad.toLocaleString('es-CL')} ${edadStats.conEdad === 1 ? 'caso' : 'casos'} con edad`
                    : 'Sin edades registradas'
                }
              />
            </div>
          </div>
        </section>

        {/* 3. Demografía: pirámide poblacional */}
        <section className="dashboardSection dashboardDemographicsSection" aria-labelledby="demo-heading">
          <div className="dashboardSectionHead">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 id="demo-heading" className="dashboardSectionTitle" style={{ margin: 0 }}>
                Distribución demográfica
              </h2>
              <span className="dashboardInfoTooltip">
                <button
                  type="button"
                  className="dashboardInfoTooltipBtn"
                  aria-label="Ver cómo leer la pirámide poblacional"
                  aria-describedby="demo-info-tooltip"
                >
                  i
                </button>
                <span
                  id="demo-info-tooltip"
                  role="tooltip"
                  className="dashboardInfoTooltipBubble"
                >
                  Casos del filtro por grupo etario:{' '}
                  <span style={{ color: '#93c5fd', fontWeight: 600 }}>Masculino</span> y{' '}
                  <span style={{ color: '#a855f7', fontWeight: 600 }}>Otro</span> a la izquierda;{' '}
                  <span style={{ color: '#f9a8d4', fontWeight: 600 }}>Femenino</span> y{' '}
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>No informa</span> a la derecha.
                  Sin edad o con género no reconocido van al pie del gráfico.
                </span>
              </span>
            </div>
          </div>
          <AgeGenderPyramid cases={cases || []} loading={casesLoading} />
        </section>

        {/* 4. Análisis: temporal + sectores */}
        <section className="dashboardSection dashboardAnalysisSection" aria-labelledby="analysis-heading">
          <div className="dashboardSectionActionsRow dashboardAnalysisHead">
            <div>
              <h2 id="analysis-heading" className="dashboardSectionTitle">
                Análisis temporal y por sector
              </h2>
              <p className="dashboardSectionLead dashboardSectionLeadTight">
                Serie de casos por fecha de registro, ranking por sector y distribución por estado.
              </p>
              <p className="print-only printPeriodLine">
                <strong>Período del gráfico temporal:</strong> {dateFrom} al {dateTo}
              </p>
            </div>
            <div className="dashboardSectionActions no-print">
              <button
                type="button"
                className="dashboardExportBtn"
                disabled={!casesSeriesForChart.length}
                onClick={() => exportCasesSeriesCsv(casesSeriesForChart, `casos_temporal_${dateFrom}_${dateTo}.csv`)}
                aria-label="Exportar serie temporal de casos a CSV"
              >
                CSV — Casos
              </button>
              <button
                type="button"
                className="dashboardExportBtn"
                disabled={!sectorRanking.length}
                onClick={() => exportSectorRankingCsv(sectorRanking, `casos_por_sector_${globalYear}.csv`)}
                aria-label="Exportar ranking por sector a CSV"
              >
                CSV — Sectores
              </button>
              <button
                type="button"
                className="dashboardExportBtn"
                disabled={!estadoBreakdown.some((r) => r.value > 0)}
                onClick={() => exportEstadoBreakdownCsv(estadoBreakdown, `casos_por_estado_${globalYear}.csv`)}
                aria-label="Exportar distribución por estado a CSV"
              >
                CSV — Estado
              </button>
            </div>
          </div>

          <div className="dashboardChartsGrid">
            <div className="dashboardChartColumn dashboardChartColumn--full">
              <TendencyChart
                casesData={casesSeriesForChart}
                prevCasesData={prevCasesSeries}
                rangeFrom={dateFrom}
                rangeTo={dateTo}
                title="Casos en el tiempo"
                type="line"
                loading={casesLoading}
                controls={
                  <div className="chartControls chartControlsDates">
                    <label className="chartControlsLabel" htmlFor="dash-date-from">
                      Desde
                    </label>
                    <input
                      id="dash-date-from"
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      max={dateTo}
                      className="chartControlsInput"
                      disabled={globalYear !== 'all'}
                      aria-label="Fecha inicial del gráfico temporal"
                    />
                    <label className="chartControlsLabel" htmlFor="dash-date-to">
                      Hasta
                    </label>
                    <input
                      id="dash-date-to"
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      min={dateFrom}
                      className="chartControlsInput"
                      disabled={globalYear !== 'all'}
                      aria-label="Fecha final del gráfico temporal"
                    />
                  </div>
                }
              />
            </div>

            <div className="dashboardChartColumn dashboardChartColumn--barWide">
              <SectorBarChart
                data={sectorRanking}
                title={
                  sectorId !== 'all'
                    ? `Casos en sector seleccionado`
                    : 'Casos por sector'
                }
                loading={casesLoading || sectorsLoading}
                controls={
                  <p className="chartFilterNote">
                    Mismos filtros del panel (sector, estado, género, edad, ocupación). Con año{' '}
                    <strong>Todos</strong> el conteo incluye toda la historia; el gráfico temporal usa el
                    rango Desde/Hasta de esa tarjeta.
                  </p>
                }
              />
            </div>

            <div className="dashboardChartColumn dashboardChartColumn--rankNarrow">
              <SectorRankingTable
                data={sectorRanking}
                loading={casesLoading || sectorsLoading}
                compact
              />
            </div>
          </div>
        </section>

        {/* 5. Sectores con casos pendientes — nueva hoja al imprimir */}
        <section className="dashboardSection dashboardSectorsMatrixSection" aria-labelledby="matrix-heading">
          <div className="dashboardSectionHead">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 id="matrix-heading" className="dashboardSectionTitle" style={{ margin: 0 }}>
                Sectores con casos pendientes
              </h2>
              <span className="dashboardInfoTooltip">
                <button
                  type="button"
                  className="dashboardInfoTooltipBtn"
                  aria-label="Ver cómo leer la matriz de sectores y estados"
                  aria-describedby="matrix-info-tooltip"
                >
                  i
                </button>
                <span
                  id="matrix-info-tooltip"
                  role="tooltip"
                  className="dashboardInfoTooltipBubble"
                >
                  Cada celda muestra cuántos casos hay en ese sector para cada estado. La
                  intensidad del color es relativa al máximo de la columna — cuanto más oscura,
                  más casos. La columna{' '}
                  <span style={{ color: '#fca5a5', fontWeight: 600 }}>Sin tratar</span> destaca los
                  sectores prioritarios (suma de nuevo + reingreso). Hacé clic en una columna para
                  ordenar por ese estado.
                </span>
              </span>
            </div>
          </div>
          <SectorEstadoMatrix cases={cases || []} loading={casesLoading} />
        </section>

        {/* 6. Mapa territorial por sector */}
        <section className="dashboardSection dashboardMapSection no-print" aria-labelledby="map-heading">
          <div className="dashboardSectionHead">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 id="map-heading" className="dashboardSectionTitle" style={{ margin: 0 }}>
                Mapa territorial por sector
              </h2>
              <span className="dashboardInfoTooltip">
                <button
                  type="button"
                  className="dashboardInfoTooltipBtn"
                  aria-label="Ver cómo leer el mapa territorial"
                  aria-describedby="map-info-tooltip"
                >
                  i
                </button>
                <span id="map-info-tooltip" role="tooltip" className="dashboardInfoTooltipBubble">
                  Cada sector se oscurece según su volumen de casos. Los puntos representan casos
                  individuales anclados al centroide del sector (con un leve corrimiento solo para
                  separarlos visualmente) y color por estado (
                  <span style={{ color: '#fca5a5', fontWeight: 600 }}>rojo: nuevo</span>,{' '}
                  <span style={{ color: '#fcd34d', fontWeight: 600 }}>amarillo: reingreso</span>,{' '}
                  <span style={{ color: '#86efac', fontWeight: 600 }}>verde: tratado</span>). Al
                  hacer clic en un punto se abre el detalle del caso, incluida la cantidad de
                  contactos directos como indicador epidemiológico. Datos anónimos y agregados.
                </span>
              </span>
            </div>
          </div>
          <div className="dashboardMapCard">
            <SimpleMap
              sectors={mapSectors}
              cases={casesForMap}
              loading={casesLoading || sectorsLoading}
            />
          </div>
        </section>

      </main>
    </div>
  )
}
