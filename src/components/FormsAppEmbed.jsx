'use client'

import { useRef, useLayoutEffect } from 'react'
import Script from 'next/script'

const FORMS_APP_ID = '69ddc91c00688655233474e5'
const FORMS_APP_BASE = 'https://m7zwrsab.forms.app'

/** Opciones del embed «popup» (snippet forms.app: overlay, botón, tamaño, animaciones). */
const FORMS_APP_OPTIONS = {
  overlay: 'rgba(45,45,45,0.5)',
  button: {
    color: '#ff9e24',
    text: '¡Haga clic aquí!'
  },
  width: '1100px',
  height: '720px',
  openingAnimation: {
    entrance: 'animate__fadeIn',
    exit: 'animate__fadeOut'
  }
}

/**
 * Embed de encuesta forms.app (modo popup: botón que abre el formulario en overlay).
 */
export default function FormsAppEmbed() {
  const mountRef = useRef(null)
  const didInit = useRef(false)

  useLayoutEffect(() => {
    const el = mountRef.current
    if (el) el.setAttribute('formsappId', FORMS_APP_ID)
  }, [])

  const handleLoad = () => {
    if (didInit.current) return
    if (typeof window === 'undefined') return
    const Ctor = window.formsapp
    if (typeof Ctor !== 'function') return
    didInit.current = true
    try {
      new Ctor(FORMS_APP_ID, 'popup', FORMS_APP_OPTIONS, FORMS_APP_BASE)
    } catch (e) {
      console.error('forms.app embed:', e)
      didInit.current = false
    }
  }

  return (
    <section
      className="dashboardSection formsAppEmbedSection no-print"
      aria-labelledby="survey-heading"
    >
      <div className="formsAppEmbedHead">
        <h2 id="survey-heading" className="formsAppEmbedTitle">
          Encuesta
        </h2>
      </div>
      <div className="formsAppEmbedMount">
        <button
          ref={mountRef}
          type="button"
          className="formsAppEmbedTrigger"
          aria-label="Abrir encuesta"
        />
      </div>
      <Script
        src="https://forms.app/cdn/embed.js"
        strategy="afterInteractive"
        onLoad={handleLoad}
      />
    </section>
  )
}
