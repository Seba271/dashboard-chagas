-- ============================================================================
-- RPC: get_map_points (SOLO CASOS CHAGAS) CON FILTRO POR AÑO, TIPO DE CASO, SEXO Y GRUPO ETARIO
-- ============================================================================
--
-- Uso desde Supabase JS:
--   supabase.rpc('get_map_points', {
--     p_limit: 2000,            -- opcional, por defecto 1000
--     p_year: 2026,             -- opcional, NULL = todos los años
--     p_case_type: 'agudo' | 'bajo_control' | 'gestante' | 'all' | NULL,
--     p_sex: 'M' | 'F' | 'all' | NULL,
--     p_age_group: 'all' | '0_14' | '15_29' | '30_44' | '45_59' | '60_plus'
--   })
--
-- Notas:
-- - Solo considera personas que son CASOS (agudo, bajo control o gestantes).
-- - category:
--     'agudo'        -> si existe en chagas_agudo
--     'gestante'     -> si existe en chagas_gestantes
--     'bajo_control' -> si existe en chagas_bajo_control
--     'caso'         -> fallback genérico (no debería usarse en la práctica)
-- - es_caso_nuevo: TRUE si persona.creado_en es del mes calendario actual.

DROP FUNCTION IF EXISTS public.get_map_points(integer, integer);
DROP FUNCTION IF EXISTS public.get_map_points(integer, integer, text);
DROP FUNCTION IF EXISTS public.get_map_points(integer, integer, text, text);
DROP FUNCTION IF EXISTS public.get_map_points(integer, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.get_map_points(
  p_limit int DEFAULT 1000,
  p_year int DEFAULT NULL,
  p_case_type text DEFAULT 'all',
  p_sex text DEFAULT 'all',
  p_age_group text DEFAULT 'all'
)
RETURNS TABLE(
  lat double precision,
  lon double precision,
  comuna text,
  provincia text,
  category text,
  es_caso_nuevo boolean
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
      WHEN EXISTS (SELECT 1 FROM public.chagas_agudo ca WHERE ca.id_persona = p.id_persona)
        THEN 'agudo'::text
      WHEN EXISTS (SELECT 1 FROM public.chagas_gestantes cg WHERE cg.id_persona = p.id_persona)
        THEN 'gestante'::text
      WHEN EXISTS (SELECT 1 FROM public.chagas_bajo_control cbc WHERE cbc.id_persona = p.id_persona)
        THEN 'bajo_control'::text
      ELSE 'caso'::text
    END AS category,
    (date_trunc('month', p.creado_en AT TIME ZONE 'UTC') = date_trunc('month', current_date AT TIME ZONE 'UTC')) AS es_caso_nuevo
  FROM public.persona p
  WHERE p.latitud IS NOT NULL
    AND p.longitud IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.chagas_agudo ca WHERE ca.id_persona = p.id_persona) OR
      EXISTS (SELECT 1 FROM public.chagas_gestantes cg WHERE cg.id_persona = p.id_persona) OR
      EXISTS (SELECT 1 FROM public.chagas_bajo_control cbc WHERE cbc.id_persona = p.id_persona)
    )
    AND (
      p_year IS NULL
      OR EXTRACT(YEAR FROM p.creado_en) = p_year
    )
    AND (
      p_case_type IS NULL
      OR p_case_type = 'all'
      OR (
        CASE
          WHEN EXISTS (SELECT 1 FROM public.chagas_agudo ca WHERE ca.id_persona = p.id_persona)
            THEN 'agudo'::text
          WHEN EXISTS (SELECT 1 FROM public.chagas_gestantes cg WHERE cg.id_persona = p.id_persona)
            THEN 'gestante'::text
          WHEN EXISTS (SELECT 1 FROM public.chagas_bajo_control cbc WHERE cbc.id_persona = p.id_persona)
            THEN 'bajo_control'::text
          ELSE 'caso'::text
        END = p_case_type
      )
    )
    AND (
      p_sex IS NULL
      OR p_sex = 'all'
      OR p.sexo::text = p_sex
    )
    AND (
      p_age_group IS NULL
      OR p_age_group = 'all'
      OR (
        p.edad IS NOT NULL
        AND (
          (p_age_group = '0_14' AND p.edad BETWEEN 0 AND 14) OR
          (p_age_group = '15_29' AND p.edad BETWEEN 15 AND 29) OR
          (p_age_group = '30_44' AND p.edad BETWEEN 30 AND 44) OR
          (p_age_group = '45_59' AND p.edad BETWEEN 45 AND 59) OR
          (p_age_group = '60_plus' AND p.edad >= 60)
        )
      )
    )
  ORDER BY p.creado_en DESC
  LIMIT COALESCE(p_limit, 1000);
END;
$$;

