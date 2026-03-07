-- ============================================================================
-- RPC: get_cases_by_date_range
-- ============================================================================
-- Devuelve cantidad de casos por FECHA (día). Agrupa por persona.creado_en::date:
-- si varios casos se registraron el mismo día, devuelve esa fecha y el total.
-- Un "caso" es persona en chagas_agudo, chagas_bajo_control o chagas_gestantes.
-- Ejecutar en Supabase SQL Editor.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_cases_by_date_range(date, date);

CREATE OR REPLACE FUNCTION public.get_cases_by_date_range(
  p_date_from date,
  p_date_to date
)
RETURNS TABLE(day text, total_casos bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  IF p_date_from > p_date_to THEN
    RAISE EXCEPTION 'La fecha desde no puede ser mayor que la fecha hasta';
  END IF;

  RETURN QUERY
  SELECT
    TO_CHAR(p.creado_en::date, 'YYYY-MM-DD') AS day,
    COUNT(p.id_persona)::bigint AS total_casos
  FROM public.persona p
  INNER JOIN (
    SELECT id_persona FROM public.chagas_agudo
    UNION
    SELECT id_persona FROM public.chagas_bajo_control
    UNION
    SELECT id_persona FROM public.chagas_gestantes
  ) AS casos ON casos.id_persona = p.id_persona
  WHERE (p.creado_en::date) >= p_date_from
    AND (p.creado_en::date) <= p_date_to
  GROUP BY p.creado_en::date
  ORDER BY p.creado_en::date ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cases_by_date_range(date, date) TO authenticated;
REVOKE ALL ON FUNCTION public.get_cases_by_date_range(date, date) FROM public;
