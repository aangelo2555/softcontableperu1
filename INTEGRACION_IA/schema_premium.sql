-- ============================================================
-- SCHEMA: premium
-- SoftPremium — módulo de suscripción sobre SOFTCONTABLE SAAS
-- Aislado lógicamente del core (public), MISMA instancia Postgres
-- Ver decisiones_arquitectura.md para el razonamiento completo
-- ============================================================
-- Última actualización: 05 de agosto de 2026
-- ============================================================

CREATE SCHEMA IF NOT EXISTS premium;

-- ------------------------------------------------------------
-- 1. SUSCRIPCIONES (el corazón del modelo de negocio)
-- ------------------------------------------------------------
CREATE TABLE premium.premium_subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            TEXT NOT NULL,
    user_id                 TEXT NOT NULL,
    plan_tier               TEXT NOT NULL CHECK (plan_tier IN ('tributario', 'planillas', 'finanzas', 'full')),
    status                  TEXT NOT NULL DEFAULT 'trial'
                            CHECK (status IN ('trial', 'active', 'past_due', 'canceled', 'suspended')),
    billing_cycle           TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
    price_centimos          INTEGER NOT NULL,          -- SIEMPRE céntimos, nunca float
    currency                TEXT NOT NULL DEFAULT 'PEN',
    current_period_start    TIMESTAMPTZ NOT NULL,
    current_period_end      TIMESTAMPTZ NOT NULL,
    trial_ends_at           TIMESTAMPTZ,
    canceled_at             TIMESTAMPTZ,
    payment_provider        TEXT,                       -- 'culqi', 'mercadopago', etc.
    payment_provider_ref    TEXT,                       -- id de suscripción externa
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_premium_sub_workspace ON premium.premium_subscriptions(workspace_id);
CREATE INDEX idx_premium_sub_status ON premium.premium_subscriptions(status);

-- Un workspace no puede tener dos suscripciones activas simultáneas al mismo tier
CREATE UNIQUE INDEX idx_premium_sub_unique_active
    ON premium.premium_subscriptions(workspace_id, plan_tier)
    WHERE status IN ('trial', 'active', 'past_due');


-- ------------------------------------------------------------
-- 2. FLAG DE ACTIVACIÓN EN EL CORE (la única escritura cruzada permitida)
-- ------------------------------------------------------------
-- Se agrega al schema public para que el check de acceso sea O(1)
-- sin necesidad de JOIN al schema premium en cada request del core.
ALTER TABLE public.workspaces
    ADD COLUMN IF NOT EXISTS premium_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS premium_tiers TEXT[] DEFAULT '{}';  -- ej. ['tributario','planillas']


-- ------------------------------------------------------------
-- 3. PILAR 1: TRIBUTACIÓN CON IA — Riesgos y fiscalización predictiva
-- ------------------------------------------------------------
CREATE TABLE premium.risk_analysis_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        TEXT NOT NULL,
    period              TEXT NOT NULL,               -- ej. '2026-07'
    run_type            TEXT NOT NULL CHECK (run_type IN (
                            'inconsistencia_gastos_ventas',
                            'estrategia_preventiva_sunat',
                            'comprobantes_pago_deteccion',
                            'declaraciones_vs_eeff',
                            'deduccion_gastos_general'
                        )),
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
    risk_score          NUMERIC(5,2),                -- 0.00 - 100.00
    findings_json       JSONB,                       -- hallazgos estructurados
    ai_model_used       TEXT,                        -- qué motor de IA generó esto
    tokens_consumed     INTEGER,                     -- para costeo interno
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_risk_workspace_period ON premium.risk_analysis_runs(workspace_id, period);
CREATE INDEX idx_risk_findings_gin ON premium.risk_analysis_runs USING GIN (findings_json);


