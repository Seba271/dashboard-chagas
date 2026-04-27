'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import {
  ESTADO_OPTIONS,
  GENERO_OPTIONS,
  TIPO_CONTACTO_OPTIONS
} from '@/lib/caseEnums'

const FORM_DEFAULTS = {
  genero: '',
  edad: '',
  id_sector: '',
  ocupacion: '',
  estado_actual: 'nuevo',
  contacto_disponible: false,
  tipo_contacto: 'no_informa',
  observacion_general: ''
}

/**
 * Formulario de registro anónimo de un caso epidemiológico (modelo nuevo).
 *
 * Reemplaza al embed externo (FormsAppEmbed). NO captura RUT, nombre, teléfono ni dirección.
 * El backend genera el `codigo_caso` automáticamente y registra el primer estado en historial.
 *
 * Props:
 * - sectors: Array<{ id_sector, nombre_sector, comuna }>
 * - onCreated?: () => void  (opcional, para refrescar el dataset del dashboard)
 */
export default function CaseRegistrationForm({ sectors = [], onCreated }) {
  const [form, setForm] = useState(FORM_DEFAULTS)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [open, setOpen] = useState(false)

  const updateField = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const validate = () => {
    if (!form.genero) return 'Selecciona el género.'
    if (!form.id_sector) return 'Selecciona el sector.'
    if (form.edad === '' || form.edad === null) return 'Ingresa la edad.'
    const edadNum = Number(form.edad)
    if (Number.isNaN(edadNum) || edadNum < 0 || edadNum > 120) return 'La edad debe ser un número entre 0 y 120.'
    if (!form.estado_actual) return 'Selecciona el estado.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    try {
      setSubmitting(true)
      const supabase = createSupabaseClient()
      const { data: userData } = await supabase.auth.getUser()
      const userId = userData?.user?.id ?? null

      const payload = {
        genero: form.genero,
        edad: Number(form.edad),
        id_sector: Number(form.id_sector),
        ocupacion: form.ocupacion?.trim() || null,
        estado_actual: form.estado_actual,
        contacto_disponible: !!form.contacto_disponible,
        tipo_contacto: form.tipo_contacto || 'no_informa',
        observacion_general: form.observacion_general?.trim() || null,
        creado_por: userId
      }

      const { data: inserted, error: insertError } = await supabase
        .from('casos_epidemiologicos')
        .insert(payload)
        .select('id_caso, codigo_caso')
        .single()

      if (insertError) throw new Error(insertError.message || 'Error al registrar el caso')

      setSuccess(`Caso registrado: ${inserted?.codigo_caso ?? `#${inserted?.id_caso ?? ''}`}`)
      setForm(FORM_DEFAULTS)
      if (typeof onCreated === 'function') onCreated()
    } catch (err) {
      setError(err.message || 'Error al registrar el caso')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="caseRegSection no-print" aria-labelledby="case-reg-heading">
      <div className="caseRegHead">
        <button
          type="button"
          className="caseRegToggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="case-reg-body"
        >
          <span className="caseRegToggleIcon" aria-hidden>
            {open ? '−' : '+'}
          </span>
          <h2 id="case-reg-heading" className="caseRegTitle">
            Registrar nuevo caso
          </h2>
          <span className="caseRegHint">Sin datos personales</span>
        </button>
      </div>

      {open && (
        <form id="case-reg-body" className="caseRegForm" onSubmit={handleSubmit} noValidate>
          <div className="caseRegGrid">
            <label className="caseRegField">
              <span className="caseRegLabel">Género *</span>
              <select
                className="caseRegInput"
                value={form.genero}
                onChange={(e) => updateField('genero', e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {GENERO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="caseRegField">
              <span className="caseRegLabel">Edad *</span>
              <input
                type="number"
                className="caseRegInput"
                min={0}
                max={120}
                value={form.edad}
                onChange={(e) => updateField('edad', e.target.value)}
                required
              />
            </label>

            <label className="caseRegField caseRegField--wide">
              <span className="caseRegLabel">Sector *</span>
              <select
                className="caseRegInput"
                value={form.id_sector}
                onChange={(e) => updateField('id_sector', e.target.value)}
                required
              >
                <option value="">Selecciona…</option>
                {sectors.map((s) => (
                  <option key={s.id_sector} value={s.id_sector}>
                    {s.nombre_sector}{s.comuna ? ` — ${s.comuna}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="caseRegField">
              <span className="caseRegLabel">Estado *</span>
              <select
                className="caseRegInput"
                value={form.estado_actual}
                onChange={(e) => updateField('estado_actual', e.target.value)}
                required
              >
                {ESTADO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="caseRegField">
              <span className="caseRegLabel">Ocupación</span>
              <input
                type="text"
                className="caseRegInput"
                value={form.ocupacion}
                onChange={(e) => updateField('ocupacion', e.target.value)}
                placeholder="Opcional"
                maxLength={120}
              />
            </label>

            <label className="caseRegField caseRegField--check">
              <input
                type="checkbox"
                checked={form.contacto_disponible}
                onChange={(e) => updateField('contacto_disponible', e.target.checked)}
              />
              <span className="caseRegCheckLabel">Contacto disponible</span>
            </label>

            <label className="caseRegField">
              <span className="caseRegLabel">Tipo de contacto</span>
              <select
                className="caseRegInput"
                value={form.tipo_contacto}
                onChange={(e) => updateField('tipo_contacto', e.target.value)}
              >
                {TIPO_CONTACTO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            <label className="caseRegField caseRegField--full">
              <span className="caseRegLabel">Observación general</span>
              <textarea
                className="caseRegTextarea"
                rows={3}
                value={form.observacion_general}
                onChange={(e) => updateField('observacion_general', e.target.value)}
                placeholder="Notas sin datos identificables"
              />
            </label>
          </div>

          {error && <div className="caseRegError">{error}</div>}
          {success && <div className="caseRegSuccess">{success}</div>}

          <div className="caseRegActions">
            <button
              type="button"
              className="caseRegBtnSecondary"
              onClick={() => setForm(FORM_DEFAULTS)}
              disabled={submitting}
            >
              Limpiar
            </button>
            <button type="submit" className="caseRegBtnPrimary" disabled={submitting}>
              {submitting ? 'Registrando…' : 'Registrar caso'}
            </button>
          </div>
          <p className="caseRegLegal">
            Modelo epidemiológico anónimo: no se almacenan RUT, nombre, dirección, teléfono ni datos clínicos.
            El código de caso (formato MP-AA-NNNN) lo genera Supabase automáticamente.
          </p>
        </form>
      )}
    </section>
  )
}
