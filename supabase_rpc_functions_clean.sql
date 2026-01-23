-- ============================================================================
-- FUNCIONES RPC PARA DASHBOARD CHAGAS - FASE 2
-- Ejecutar este script completo en Supabase SQL Editor
-- ============================================================================

-- 1. FUNCIÓN: get_exams_by_month
CREATE OR REPLACE FUNCTION public.get_exams_by_month(p_months int DEFAULT 12)
RETURNS TABLE(month text, total_exams int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_exams_by_month(int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_exams_by_month(int) FROM public;

-- 2. FUNCIÓN: get_notifications_by_month
CREATE OR REPLACE FUNCTION public.get_notifications_by_month(p_months int DEFAULT 12)
RETURNS TABLE(month text, total_notifications int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  RETURN QUERY
  SELECT 
    TO_CHAR(fecha_notif, 'YYYY-MM') AS month,
    COUNT(*)::int AS total_notifications
  FROM (
    SELECT fecha_notificacion AS fecha_notif
    FROM public.chagas_agudo
    WHERE fecha_notificacion >= DATE_TRUNC('month', CURRENT_DATE - (p_months || ' months')::interval)
      AND fecha_notificacion <= CURRENT_DATE
    
    UNION ALL
    
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

GRANT EXECUTE ON FUNCTION public.get_notifications_by_month(int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_notifications_by_month(int) FROM public;

-- 3. FUNCIÓN: get_counts_by_comuna
CREATE OR REPLACE FUNCTION public.get_counts_by_comuna(p_limit int DEFAULT 10)
RETURNS TABLE(comuna text, total_personas int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

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

GRANT EXECUTE ON FUNCTION public.get_counts_by_comuna(int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_counts_by_comuna(int) FROM public;

-- 4. FUNCIÓN: get_map_points
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  RETURN QUERY
  SELECT 
    p.latitud::double precision AS lat,
    p.longitud::double precision AS lon,
    p.comuna::text AS comuna,
    p.provincia::text AS provincia,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.chagas_agudo ca 
        WHERE ca.id_persona = p.id_persona
      ) THEN 'agudo'::text
      WHEN EXISTS (
        SELECT 1 FROM public.chagas_gestantes cg 
        WHERE cg.id_persona = p.id_persona
      ) THEN 'gestante'::text
      WHEN EXISTS (
        SELECT 1 FROM public.chagas_bajo_control cbc 
        WHERE cbc.id_persona = p.id_persona
      ) THEN 'bajo_control'::text
      ELSE 'persona'::text
    END AS category
  FROM public.persona p
  WHERE 
    p.latitud IS NOT NULL 
    AND p.longitud IS NOT NULL
    AND p.latitud BETWEEN -90 AND 90
    AND p.longitud BETWEEN -180 AND 180
  ORDER BY p.id_persona
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_points(int) TO authenticated;
REVOKE ALL ON FUNCTION public.get_map_points(int) FROM public;