-- ------------------------------------------------------------
-- 4. PILAR 2: PLANILLAS CON IA — PLAME, T-Registro, costos laborales
-- ------------------------------------------------------------
CREATE TABLE premium.payroll_ai_runs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id                TEXT NOT NULL,
    employee_id                 TEXT,  -- FK cruzado al core
    period                      TEXT NOT NULL,
    concept                     TEXT NOT NULL CHECK (concept IN (
                                    'gratificacion', 'cts', 'vacaciones',
                                    'essalud_onp_afp_validacion', 'boleta_resumen_ia',
                                    'plame_macro_import', 'contrato_dinamico',
                                    'subsidio_maternidad', 'subsidio_enfermedad',
                                    'concepto_remunerativo_clasificacion'
                                )),
    input_data_json              JSONB NOT NULL,               -- datos base del cálculo
    calculated_amount_centimos   INTEGER,                       -- SIEMPRE céntimos
    calculation_detail_json      JSONB,                          -- desglose paso a paso (auditable)
    normativa_aplicada           TEXT,                           -- ej. 'Ley 27735', 'Ley 32563'
    ai_generated_doc             TEXT,                           -- texto generado (contrato, adenda)
    reviewed_by_human            BOOLEAN NOT NULL DEFAULT FALSE, -- crítico: protección legal
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payroll_workspace_period ON premium.payroll_ai_runs(workspace_id, period);
CREATE INDEX idx_payroll_employee ON premium.payroll_ai_runs(employee_id);


-- ------------------------------------------------------------
-- 5. PILAR 3: FINANZAS CON IA — Cash flow, dashboards, factoring
-- ------------------------------------------------------------
CREATE TABLE premium.cashflow_forecasts (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id                    TEXT NOT NULL,
    forecast_period_start           DATE NOT NULL,
    forecast_period_end             DATE NOT NULL,
    method                          TEXT NOT NULL CHECK (method IN ('directo', 'indirecto')),
    projected_inflows_centimos      BIGINT NOT NULL,
    projected_outflows_centimos     BIGINT NOT NULL,
    sunat_calendar_adjustments_json JSONB,     -- vencimientos SUNAT que afectan el flujo
    variance_vs_actual_centimos     BIGINT,     -- se llena a posteriori, tras cierre real
    factoring_recommendation_json   JSONB,      -- análisis de factoring si aplica
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE premium.financial_dashboards (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          TEXT NOT NULL,
    dashboard_type        TEXT NOT NULL,               -- 'gerencia_excel', 'ventas_trimestral'
    snapshot_data_json    JSONB NOT NULL,              -- datos congelados al momento del snapshot
    source_period         TEXT NOT NULL,
    generated_file_path   TEXT,                        -- ruta al .xlsx generado
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cashflow_workspace ON premium.cashflow_forecasts(workspace_id, forecast_period_start);
CREATE INDEX idx_dashboards_workspace ON premium.financial_dashboards(workspace_id, source_period);


-- ------------------------------------------------------------
-- 6. AUDITORÍA DE TODO OUTPUT GENERADO POR IA (obligatorio, no opcional)
-- ------------------------------------------------------------
CREATE TABLE premium.ai_generation_audit (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id           TEXT NOT NULL,
    user_id                TEXT NOT NULL,
    source_table           TEXT NOT NULL,               -- qué tabla premium generó esto
    source_id              UUID NOT NULL,
    ai_provider             TEXT NOT NULL,
    prompt_hash             TEXT,                         -- hash del prompt, NUNCA el prompt completo (privacidad)
    output_reviewed          BOOLEAN NOT NULL DEFAULT FALSE,
    output_approved_by       TEXT,
    output_approved_at       TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_audit_workspace ON premium.ai_generation_audit(workspace_id, created_at);

-- ============================================================
-- FIN DEL SCHEMA v1.0
-- Próxima revisión sugerida: cuando se implemente el primer
-- endpoint real de activación de suscripción (ver PROMPT_MAESTRO)
-- ============================================================
