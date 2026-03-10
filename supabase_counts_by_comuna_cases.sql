-- ============================================================================
-- RPC: get_counts_by_comuna (SOLO CASOS CHAGAS) CON FILTRO POR TIPO DE CASO, SEXO Y GRUPO ETARIO
-- ============================================================================
--
-- Uso desde Supabase JS:
--   supabase.rpc('get_counts_by_comuna', {
--     p_limit: 50,                 -- opcional, por defecto 10
--     p_case_type: 'agudo' | 'bajo_control' | 'gestante' | 'all' | NULL,
--     p_sex: 'M' | 'F' | 'all' | NULL,
--     p_age_group: 'all' | '0_14' | '15_29' | '30_44' | '45_59' | '60_plus'
--   })
--
-- Notas:
-- - Solo considera personas que son CASOS (agudo, bajo control o gestantes).
-- - Si p_case_type es NULL o 'all', devuelve todos los tipos mezclados.
-- - Si p_case_type es 'agudo', 'bajo_control' o 'gestante', filtra solo ese tipo.

DROP FUNCTION IF EXISTS public.get_counts_by_comuna(integer);
DROP FUNCTION IF EXISTS public.get_counts_by_comuna(integer, text);
DROP FUNCTION IF EXISTS public.get_counts_by_comuna(integer, text, text);
DROP FUNCTION IF EXISTS public.get_counts_by_comuna(integer, text, text, text);

CREATE OR REPLACE FUNCTION public.get_counts_by_comuna(
  p_limit int DEFAULT 10,
  p_case_type text DEFAULT 'all',
  p_sex text DEFAULT 'all',
  p_age_group text DEFAULT 'all'
)
RETURNS TABLE(
  comuna text,
  total_personas int
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
    p.comuna::text AS comuna,
    COUNT(DISTINCT p.id_persona)::int AS total_personas
  FROM public.persona p
  JOIN (
    SELECT id_persona, 'agudo'::text AS case_type
    FROM public.chagas_agudo
    UNION
    SELECT id_persona, 'bajo_control'::text AS case_type
    FROM public.chagas_bajo_control
    UNION
    SELECT id_persona, 'gestante'::text AS case_type
    FROM public.chagas_gestantes
  ) c ON c.id_persona = p.id_persona
  WHERE p.comuna IS NOT NULL
    AND p.comuna <> ''
    AND (
      p_case_type IS NULL
      OR p_case_type = 'all'
      OR c.case_type = p_case_type
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
  GROUP BY p.comuna
  ORDER BY total_personas DESC, p.comuna
  LIMIT COALESCE(p_limit, 10);
END;
$$;

