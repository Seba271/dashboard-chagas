-- =============================================================================
-- RPC: get_counts_by_comuna
-- =============================================================================
-- Consumida por el dashboard (useCountsByComuna.js) vía:
--   supabase.rpc('get_counts_by_comuna', { p_limit, p_case_type?, p_sex?, p_age_group? })
--
-- IMPORTANTE: debe existir UNA sola función con este nombre. Si hay dos firmas
-- (4 y 6 parámetros), PostgREST da error "Could not choose the best candidate".
-- Esta versión unifica todo en una sola firma con fechas opcionales al final.
--
-- Parámetros (PostgREST):
--   p_limit        integer  (ej. 50) — top comunas por cantidad
--   p_case_type    text     opcional: 'all' | 'agudo' | 'bajo_control' | 'gestante'
--   p_sex          text     opcional: 'all' | 'M' | 'F'
--   p_age_group    text     opcional: 'all' | '0_14' | '15_29' | '30_44' | '45_59' | '60_plus'
--   p_date_from    date     opcional (compatibilidad); por defecto NULL = sin filtro por fechas
--   p_date_to      date     opcional (compatibilidad); por defecto NULL = sin filtro por fechas
--
-- Retorna filas:
--   comuna          text
--   total_personas  bigint
--
-- AJUSTES si falla en tu BD:
-- - Nombres de tablas de casos (agudo / bajo control / gestantes).
-- - Columna de sexo en persona (sexo vs genero, valores M/F).
-- - Fecha de nacimiento (fecha_nacimiento vs otra).
-- =============================================================================
--
-- Si ya existe la función con otra firma o columnas de retorno, Postgres no
-- permite solo CREATE OR REPLACE (error 42P13). Hay que borrarla primero:
--

-- Borrar TODAS las versiones anteriores (evita 42P13 y sobrecarga ambigua).
DROP FUNCTION IF EXISTS public.get_counts_by_comuna(integer, text, text, text);
DROP FUNCTION IF EXISTS public.get_counts_by_comuna(integer, text, text, text, date, date);

CREATE OR REPLACE FUNCTION public.get_counts_by_comuna(
  p_limit integer DEFAULT 50,
  p_case_type text DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_age_group text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  comuna text,
  total_personas bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lim AS (
    SELECT GREATEST(1, LEAST(COALESCE(p_limit, 50), 500))::int AS n
  ),
  -- Personas que cuentan como “caso Chagas” (unión de tablas de seguimiento).
  -- Si NO tienes tabla de agudos, comenta el UNION de chagas_agudo y el bloque OR 'agudo' abajo.
  -- Nombres frecuentes alternativos: chagas_caso_agudo, chagas_casos_agudos (ajusta y vuelve a ejecutar).
  personas_caso AS (
    SELECT DISTINCT bc.id_persona
    FROM public.chagas_bajo_control bc
    UNION
    SELECT DISTINCT g.id_persona
    FROM public.chagas_gestantes g
    UNION
    SELECT DISTINCT a.id_persona
    FROM public.chagas_agudo a
  ),
  base AS (
    SELECT
      p.id_persona,
      COALESCE(NULLIF(trim(p.comuna::text), ''), 'Sin comuna') AS comuna_norm,
      p.sexo,
      p.fecha_nacimiento
    FROM public.persona p
    INNER JOIN personas_caso pc ON pc.id_persona = p.id_persona
    WHERE
      -- Filtro tipo de caso (mismo criterio que usa el mapa / KPIs)
      (
        p_case_type IS NULL
        OR trim(p_case_type) = ''
        OR lower(trim(p_case_type)) = 'all'
        OR (
          lower(trim(p_case_type)) = 'bajo_control'
          AND EXISTS (
            SELECT 1 FROM public.chagas_bajo_control x WHERE x.id_persona = p.id_persona
          )
        )
        OR (
          lower(trim(p_case_type)) = 'gestante'
          AND EXISTS (
            SELECT 1 FROM public.chagas_gestantes x WHERE x.id_persona = p.id_persona
          )
        )
        OR (
          lower(trim(p_case_type)) = 'agudo'
          AND EXISTS (
            SELECT 1 FROM public.chagas_agudo x WHERE x.id_persona = p.id_persona
          )
        )
      )
      AND (
        p_sex IS NULL
        OR trim(p_sex) = ''
        OR lower(trim(p_sex)) = 'all'
        OR upper(trim(p.sexo::text)) = upper(trim(p_sex))
      )
      AND (
        p_age_group IS NULL
        OR trim(p_age_group) = ''
        OR lower(trim(p_age_group)) = 'all'
        OR (
          p.fecha_nacimiento IS NOT NULL
          AND (
            (
              lower(trim(p_age_group)) = '0_14'
              AND EXTRACT(YEAR FROM age(current_date, p.fecha_nacimiento::date))::int BETWEEN 0 AND 14
            )
            OR (
              lower(trim(p_age_group)) = '15_29'
              AND EXTRACT(YEAR FROM age(current_date, p.fecha_nacimiento::date))::int BETWEEN 15 AND 29
            )
            OR (
              lower(trim(p_age_group)) = '30_44'
              AND EXTRACT(YEAR FROM age(current_date, p.fecha_nacimiento::date))::int BETWEEN 30 AND 44
            )
            OR (
              lower(trim(p_age_group)) = '45_59'
              AND EXTRACT(YEAR FROM age(current_date, p.fecha_nacimiento::date))::int BETWEEN 45 AND 59
            )
            OR (
              lower(trim(p_age_group)) = '60_plus'
              AND EXTRACT(YEAR FROM age(current_date, p.fecha_nacimiento::date))::int >= 60
            )
          )
        )
      )
      -- p_date_from / p_date_to: reservados para filtrar por fecha de caso si lo necesitas
      -- (implementa aquí con las columnas reales de tus tablas; por defecto no filtran).
  ),
  agg AS (
    SELECT
      b.comuna_norm AS comuna,
      COUNT(DISTINCT b.id_persona)::bigint AS total_personas
    FROM base b
    GROUP BY b.comuna_norm
  )
  SELECT a.comuna, a.total_personas
  FROM agg a
  CROSS JOIN lim l
  ORDER BY a.total_personas DESC, a.comuna ASC
  LIMIT (SELECT n FROM lim);
$$;

COMMENT ON FUNCTION public.get_counts_by_comuna(integer, text, text, text, date, date) IS
  'Ranking de casos Chagas por comuna; filtros opcionales tipo/sexo/edad y fechas (opcionales).';

-- Permisos típicos en Supabase (ajusta si usas solo usuarios autenticados)
GRANT EXECUTE ON FUNCTION public.get_counts_by_comuna(integer, text, text, text, date, date) TO anon;
GRANT EXECUTE ON FUNCTION public.get_counts_by_comuna(integer, text, text, text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_counts_by_comuna(integer, text, text, text, date, date) TO service_role;
