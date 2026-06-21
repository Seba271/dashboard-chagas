/**
 * Dashboard epidemiológico (modelo anónimo, sin datos clínicos identificables).
 * Orden: filtros → KPIs → análisis (temporal + sector + estado) → mapa → registro de caso.
 */

'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
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
  exportMonthlyYoYComparisonCsv,
  exportSectorRankingCsv,
  exportEstadoBreakdownCsv
} from '@/lib/exportDashboardData'
import { openDashboardPrintDialog, restoreDashboardAfterPrint } from '@/lib/printEchartsResize'
import { enrichCaseOcupacion } from '@/lib/ocupacionDisplay'
import {
  ESTADO_OPTIONS,
  ESTADO_LABEL,
  ESTADO_COLOR,
  ESTADO_VALUES,
  AGE_GROUP_OPTIONS
} from '@/lib/caseEnums'
import { ageCompletedAtReference } from '@/lib/ageFromBirthDate'
import DashboardLoadingSplash from '@/src/components/DashboardLoadingSplash'
import KpiCard from '@/src/components/KpiCard'
import { ESTADO_KPI_ICONS, KPI_ICONS } from '@/lib/kpiIcons'
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

/** Refresco automático del dataset de casos (solo intervalo; foco/pestaña sigue refrescando al volver). */
const CASES_BACKGROUND_REFETCH_MS = 10 * 60 * 1000

