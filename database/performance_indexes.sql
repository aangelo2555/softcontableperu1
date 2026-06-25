-- ====================================================================
-- Índices de Performance para SOFTCONTABLE
-- Optimización de consultas frecuentes en Railway
-- ====================================================================
-- 
-- INSTRUCCIONES DE USO:
-- Estos índices mejoran significativamente la velocidad de consultas
-- pero ocupan espacio adicional en disco (~5-10% del tamaño de la tabla)
-- 
-- Ejecutar en Railway o entorno de producción para máximo rendimiento
-- ====================================================================

-- ====================================================================
-- 1. ÍNDICES PARA PURCHASES (Registro de Compras)
-- ====================================================================

-- Índice compuesto: workspace + user + fecha (para filtros temporales)
CREATE INDEX IF NOT EXISTS idx_purchases_workspace_fecha 
ON purchases(workspace_id, user_id, fecha DESC);

-- Índice para consultas de estado SIRE
CREATE INDEX IF NOT EXISTS idx_purchases_sire_estado 
ON purchases(workspace_id, user_id, estado_sire, fecha DESC);

-- Índice para búsquedas por proveedor
CREATE INDEX IF NOT EXISTS idx_purchases_proveedor 
ON purchases(workspace_id, user_id, doc_num, fecha DESC);

-- Índice para consultas por tipo de documento
CREATE INDEX IF NOT EXISTS idx_purchases_tipo_doc 
ON purchases(workspace_id, user_id, tipo_doc, serie, numero);

-- ====================================================================
-- 2. ÍNDICES PARA SALES (Registro de Ventas)
-- ====================================================================

-- Índice compuesto: workspace + user + fecha
CREATE INDEX IF NOT EXISTS idx_sales_workspace_fecha 
ON sales(workspace_id, user_id, fecha DESC);

-- Índice para consultas de estado SIRE
CREATE INDEX IF NOT EXISTS idx_sales_sire_estado 
ON sales(workspace_id, user_id, estado_sire, fecha DESC);

-- Índice para búsquedas por cliente
CREATE INDEX IF NOT EXISTS idx_sales_cliente 
ON sales(workspace_id, user_id, doc_num, fecha DESC);

-- Índice para consultas por tipo de documento
CREATE INDEX IF NOT EXISTS idx_sales_tipo_doc 
ON sales(workspace_id, user_id, tipo_doc, serie, numero);

-- ====================================================================
-- 3. ÍNDICES PARA JOURNAL (Libro Diario)
-- ====================================================================

-- Ya existe: idx_journal_workspace
-- Añadir índice por fecha para consultas temporales
CREATE INDEX IF NOT EXISTS idx_journal_fecha 
ON journal(workspace_id, user_id, fecha DESC);

-- Índice para búsquedas por cuenta contable
CREATE INDEX IF NOT EXISTS idx_journal_cuenta 
ON journal(workspace_id, user_id, cta, fecha DESC);

-- Índice para consultas por asiento
CREATE INDEX IF NOT EXISTS idx_journal_asiento 
ON journal(workspace_id, user_id, asiento, fecha);

-- Índice para consultas por fuente (COMPRA, VENTA, ASIENTO)
CREATE INDEX IF NOT EXISTS idx_journal_source 
ON journal(workspace_id, user_id, source, fecha DESC);

-- ====================================================================
-- 4. ÍNDICES PARA LIBRO DIARIO 5.2
-- ====================================================================

-- Ya existe: idx_ld52_periodo
-- Añadir índice por cuenta
CREATE INDEX IF NOT EXISTS idx_ld52_cuenta 
ON libro_diario_52(workspace_id, user_id, codigo_cuenta, periodo);

-- Índice para consultas por CUO (Código Único de Operación)
CREATE INDEX IF NOT EXISTS idx_ld52_cuo_periodo 
ON libro_diario_52(workspace_id, user_id, cuo, periodo);

-- ====================================================================
-- 5. ÍNDICES PARA WORKSPACES
-- ====================================================================

-- Índice para búsquedas por usuario
CREATE INDEX IF NOT EXISTS idx_workspaces_user 
ON workspaces(user_id, ruc);

-- ====================================================================
-- 6. ÍNDICES PARA ASIENTOS MANUALES
-- ====================================================================

-- Índice para consultas de asientos
CREATE INDEX IF NOT EXISTS idx_asientos_workspace 
ON asientos(workspace_id, user_id);

-- ====================================================================
-- 7. ÍNDICES PARA HONORARIOS
-- ====================================================================

-- Índice por fecha
CREATE INDEX IF NOT EXISTS idx_honorarios_fecha 
ON honorarios(workspace_id, user_id, fecha DESC);

-- ====================================================================
-- 8. ÍNDICES PARA PRODUCTOS E INVENTARIO
-- ====================================================================

-- Índice para búsquedas de productos
CREATE INDEX IF NOT EXISTS idx_products_workspace 
ON products(workspace_id, user_id, code);

-- Índice para movimientos de inventario
CREATE INDEX IF NOT EXISTS idx_inventory_movements_fecha 
ON inventory_movements(workspace_id, user_id, fecha DESC, product_id);

-- ====================================================================
-- 9. ÍNDICES PARA PLANILLA
-- ====================================================================

-- Índice para consultas de empleados
CREATE INDEX IF NOT EXISTS idx_employees_workspace 
ON employees(workspace_id, user_id, dni);

-- ====================================================================
-- 10. ÍNDICES PARA ACTIVOS FIJOS
-- ====================================================================

-- Índice para búsquedas de activos
CREATE INDEX IF NOT EXISTS idx_fixed_assets_workspace 
ON fixed_assets(workspace_id, user_id, codigo);

-- Índice por fecha de adquisición
CREATE INDEX IF NOT EXISTS idx_fixed_assets_fecha_adq 
ON fixed_assets(workspace_id, user_id, fecha_adquisicion DESC);

-- ====================================================================
-- 11. OPTIMIZACIÓN: ANALYZE
-- ====================================================================
-- Actualizar estadísticas de la base de datos para que SQLite
-- elija los mejores índices automáticamente

ANALYZE;

-- ====================================================================
-- VERIFICACIÓN DE ÍNDICES CREADOS
-- ====================================================================
-- Para verificar que los índices se crearon correctamente, ejecutar:
-- 
-- SELECT name, tbl_name FROM sqlite_master 
-- WHERE type='index' AND name LIKE 'idx_%' 
-- ORDER BY tbl_name, name;
-- 
-- ====================================================================

-- ====================================================================
-- MANTENIMIENTO PERIÓDICO
-- ====================================================================
-- Para mantener la base de datos optimizada:
-- 
-- 1. VACUUM (Compactar y desfragmentar): Ejecutar cada 3-6 meses
--    VACUUM;
-- 
-- 2. ANALYZE (Actualizar estadísticas): Ejecutar semanalmente
--    ANALYZE;
-- 
-- 3. REINDEX (Reconstruir índices): Solo si hay corrupción
--    REINDEX;
-- 
-- ====================================================================

-- ====================================================================
-- MONITOREO DE PERFORMANCE
-- ====================================================================
-- Para ver qué consultas son lentas:
-- 
-- EXPLAIN QUERY PLAN 
-- SELECT * FROM purchases 
-- WHERE workspace_id = 'RUC' AND fecha >= '2026-01-01';
-- 
-- Buscar: "USING INDEX" en el resultado indica que usa índices
-- ====================================================================

-- FIN DE SCRIPT
