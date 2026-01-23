-- ============================================================================
-- FUNCIONES RPC PARA DASHBOARD CHAGAS - FASE 2
-- ============================================================================
-- 
-- Este archivo contiene todas las funciones RPC necesarias para el dashboard.
-- Ejecutar este script completo en Supabase SQL Editor.
-- 
-- SEGURIDAD:
-- - Todas las funciones usan SECURITY DEFINER
-- - Validan que el usuario esté autenticado (auth.uid() IS NOT NULL)
-- - Solo usuarios autenticados pueden ejecutar estas funciones
-- - No exponen datos sensibles (RUT, teléfono, nombre completo)
-- ============================================================================

-- ============================================================================
-- 1. FUNCIÓN: get_exams_by_month
-- ============================================================================
-- Devuelve serie temporal de exámenes por mes
-- 
-- PARÁMETROS:
--   p_months: int - Número de meses a retornar (default: 12)
-- 
-- RETORNA:
--   TABLE(month text, total_exams int)
-- 
-- EJEMPLO:
--   SELECT * FROM get_exams_by_month(12);
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_exams_by_month(p_months int DEFAULT 12)
RETURNS TABLE(month text, total_exams int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Retornar serie temporal de exámenes
  RETURN QUERY
  SELECT 
    TO_CHAR(e.fecha_examen, 'YYYY-MM') AS month,
    COUNT(*)::int AS total_exams
  FROM public.examen_chagas e
  WHERE 
    e.fecha_examen >= DATE_TRUNC('month', CURRENT_DATE - (p_months || ' months')::interval)
    AND e.fecha_examen <= CURRENT_DATE
  GROUP BY TO_CHAR(e.fecha_examen, 'YYYY-MM')
  ORDER BY month ASC;
END;
$$;

-- Permisos: Solo usuarios autenticados pueden ejecutar
GRANT EXECUTE ON FUNCTION public.get_exams_by_month(int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_exams_by_month(int) FROM public;

-- ============================================================================
-- 2. FUNCIÓN: get_notifications_by_month
-- ============================================================================
-- Devuelve serie temporal de notificaciones combinando múltiples tablas
-- 
-- PARÁMETROS:
--   p_months: int - Número de meses a retornar (default: 12)
-- 
-- RETORNA:
--   TABLE(month text, total_notifications int)
-- 
-- NOTA:
--   Combina fecha_notificacion de:
--   - chagas_agudo
--   - chagas_bajo_control (ignora NULL)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_notifications_by_month(p_months int DEFAULT 12)
RETURNS TABLE(month text, total_notifications int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Retornar serie temporal combinando notificaciones de ambas tablas
  RETURN QUERY
  SELECT 
    TO_CHAR(fecha_notif, 'YYYY-MM') AS month,
    COUNT(*)::int AS total_notifications
  FROM (
    -- Notificaciones de casos agudos
    SELECT fecha_notificacion AS fecha_notif
    FROM public.chagas_agudo
    WHERE fecha_notificacion >= DATE_TRUNC('month', CURRENT_DATE - (p_months || ' months')::interval)
      AND fecha_notificacion <= CURRENT_DATE
    
    UNION ALL
    
    -- Notificaciones de casos bajo control (ignorar NULL)
    SELECT fecha_notificacion AS fecha_notif
    FROM public.chagas_bajo_control
    WHERE fecha_notificacion IS NOT NULL
      AND fecha_notificacion >= DATE_TRUNC('month', CURRENT_DATE - (p_months || ' months')::interval)
      AND fecha_notificacion <= CURRENT_DATE
  ) AS combined_notifications
  GROUP BY TO_CHAR(fecha_notif, 'YYYY-MM')
  ORDER BY month ASC;
END;
$$;

-- Permisos: Solo usuarios autenticados pueden ejecutar
GRANT EXECUTE ON FUNCTION public.get_notifications_by_month(int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_notifications_by_month(int) FROM public;

-- ============================================================================
-- 3. FUNCIÓN: get_counts_by_comuna
-- ============================================================================
-- Devuelve ranking de comunas por cantidad de personas
-- 
-- PARÁMETROS:
--   p_limit: int - Número máximo de comunas a retornar (default: 10)
-- 
-- RETORNA:
--   TABLE(comuna text, total_personas int)
-- 
-- NOTA:
--   Ignora comunas NULL o vacías
--   Ordena descendente por total_personas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_counts_by_comuna(p_limit int DEFAULT 10)
RETURNS TABLE(comuna text, total_personas int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Retornar ranking de comunas
  RETURN QUERY
  SELECT 
    p.comuna::text AS comuna,
    COUNT(*)::int AS total_personas
  FROM public.persona p
  WHERE 
    p.comuna IS NOT NULL 
    AND TRIM(p.comuna) != ''
  GROUP BY p.comuna
  ORDER BY total_personas DESC
  LIMIT p_limit;
END;
$$;

-- Permisos: Solo usuarios autenticados pueden ejecutar
GRANT EXECUTE ON FUNCTION public.get_counts_by_comuna(int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_counts_by_comuna(int) FROM public;

-- ============================================================================
-- 4. FUNCIÓN: get_map_points
-- ============================================================================
-- Devuelve puntos geográficos anonimizados para el mapa
-- 
-- PARÁMETROS:
--   p_limit: int - Número máximo de puntos a retornar (default: 1000)
-- 
-- RETORNA:
--   TABLE(
--     lat double precision,
--     lon double precision,
--     comuna text,
--     provincia text,
--     category text
--   )
-- 
-- CATEGORÍAS (prioridad):
--   1. 'agudo' - Si existe en chagas_agudo
--   2. 'gestante' - Si existe en chagas_gestantes (y no es agudo)
--   3. 'bajo_control' - Si existe en chagas_bajo_control (y no es agudo ni gestante)
--   4. 'persona' - Caso por defecto
-- 
-- NOTA:
--   EXCLUYE: rut, telefono, nombre, direccion
--   Solo retorna puntos con latitud y longitud válidas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_map_points(p_limit int DEFAULT 1000)
RETURNS TABLE(
  lat double precision,
  lon double precision,
  comuna text,
  provincia text,
  category text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar que el usuario esté autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Retornar puntos geográficos anonimizados con categorías
  RETURN QUERY
  SELECT 
    p.latitud::double precision AS lat,
    p.longitud::double precision AS lon,
    p.comuna::text AS comuna,
    p.provincia::text AS provincia,
    CASE
      -- Prioridad 1: Agudo
      WHEN EXISTS (
        SELECT 1 FROM public.chagas_agudo ca 
        WHERE ca.id_persona = p.id_persona
      ) THEN 'agudo'::text
      
      -- Prioridad 2: Gestante
      WHEN EXISTS (
        SELECT 1 FROM public.chagas_gestantes cg 
        WHERE cg.id_persona = p.id_persona
      ) THEN 'gestante'::text
      
      -- Prioridad 3: Bajo control
      WHEN EXISTS (
        SELECT 1 FROM public.chagas_bajo_control cbc 
        WHERE cbc.id_persona = p.id_persona
      ) THEN 'bajo_control'::text
      
      -- Prioridad 4: Persona (por defecto)
      ELSE 'persona'::text
    END AS category
  FROM public.persona p
  WHERE 
    p.latitud IS NOT NULL 
    AND p.longitud IS NOT NULL
    AND p.latitud BETWEEN -90 AND 90  -- Validar rango de latitud
    AND p.longitud BETWEEN -180 AND 180  -- Validar rango de longitud
  ORDER BY p.id_persona
  LIMIT p_limit;
END;
$$;

-- Permisos: Solo usuarios autenticados pueden ejecutar
GRANT EXECUTE ON FUNCTION public.get_map_points(int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_map_points(int) FROM public;

-- ============================================================================
-- VERIFICACIÓN DE FUNCIONES CREADAS
-- ============================================================================
-- 
-- Para verificar que las funciones se crearon correctamente, ejecutar:
-- 
-- SELECT 
--   routine_name,
--   routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'get_exams_by_month',
--     'get_notifications_by_month',
--     'get_counts_by_comuna',
--     'get_map_points'
--   );
-- 
-- ============================================================================