/** El mapa territorial solo sincroniza datos cada 10 min (o al cambiar filtros). */
const MAP_DATA_REFRESH_MS = 10 * 60 * 1000

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
  const [loggingOut, setLoggingOut] = useState(false)

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

  /** Rango visual del temporal: con año «Todos», comparemos año calendario actual vs el anterior en 12 puntos mensuales. */
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

  const sectorScopeReady = !sectorsLoading
  const sectorScopeIds = useMemo(() => (sectors ?? []).map((s) => s.id_sector), [sectors])

  useEffect(() => {
    if (!sectors?.length || sectorId === 'all') return
    const ok = sectors.some((s) => String(s.id_sector) === String(sectorId))
    if (!ok) setSectorId('all')
  }, [sectors, sectorId])

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
    ocupacionFilter,
    sectorScopeReady,
    sectorScopeIds
  })

  /** Serie del período espejo del año anterior (solo cuando un año específico está el filtro; con «Todos» el YoY viene del año calendario armado en cliente). */
  const { series: prevCasesSeries } = usePrevYearCases({
    yearFilter: globalYear,
    dateFrom,
    dateTo,
    sectorId,
    estadoFilter,
    generoFilter,
    ageGroupFilter,
    ocupacionFilter,
    sectorScopeReady,
    sectorScopeIds,
    /* Solo consulta servidor cuando hay un año fijo en el panel; modo «Todos» usa agregados mensuales por año natural desde `cases`. */
    enabled: globalYear !== 'all'
  })

  /** Tick para que el "hace X min" del último update se actualice solo. */
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])

  const mapFilterKey = useMemo(
    () =>
      JSON.stringify({
        globalYear,
        dateFrom,
        dateTo,
        sectorId,
        estadoFilter,
        generoFilter,
        ageGroupFilter,
        ocupacionFilter
      }),
    [
      globalYear,
      dateFrom,
      dateTo,
      sectorId,
      estadoFilter,
      generoFilter,
      ageGroupFilter,
      ocupacionFilter
    ]
  )

  const [mapCasesSnapshot, setMapCasesSnapshot] = useState(null)
  const mapSyncRef = useRef({ syncedAt: 0 })
  // needsMapUpdateRef se pone true cuando cambian los filtros o en la carga inicial.
  // Solo se aplica al snapshot cuando los casos ya terminaron de cargar (datos frescos).
  const needsMapUpdateRef = useRef(true)
  const casesRef = useRef(cases)
  casesRef.current = cases

  // Marcar que el mapa necesita actualizarse cuando cambian los filtros.
  // NO se actualiza el snapshot aquí: los casos aún corresponden al filtro anterior.
  useEffect(() => {
    needsMapUpdateRef.current = true
  }, [mapFilterKey])

  // Aplicar el snapshot solo cuando los casos terminaron de cargarse Y hay un update pendiente.
  // Así el mapa siempre muestra datos que coinciden con el filtro activo.
  useEffect(() => {
    if (cases == null || casesLoading) return
    if (!needsMapUpdateRef.current) return
    needsMapUpdateRef.current = false
    mapSyncRef.current.syncedAt = Date.now()
    setMapCasesSnapshot(cases)
  }, [cases, casesLoading])

  // Refresco en segundo plano cada 10 min (independiente de cambios de filtro).
  useEffect(() => {
    const id = window.setInterval(() => {
      const latest = casesRef.current
      if (latest == null) return
      mapSyncRef.current.syncedAt = Date.now()
      setMapCasesSnapshot(latest)
    }, MAP_DATA_REFRESH_MS)
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
    const id = window.setInterval(() => refetchCases(), CASES_BACKGROUND_REFETCH_MS)
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
    const onAfterPrint = () => restoreDashboardAfterPrint()
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
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

  /** Edad mediana al registro del dataset filtrado (deducida de fecha_nacimiento; entera). */
  const edadStats = useMemo(() => {
    const edades = (cases || [])
      .map((c) => ageCompletedAtReference(c.fecha_nacimiento, c.fecha_registro))
      .filter((n) => typeof n === 'number' && n >= 0)
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

  /** Misma serie recortada al rango del gráfico temporal cuando hay un año fijo en el panel (CSV y curva día a día / semanal). */
  const casesSeriesForChart = useMemo(() => {
    if (!casesSeries.length || !dateFrom || !dateTo) return casesSeries
    return casesSeries.filter((p) => p.month >= dateFrom && p.month <= dateTo)
  }, [casesSeries, dateFrom, dateTo])

  /** Año natural ancla para el modo «Todos» (se actualiza cada pocos minutos con nowTick; tras Año Nuevo la sesión larga sigue enlazando al año nuevo). */
  const temporalCalendarYoYAnchor = useMemo(() => {
    const d = new Date(nowTick)
    return d.getFullYear()
  }, [nowTick])

  /**
   * Con año «Todos»: 12 puntos mensuales (primer día ISO) año calendario ancla vs año calendario previo superpuesto al mismo mes.
   * Con año fijo continúan las series día-a-día (o granularidad habitual) dentro de dateFrom/dateTo y prevCasesSeries desde Supabase.
   */
  const calendarYoYMonthly = useMemo(() => {
    if (globalYear !== 'all') {
      return {
        anchor: null,
        casesCurr: null,
        prevShifted: null,
        rangeFrom: '',
        rangeTo: ''
      }
    }
    const anchor = temporalCalendarYoYAnchor
    const yPrev = anchor - 1

    const monthCurr = new Map()
    const monthPrev = new Map()

    for (const c of cases || []) {
      const raw = typeof c.fecha_registro === 'string' ? c.fecha_registro.slice(0, 10) : null
      if (!raw || raw.length < 7) continue
      const yy = Number.parseInt(raw.slice(0, 4), 10)
      const ym = raw.slice(0, 7)
      if (!Number.isFinite(yy)) continue
      if (yy === anchor) monthCurr.set(ym, (monthCurr.get(ym) || 0) + 1)
      if (yy === yPrev) monthPrev.set(ym, (monthPrev.get(ym) || 0) + 1)
    }

    const casesCurr = []
    const prevShifted = []
    for (let m = 1; m <= 12; m++) {
      const pad = String(m).padStart(2, '0')
      const bucket = `${anchor}-${pad}-01`
      const ymCurr = `${anchor}-${pad}`
      const ymPrev = `${yPrev}-${pad}`
      casesCurr.push({ month: bucket, value: monthCurr.get(ymCurr) || 0 })
      prevShifted.push({ month: bucket, value: monthPrev.get(ymPrev) || 0 })
    }

    return {
      anchor,
      casesCurr,
      prevShifted,
      rangeFrom: `${anchor}-01-01`,
      rangeTo: `${anchor}-12-31`
    }
  }, [cases, globalYear, temporalCalendarYoYAnchor])

  const tendencyCasesPrimary =
    globalYear === 'all' ? calendarYoYMonthly.casesCurr ?? [] : casesSeriesForChart
  const tendencyPrevSeries =
    globalYear === 'all' ? calendarYoYMonthly.prevShifted ?? [] : prevCasesSeries
  const tendencyRangeFrom = globalYear === 'all' ? calendarYoYMonthly.rangeFrom || '' : dateFrom
  const tendencyRangeTo = globalYear === 'all' ? calendarYoYMonthly.rangeTo || '' : dateTo
  const tendencyComparisonYearStr =
    globalYear === 'all'
      ? String(calendarYoYMonthly.anchor ?? temporalCalendarYoYAnchor)
      : String(globalYear)

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

  /** Mapa: etiqueta desde FK → `catalogo_ocupaciones.nombre`. */
  const casesForMap = useMemo(
    () => (mapCasesSnapshot ?? []).map((c) => enrichCaseOcupacion(c)),
    [mapCasesSnapshot]
  )

  const mapInitialLoading =
    (sectorsLoading && !(sectors?.length)) || (casesLoading && mapCasesSnapshot === null)

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
    if (ageGroupFilter !== 'all') {
      const ageLbl = AGE_GROUP_OPTIONS.find((o) => o.value === ageGroupFilter)?.label ?? ageGroupFilter
      parts.push(`Grupo etario: ${ageLbl}`)
    }
    if (ocupacionFilter && ocupacionFilter !== 'all') {
      const o = (ocupaciones || []).find(
        (x) => String(x.id_ocupacion) === String(ocupacionFilter)
      )
      parts.push(`Ocupación: ${o?.nombre ?? ocupacionFilter}`)
    }
    return parts.join(' · ')
  }, [globalYear, sectorId, sectors, estadoFilter, generoFilter, ageGroupFilter, ocupacionFilter, ocupaciones])

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const supabase = createSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error al cerrar sesión:', error)
        setLoggingOut(false)
        return
      }
      router.push('/login')
      router.refresh()
    } catch (err) {
      console.error('Error inesperado al cerrar sesión:', err)
      setLoggingOut(false)
    }
  }

  if (sessionLoading || (user && profileLoading)) {
    return (
      <div className="dashboardStateScreen dashboardStateScreen--splash">
        <DashboardLoadingSplash />
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
      <div className="dashboardStateScreen dashboardStateScreen--splash">
        <DashboardLoadingSplash
          title="Cerrando sesión"
          subtitle="Esta cuenta no tiene acceso al panel. Te redirigimos para iniciar con otra credencial si corresponde…"
        />
      </div>
    )
  }

  if (loggingOut) {
    return (
      <div className="dashboardStateScreen dashboardStateScreen--splash">
        <DashboardLoadingSplash title="Cerrando sesión" subtitle="Esperá un momento, cerramos tu sesión de forma segura…" />
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
          <p>
            Análisis epidemiológico — Carén, El Palqui, Chañaral Alto y Monte Patria
          </p>
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
          <div className="dashboardHeaderTools">
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
              onClick={() => openDashboardPrintDialog()}
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
          </div>
          <div className="dashboardHeaderAccount">
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
                icon={KPI_ICONS.totalCasos}
                color="#0d9488"
                loading={casesLoading}
                subtitle={filterSummary}
              />
              <KpiCard
                title="Casos del mes"
                value={casosDelMes}
                icon={KPI_ICONS.casosMes}
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
                  icon={ESTADO_KPI_ICONS[row.estado]}
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
                  sin datos identificables).{' '}
                  <strong>Edad mediana al registro:</strong> mitad de los casos tiene edad menor y mitad mayor
                  a esta (calculada con fecha de nacimiento respecto de la fecha de registro).
                </span>
              </span>
            </div>
            <div className="kpiGrid" style={{ marginTop: '0.65rem' }}>
              <KpiCard
                title="Casos sin tratar"
                value={casosSinTratar}
                icon={KPI_ICONS.sinTratar}
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
                icon={KPI_ICONS.contactos}
                color="#0d9488"
                loading={casesLoading}
                subtitle={
                  totalCasos > 0 && contactosStats.promedio != null
                    ? `Promedio ${contactosStats.promedio.toFixed(1)} contactos por caso en el filtro`
                    : 'Sin casos en el filtro'
                }
              />
              <KpiCard
                title="Edad mediana al registro"
                value={edadStats.mediana != null ? `${edadStats.mediana} años` : '—'}
                icon={KPI_ICONS.edadMediana}
                color="#7c3aed"
                loading={casesLoading}
                subtitle={
                  edadStats.conEdad > 0
                    ? `Sobre ${edadStats.conEdad.toLocaleString('es-CL')} ${edadStats.conEdad === 1 ? 'caso' : 'casos'} con fecha de nacimiento`
                    : 'Sin fecha de nacimiento en los casos del filtro'
                }
              />
            </div>
          </div>
        </section>

        {/* 3. Demografía: pirámide poblacional */}
        <section className="dashboardSection dashboardDemographicsSection" aria-labelledby="demo-heading">
          <div className="dashboardSectionHead">
            <div className="dashboardDemoTitleRow">
              <h2 id="demo-heading" className="dashboardSectionTitle">
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
                  Casos del filtro por grupo etario (intervalos de 5 años hasta 75–79 y grupo 80+):{' '}
                  <span style={{ color: '#93c5fd', fontWeight: 600 }}>Masculino</span> y{' '}
                  <span style={{ color: '#a855f7', fontWeight: 600 }}>Otro</span> quedan a la izquierda
                  como segmentos que se suman desde el centro;{' '}
                  <span style={{ color: '#f9a8d4', fontWeight: 600 }}>Femenino</span> y{' '}
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>No informa</span> igual a la derecha.
                  Sin fecha de nacimiento válida o con género no reconocido van al pie del gráfico.
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
                disabled={
                  globalYear === 'all' ? tendencyCasesPrimary.length === 0 : !casesSeriesForChart.length
                }
                onClick={() =>
                  globalYear === 'all' && calendarYoYMonthly.anchor != null
                    ? exportMonthlyYoYComparisonCsv(
                        tendencyCasesPrimary,
                        tendencyPrevSeries,
                        calendarYoYMonthly.anchor,
                        `casos_yoy_${calendarYoYMonthly.anchor}_vs_${calendarYoYMonthly.anchor - 1}.csv`
                      )
                    : exportCasesSeriesCsv(casesSeriesForChart, `casos_temporal_${dateFrom}_${dateTo}.csv`)
                }
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
                casesData={tendencyCasesPrimary}
                prevCasesData={tendencyPrevSeries}
                rangeFrom={tendencyRangeFrom}
                rangeTo={tendencyRangeTo}
                title="Casos en el tiempo"
                type="line"
                loading={casesLoading}
                yearComparisonEnabled
                comparisonFocusYear={tendencyComparisonYearStr}
                comparisonStyle={globalYear === 'all' ? 'calendarYoY' : 'mirror'}
                controls={
                  <div className="chartControls chartControlsDates chartControlsDates--mutedWhenDisabled">
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
                  <span className="dashboardInfoTooltip dashboardInfoTooltip--sectorBar">
                    <button
                      type="button"
                      className="dashboardInfoTooltipBtn"
                      aria-label="Ver cómo se aplican filtros en el gráfico de casos por sector"
                      aria-describedby="sector-bar-info-tooltip"
                    >
                      i
                    </button>
                    <span
                      id="sector-bar-info-tooltip"
                      role="tooltip"
                      className="dashboardInfoTooltipBubble"
                    >
                      Usa los mismos filtros globales que el panel (sector cuando no está fijado, estado,
                      género, grupo etario por{' '}
                      <strong>edad al registro</strong>, ocupación). Con año <strong>Todos</strong>, el
                      ranking refleja toda la historia. El temporal <strong>Casos en el tiempo</strong> muestra
                      mes a mes el <strong>año civil actual frente al año civil anterior</strong>; con un año concreto
                      en el filtro, ese gráfico pasa al rango entre Desde/Hasta y la segunda serie viene del período −1 año
                      alineado a esas mismas marcas temporales.
                    </span>
                  </span>
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
                  Cada sector se oscurece según el volumen de casos permitido por tu filtro. Los puntos
                  marcan el centroide por sector (
                  <span style={{ color: '#fca5a5', fontWeight: 600 }}>semáforo: nuevo</span>,{' '}
                  <span style={{ color: '#fcd34d', fontWeight: 600 }}>reingreso</span>,{' '}
                  <span style={{ color: '#737373', fontWeight: 600 }}>tratado en gris en el mapa</span>). Al hacer
                  clic en el área del sector o en el marcador se abre el desglose fuera del mapa (panel lateral) con cada
                  caso y contactos directos cuando corresponda. Datos agregados y anónimos.
                </span>
              </span>
            </div>
          </div>
          <div className="dashboardMapCard">
            <SimpleMap
              sectors={mapSectors}
              cases={casesForMap}
              loading={mapInitialLoading}
            />
          </div>
        </section>

      </main>
    </div>
  )
}
