import React, { useState } from 'react';
import { Shield, Lock, FileText, Eye, Cookie, ScrollText, Scale, ArrowLeft, X, ChevronRight, ExternalLink } from 'lucide-react';

// ─── Tipos ───
type LegalSection = 'terms' | 'privacy' | 'security' | 'confidentiality' | 'cookies' | 'eula' | 'legal';

interface LegalPagesProps {
  initialSection?: LegalSection;
  onClose: () => void;
}

const LAST_UPDATED = '5 de Agosto de 2026';
const AUTHOR = 'Angelo Thomas Serna Simeon';
const SYSTEM_NAME = 'SOFTCONTABLE';
const DOMAIN = 'softcontable.com';

// ─── Navegación lateral ───
const sections: { id: LegalSection; label: string; icon: React.FC<{ className?: string; size?: number }> }[] = [
  { id: 'terms', label: 'Términos de Servicio', icon: ScrollText },
  { id: 'privacy', label: 'Política de Privacidad', icon: Eye },
  { id: 'security', label: 'Política de Seguridad', icon: Shield },
  { id: 'confidentiality', label: 'Confidencialidad', icon: Lock },
  { id: 'cookies', label: 'Política de Cookies', icon: Cookie },
  { id: 'eula', label: 'Licencia de Uso (EULA)', icon: FileText },
  { id: 'legal', label: 'Aviso Legal', icon: Scale },
];

// ═══════════════════════════════════════════════════════════════
// CONTENIDO LEGAL
// ═══════════════════════════════════════════════════════════════

function TermsContent() {
  return (
    <div className="legal-content-body">
      <h1>Términos y Condiciones de Servicio</h1>
      <p className="legal-meta">Última actualización: {LAST_UPDATED} • Versión 2.0</p>

      <h2>1. Información General</h2>
      <p>
        Los presentes Términos y Condiciones de Servicio (en adelante, los "Términos") regulan el acceso y uso de la plataforma 
        <strong> {SYSTEM_NAME}</strong>, un sistema de contabilidad en la nube bajo modelo SaaS (Software as a Service), desarrollado 
        y operado por <strong>{AUTHOR}</strong> (en adelante, el "Titular" o "Proveedor").
      </p>
      <p>
        Al acceder, registrarse o utilizar {SYSTEM_NAME}, usted (en adelante, el "Usuario") acepta de manera íntegra y sin reservas 
        estos Términos. Si no está de acuerdo con alguna de estas condiciones, deberá abstenerse de usar el servicio.
      </p>

      <h2>2. Definiciones</h2>
      <ul>
        <li><strong>SaaS:</strong> Software as a Service — modelo de distribución de software donde el acceso se provee a través de internet sin instalación local.</li>
        <li><strong>Workspace:</strong> Espacio de trabajo digital asociado a una empresa registrada por el Usuario, identificado por su número de RUC.</li>
        <li><strong>SoftPremium:</strong> Módulo de Inteligencia Artificial y analítica avanzada disponible mediante suscripción adicional.</li>
        <li><strong>Datos del Usuario:</strong> Toda información contable, tributaria, laboral y financiera ingresada por el Usuario en la plataforma.</li>
        <li><strong>Credenciales SUNAT:</strong> Usuario SOL, Clave SOL, Client ID y Client Secret proporcionados voluntariamente por el Usuario para integración con SUNAT.</li>
      </ul>

      <h2>3. Descripción del Servicio</h2>
      <p>{SYSTEM_NAME} es una plataforma SaaS de contabilidad electrónica que permite a contadores, estudios contables y empresas gestionar:</p>
      <ul>
        <li>Registros de compras y ventas electrónicas</li>
        <li>Libros contables oficiales (Diario, Mayor, Caja y Bancos)</li>
        <li>Integración directa con el SIRE de SUNAT</li>
        <li>Generación de planillas y T-Registro</li>
        <li>Balance General, Estado de Resultados y anexos financieros</li>
        <li>Módulo SoftPremium con inteligencia artificial para auditoría tributaria, cálculos laborales y proyecciones financieras</li>
      </ul>

      <h2>4. Registro y Cuenta de Usuario</h2>
      <p>
        El Usuario se compromete a proporcionar información veraz, completa y actualizada durante el registro. Cada cuenta es personal e intransferible. 
        El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades realizadas bajo su cuenta.
      </p>
      <p>
        El Proveedor se reserva el derecho de suspender o cancelar cuentas que infrinjan estos Términos, sin previo aviso en casos de uso fraudulento 
        o actividades ilícitas.
      </p>

      <h2>5. Modalidades de Servicio y Suscripción</h2>
      <h3>5.1 Plan Gratuito (Free Tier)</h3>
      <p>Permite el acceso básico a funcionalidades contables con limitaciones en número de workspaces y operaciones mensuales.</p>
      <h3>5.2 Plan SoftPremium</h3>
      <p>
        Suscripción mensual o anual que desbloquea las funcionalidades de Inteligencia Artificial, incluyendo auditoría tributaria preventiva, 
        motor de cálculos laborales con IA y proyecciones de flujo de caja con calendario SUNAT.
      </p>
      <h3>5.3 Facturación</h3>
      <p>
        Los pagos se procesan a través de pasarelas de pago seguras certificadas PCI-DSS. Las suscripciones se renuevan automáticamente 
        salvo cancelación expresa del Usuario con al menos 3 días de anticipación al vencimiento del periodo.
      </p>

      <h2>6. Uso Aceptable</h2>
      <p>El Usuario se compromete a:</p>
      <ul>
        <li>Utilizar la plataforma exclusivamente para fines contables, tributarios y financieros lícitos</li>
        <li>No intentar acceder a datos de otros usuarios o workspaces ajenos</li>
        <li>No realizar ingeniería inversa, descompilar o intentar extraer el código fuente</li>
        <li>No utilizar la plataforma para lavado de activos, evasión tributaria o cualquier actividad ilegal</li>
        <li>No sobrecargar intencionalmente los servidores mediante scripts automatizados no autorizados</li>
      </ul>

      <h2>7. Propiedad Intelectual</h2>
      <p>
        {SYSTEM_NAME}, incluyendo su código fuente, diseño de interfaz, algoritmos de IA, documentación, logotipos y marca, 
        son propiedad exclusiva de <strong>{AUTHOR}</strong>, protegidos por el Decreto Legislativo 822 (Ley sobre el Derecho de Autor del Perú), 
        la Decisión 351 de la Comunidad Andina y los tratados internacionales aplicables (Convenio de Berna, OMPI).
      </p>
      <p>
        Los datos contables ingresados por el Usuario son y permanecen de su exclusiva propiedad. El Proveedor no adquiere 
        ningún derecho sobre dichos datos más allá de lo necesario para prestar el servicio.
      </p>

      <h2>8. Nivel de Servicio (SLA)</h2>
      <p>
        El Proveedor se esfuerza por mantener una disponibilidad del servicio del 99.5% mensual, excluyendo ventanas de mantenimiento programadas. 
        Las interrupciones por mantenimiento se comunicarán con al menos 24 horas de anticipación cuando sea posible.
      </p>

      <h2>9. Limitación de Responsabilidad</h2>
      <p>
        {SYSTEM_NAME} es una herramienta de asistencia contable. Las decisiones tributarias, laborales y financieras basadas en los resultados 
        del sistema son responsabilidad exclusiva del Usuario y/o su contador habilitado. El Proveedor no será responsable por:
      </p>
      <ul>
        <li>Errores en declaraciones tributarias derivados de datos incorrectos ingresados por el Usuario</li>
        <li>Multas, sanciones o intereses impuestos por SUNAT u otras entidades gubernamentales</li>
        <li>Pérdidas económicas derivadas de decisiones financieras basadas en proyecciones de IA</li>
        <li>Interrupciones de servicio causadas por fuerza mayor (desastres naturales, cortes eléctricos generalizados, pandemias)</li>
        <li>Los dictámenes y recomendaciones generados por el módulo de IA SoftPremium son orientativos y no sustituyen la opinión profesional de un contador público colegiado</li>
      </ul>

      <h2>10. Resolución y Cancelación</h2>
      <p>
        El Usuario puede cancelar su cuenta en cualquier momento. Tras la cancelación, los datos se conservarán por un periodo de 30 días 
        naturales, durante los cuales el Usuario podrá solicitar una exportación completa de su información. Transcurrido este plazo, 
        los datos serán eliminados de forma irreversible.
      </p>

      <h2>11. Modificaciones</h2>
      <p>
        El Proveedor se reserva el derecho de modificar estos Términos. Los cambios sustanciales se notificarán por correo electrónico 
        y/o mediante aviso destacado en la plataforma con al menos 15 días de anticipación. El uso continuado del servicio tras la 
        notificación constituye aceptación de los Términos modificados.
      </p>

      <h2>12. Ley Aplicable y Jurisdicción</h2>
      <p>
        Estos Términos se rigen por las leyes de la República del Perú. Para cualquier controversia derivada de estos Términos, 
        las partes se someten a la jurisdicción de los tribunales de Lima, Perú, renunciando a cualquier otro fuero que pudiera corresponderles. 
        Las partes podrán optar por someter la controversia a arbitraje ante el Centro de Arbitraje de la Cámara de Comercio de Lima.
      </p>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="legal-content-body">
      <h1>Política de Privacidad y Protección de Datos Personales</h1>
      <p className="legal-meta">Última actualización: {LAST_UPDATED} • Versión 2.0</p>

      <div className="legal-highlight">
        <strong>Marco Normativo:</strong> Esta política cumple con la Ley N° 29733 — Ley de Protección de Datos Personales del Perú, 
        su Reglamento aprobado por Decreto Supremo N° 003-2013-JUS, el Reglamento General de Protección de Datos (GDPR) de la Unión Europea, 
        y la California Consumer Privacy Act (CCPA) de los Estados Unidos.
      </div>

      <h2>1. Responsable del Tratamiento</h2>
      <p>
        <strong>Titular:</strong> {AUTHOR}<br/>
        <strong>Plataforma:</strong> {SYSTEM_NAME} — Sistema Contable en la Nube<br/>
        <strong>Contacto de Privacidad:</strong> privacidad@{DOMAIN}
      </p>

      <h2>2. Datos que Recopilamos</h2>
      <h3>2.1 Datos de Registro</h3>
      <ul>
        <li>Nombre completo, correo electrónico y contraseña (hash con salt bcrypt)</li>
        <li>Rol del usuario (administrador, cliente, estudiante)</li>
      </ul>
      <h3>2.2 Datos Empresariales</h3>
      <ul>
        <li>Razón social, RUC, régimen tributario, dirección fiscal</li>
        <li>Registros de compras, ventas, asientos contables y estados financieros</li>
        <li>Información de empleados (nombres, DNI, cargo, sueldo) para módulo de planillas</li>
      </ul>
      <h3>2.3 Datos de Integración SUNAT</h3>
      <ul>
        <li>Usuario SOL y Clave SOL (almacenados con cifrado AES-256-GCM)</li>
        <li>Client ID y Client Secret de API SUNAT (almacenados con cifrado AES-256-GCM)</li>
        <li>Certificados digitales (.pfx) para facturación electrónica</li>
      </ul>
      <h3>2.4 Datos Técnicos</h3>
      <ul>
        <li>Dirección IP, tipo de navegador, sistema operativo</li>
        <li>Logs de acceso y actividad dentro de la plataforma</li>
        <li>Tokens de sesión JWT con expiración temporal</li>
      </ul>

      <h2>3. Finalidad del Tratamiento</h2>
      <p>Los datos personales se tratan exclusivamente para:</p>
      <ul>
        <li><strong>Prestación del servicio:</strong> Gestión contable, tributaria, laboral y financiera</li>
        <li><strong>Integración con SUNAT:</strong> Sincronización con SIRE, descarga de propuestas y envío de declaraciones</li>
        <li><strong>Inteligencia Artificial:</strong> Análisis tributario preventivo, cálculos laborales y proyecciones financieras (módulo SoftPremium)</li>
        <li><strong>Comunicaciones:</strong> Notificaciones del servicio, alertas de vencimiento SUNAT y actualizaciones</li>
        <li><strong>Mejora del servicio:</strong> Análisis anónimo de patrones de uso para optimizar la plataforma</li>
      </ul>

      <h2>4. Base Legal del Tratamiento</h2>
      <ul>
        <li><strong>Consentimiento:</strong> El Usuario otorga su consentimiento al registrarse y aceptar estos términos (Art. 13.5, Ley 29733)</li>
        <li><strong>Ejecución contractual:</strong> El tratamiento es necesario para la prestación del servicio SaaS contratado</li>
        <li><strong>Obligación legal:</strong> Conservación de registros contables conforme al Código de Comercio y normativa tributaria peruana</li>
        <li><strong>Interés legítimo:</strong> Prevención de fraude y seguridad de la plataforma</li>
      </ul>

      <h2>5. Conservación de Datos</h2>
      <p>
        Los datos personales y contables se conservan durante la vigencia de la relación contractual y, tras la cancelación de la cuenta, 
        por un periodo adicional de 30 días para permitir la exportación. Los registros contables podrán conservarse hasta 5 años 
        conforme a las obligaciones tributarias del Código Tributario Peruano (Art. 43).
      </p>

      <h2>6. Derechos del Titular (Derechos ARCO)</h2>
      <p>Conforme a la Ley 29733 y el GDPR, el Usuario tiene derecho a:</p>
      <ul>
        <li><strong>Acceso:</strong> Solicitar confirmación de si se tratan sus datos y obtener copia de los mismos</li>
        <li><strong>Rectificación:</strong> Corregir datos inexactos o incompletos</li>
        <li><strong>Cancelación / Supresión:</strong> Solicitar la eliminación de sus datos cuando ya no sean necesarios</li>
        <li><strong>Oposición:</strong> Oponerse al tratamiento de sus datos por motivos legítimos</li>
        <li><strong>Portabilidad:</strong> Recibir sus datos en formato estructurado y de uso común (CSV, Excel)</li>
        <li><strong>Limitación:</strong> Solicitar la restricción del tratamiento en determinadas circunstancias</li>
      </ul>
      <p>
        Para ejercer estos derechos, el Usuario puede contactar a <strong>privacidad@{DOMAIN}</strong>. 
        Las solicitudes se atenderán en un plazo máximo de 10 días hábiles conforme a la normativa peruana, 
        o 30 días calendario conforme al GDPR.
      </p>

      <h2>7. Transferencias Internacionales</h2>
      <p>
        Los datos pueden ser procesados en servidores ubicados fuera del Perú (servicios de hosting cloud). 
        En tales casos, se garantiza un nivel adecuado de protección mediante cláusulas contractuales tipo 
        aprobadas y/o certificaciones de cumplimiento (como el EU-US Data Privacy Framework).
      </p>

      <h2>8. Menores de Edad</h2>
      <p>
        {SYSTEM_NAME} no está dirigido a menores de 18 años. No recopilamos intencionalmente datos de menores. 
        Si detectamos que un menor ha proporcionado datos, procederemos a su eliminación inmediata.
      </p>

      <h2>9. Autoridad de Protección de Datos</h2>
      <p>
        En Perú, la autoridad competente es la <strong>Autoridad Nacional de Protección de Datos Personales (ANPD)</strong> 
        del Ministerio de Justicia y Derechos Humanos. El Usuario tiene derecho a presentar reclamaciones ante esta entidad.
      </p>
    </div>
  );
}

function SecurityContent() {
  return (
    <div className="legal-content-body">
      <h1>Política de Seguridad de la Información</h1>
      <p className="legal-meta">Última actualización: {LAST_UPDATED} • Versión 2.0</p>

      <div className="legal-highlight">
        {SYSTEM_NAME} implementa controles de seguridad alineados con los principios de ISO/IEC 27001:2022 
        y las mejores prácticas de seguridad para aplicaciones SaaS financieras.
      </div>

      <h2>1. Cifrado de Datos</h2>
      <h3>1.1 Datos en Reposo (At Rest)</h3>
      <ul>
        <li><strong>Credenciales SUNAT:</strong> Cifradas con AES-256-GCM (Advanced Encryption Standard) con vectores de inicialización (IV) únicos de 16 bytes y tags de autenticación para prevenir manipulación</li>
        <li><strong>Contraseñas de usuario:</strong> Hash criptográfico con bcrypt (factor de costo 12) y sal aleatoria — las contraseñas nunca se almacenan en texto plano</li>
        <li><strong>Base de datos:</strong> Cifrado a nivel de disco en la infraestructura de hosting</li>
      </ul>
      <h3>1.2 Datos en Tránsito (In Transit)</h3>
      <ul>
        <li><strong>TLS 1.3:</strong> Todas las comunicaciones entre el navegador del usuario y los servidores están cifradas con TLS 1.3</li>
        <li><strong>HSTS:</strong> Cabeceras HTTP Strict Transport Security implementadas para forzar conexiones seguras</li>
        <li><strong>Certificate Pinning:</strong> Validación de certificados SSL para prevenir ataques man-in-the-middle</li>
      </ul>

      <h2>2. Autenticación y Control de Acceso</h2>
      <ul>
        <li><strong>JSON Web Tokens (JWT):</strong> Autenticación sin estado con tokens firmados y expiración temporal</li>
        <li><strong>Control de Roles:</strong> Sistema RBAC (Role-Based Access Control) con roles diferenciados: administrador, cliente y estudiante</li>
        <li><strong>Aislamiento de Workspaces:</strong> Cada empresa opera en un workspace aislado, impidiendo el acceso cruzado entre clientes</li>
        <li><strong>Middleware de Autorización:</strong> Todas las rutas API están protegidas por middleware de autenticación y verificación de permisos</li>
      </ul>

      <h2>3. Arquitectura de Seguridad</h2>
      <ul>
        <li><strong>Separación de Esquemas:</strong> Los datos contables (esquema <code>public</code>) están aislados del módulo de IA (esquema <code>premium</code>)</li>
        <li><strong>Lectura Segura de IA:</strong> El motor de IA accede a los datos del core exclusivamente en modo lectura a través de una capa intermedia (<code>coreReader</code>) — ningún algoritmo de IA modifica registros contables</li>
        <li><strong>Pool de Conexiones Dedicado:</strong> Las operaciones Premium utilizan un pool de conexiones separado del core transaccional</li>
        <li><strong>Idempotencia:</strong> Las operaciones de escritura utilizan cláusulas <code>ON CONFLICT</code> para prevenir duplicación de registros ante reintentos</li>
      </ul>

      <h2>4. Auditoría y Trazabilidad</h2>
      <ul>
        <li><strong>Auditoría de IA:</strong> Toda generación de contenido por IA (dictámenes, contratos) se registra en <code>premium.ai_generation_audit</code> con hash MD5 del contexto, modelo utilizado y estado de revisión humana</li>
        <li><strong>Logs de Acceso:</strong> Registro de todas las sesiones, operaciones críticas y accesos a datos sensibles</li>
        <li><strong>Inmutabilidad de Registros:</strong> Los asientos contables centralizados mantienen trazabilidad completa</li>
      </ul>

      <h2>5. Protección contra Amenazas</h2>
      <ul>
        <li><strong>Inyección SQL:</strong> Uso exclusivo de consultas parametrizadas (prepared statements) en PostgreSQL y SQLite</li>
        <li><strong>XSS:</strong> Sanitización de entradas y renderizado seguro con React (escape automático de JSX)</li>
        <li><strong>CSRF:</strong> Protección mediante tokens de sesión y validación de origen</li>
        <li><strong>Rate Limiting:</strong> Limitación de intentos de login y solicitudes API para prevenir ataques de fuerza bruta</li>
      </ul>

      <h2>6. Gestión de Incidentes</h2>
      <p>
        En caso de brecha de seguridad, el Proveedor se compromete a:
      </p>
      <ul>
        <li>Notificar a los usuarios afectados dentro de las 72 horas siguientes al descubrimiento (conforme al GDPR)</li>
        <li>Reportar a la Autoridad Nacional de Protección de Datos Personales del Perú</li>
        <li>Implementar medidas correctivas inmediatas</li>
        <li>Documentar el incidente y las acciones tomadas</li>
      </ul>

      <h2>7. Respaldos y Continuidad</h2>
      <ul>
        <li><strong>Backups Automáticos:</strong> Respaldos diarios de la base de datos con retención de 30 días</li>
        <li><strong>Redundancia:</strong> Infraestructura con alta disponibilidad y failover automático</li>
        <li><strong>Plan de Recuperación:</strong> RPO (Recovery Point Objective) de 24 horas y RTO (Recovery Time Objective) de 4 horas</li>
      </ul>

      <h2>8. Reporte de Vulnerabilidades</h2>
      <p>
        Si descubre una vulnerabilidad de seguridad, le agradecemos que nos lo comunique de manera responsable a <strong>seguridad@{DOMAIN}</strong>. 
        Nos comprometemos a investigar y responder en un plazo de 48 horas hábiles.
      </p>
    </div>
  );
}

function ConfidentialityContent() {
  return (
    <div className="legal-content-body">
      <h1>Acuerdo de Confidencialidad</h1>
      <p className="legal-meta">Última actualización: {LAST_UPDATED} • Versión 2.0</p>

      <div className="legal-highlight">
        <strong>Marco Legal:</strong> Este acuerdo se fundamenta en los artículos 154 al 157 del Código Penal Peruano 
        (violación del secreto profesional), la Ley N° 30096 (Ley de Delitos Informáticos) y la Ley N° 26702 
        (Ley General del Sistema Financiero — secreto bancario aplicado por analogía a datos contables).
      </div>

      <h2>1. Alcance del Compromiso</h2>
      <p>
        {SYSTEM_NAME} y su titular, <strong>{AUTHOR}</strong>, asumen un compromiso inquebrantable de confidencialidad 
        sobre toda la información procesada en la plataforma. Este compromiso abarca:
      </p>
      <ul>
        <li>Información tributaria de las empresas (declaraciones, comprobantes, libros contables)</li>
        <li>Datos de empleados y planillas (remuneraciones, datos personales)</li>
        <li>Estados financieros y proyecciones de flujo de caja</li>
        <li>Credenciales de acceso a sistemas de terceros (SUNAT, bancos)</li>
        <li>Estrategias contables y decisiones financieras del Usuario</li>
      </ul>

      <h2>2. Obligaciones del Proveedor</h2>
      <ul>
        <li>No divulgar, transferir, vender ni compartir datos de los usuarios con terceros bajo ninguna circunstancia, salvo requerimiento judicial expreso</li>
        <li>No utilizar los datos contables de los usuarios para fines de marketing, perfilamiento comercial o venta de información</li>
        <li>Implementar y mantener medidas técnicas y organizativas de protección (cifrado, aislamiento, control de acceso)</li>
        <li>Limitar el acceso interno a los datos estrictamente al personal técnico necesario para la operación del servicio</li>
        <li>Destruir de manera segura los datos tras la finalización de la relación contractual y expiración del periodo de retención</li>
      </ul>

      <h2>3. Obligaciones del Usuario</h2>
      <ul>
        <li>Mantener la confidencialidad de sus credenciales de acceso (correo y contraseña)</li>
        <li>No compartir tokens de sesión ni enlaces autenticados con terceros</li>
        <li>Notificar inmediatamente al Proveedor ante sospecha de acceso no autorizado</li>
        <li>Utilizar dispositivos seguros y redes confiables para acceder a la plataforma</li>
      </ul>

      <h2>4. Excepciones</h2>
      <p>Las obligaciones de confidencialidad no aplican a información que:</p>
      <ul>
        <li>Sea de dominio público sin culpa del Proveedor</li>
        <li>Deba ser revelada por mandato judicial o requerimiento de la autoridad tributaria (SUNAT) en ejercicio de sus facultades de fiscalización</li>
        <li>Sea proporcionada al Proveedor por un tercero legítimo sin obligación de confidencialidad</li>
      </ul>

      <h2>5. Duración</h2>
      <p>
        Las obligaciones de confidencialidad se mantendrán vigentes durante toda la relación contractual y por un periodo de 
        <strong> 5 años</strong> adicionales tras su terminación, conforme a los plazos de prescripción del Código Tributario Peruano.
      </p>

      <h2>6. Consecuencias del Incumplimiento</h2>
      <p>
        El incumplimiento de este acuerdo dará lugar a las acciones legales correspondientes conforme a la legislación peruana, 
        incluyendo responsabilidad civil por daños y perjuicios y, en su caso, responsabilidad penal por violación del secreto profesional 
        (Art. 165 del Código Penal Peruano, pena privativa de libertad no mayor de 2 años).
      </p>
    </div>
  );
}

function CookiesContent() {
  return (
    <div className="legal-content-body">
      <h1>Política de Cookies y Almacenamiento Local</h1>
      <p className="legal-meta">Última actualización: {LAST_UPDATED} • Versión 2.0</p>

      <h2>1. ¿Qué son las Cookies?</h2>
      <p>
        Las cookies son pequeños archivos de texto que los sitios web almacenan en el navegador del usuario. 
        {SYSTEM_NAME} utiliza tecnologías de almacenamiento local para garantizar el correcto funcionamiento 
        de la plataforma.
      </p>

      <h2>2. Tipos de Almacenamiento Utilizado</h2>

      <h3>2.1 Cookies Estrictamente Necesarias</h3>
      <table className="legal-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Propósito</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>softcontable_token</code></td>
            <td>Token JWT de sesión para autenticación del usuario</td>
            <td>Sesión (se elimina al cerrar sesión)</td>
          </tr>
        </tbody>
      </table>
      <p>Estas cookies son esenciales para el funcionamiento del sistema y no requieren consentimiento previo.</p>

      <h3>2.2 LocalStorage (Almacenamiento Local del Navegador)</h3>
      <table className="legal-table">
        <thead>
          <tr>
            <th>Clave</th>
            <th>Propósito</th>
            <th>Datos Almacenados</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>softcontable_token</code></td>
            <td>Persistencia de sesión entre visitas</td>
            <td>Token JWT cifrado</td>
          </tr>
          <tr>
            <td><code>softcontable_theme</code></td>
            <td>Preferencia de tema visual (claro/oscuro)</td>
            <td>"light" o "dark"</td>
          </tr>
          <tr>
            <td><code>softcontable_dismissed_ios_tip</code></td>
            <td>Recordar si se descartó el aviso de instalación PWA</td>
            <td>"true"</td>
          </tr>
        </tbody>
      </table>

      <h3>2.3 Cookies de Terceros</h3>
      <p>
        {SYSTEM_NAME} <strong>no utiliza</strong> cookies de terceros para publicidad, tracking ni perfilamiento. 
        No integramos píxeles de seguimiento de redes sociales ni servicios de retargeting.
      </p>

      <h2>3. Cómo Gestionar las Cookies</h2>
      <p>
        El Usuario puede configurar su navegador para bloquear o eliminar cookies. Sin embargo, deshabilitar las cookies esenciales 
        impedirá el correcto funcionamiento de la plataforma. Las instrucciones varían según el navegador:
      </p>
      <ul>
        <li><strong>Chrome:</strong> Configuración → Privacidad y seguridad → Cookies</li>
        <li><strong>Firefox:</strong> Configuración → Privacidad → Cookies y datos del sitio</li>
        <li><strong>Safari:</strong> Preferencias → Privacidad → Cookies y datos de sitios web</li>
        <li><strong>Edge:</strong> Configuración → Cookies y permisos del sitio</li>
      </ul>

      <h2>4. Consentimiento</h2>
      <p>
        Conforme al GDPR y a la Ley 29733, el uso continuado de {SYSTEM_NAME} tras la aceptación de los Términos 
        de Servicio constituye consentimiento informado para el uso de las cookies estrictamente necesarias descritas. 
        No se utilizan cookies opcionales que requieran consentimiento adicional.
      </p>
    </div>
  );
}

function EulaContent() {
  return (
    <div className="legal-content-body">
      <h1>Acuerdo de Licencia de Usuario Final (EULA)</h1>
      <p className="legal-meta">Última actualización: {LAST_UPDATED} • Versión 2.0</p>

      <h2>1. Otorgamiento de Licencia</h2>
      <p>
        <strong>{AUTHOR}</strong>, en calidad de autor y titular de los derechos patrimoniales de <strong>{SYSTEM_NAME}</strong>, 
        otorga al Usuario una licencia limitada, no exclusiva, no transferible y revocable para acceder y utilizar la plataforma 
        a través de internet (modelo SaaS), sujeta al cumplimiento de estos términos.
      </p>

      <h2>2. Derechos de Autor</h2>
      <p>
        {SYSTEM_NAME} está protegido por:
      </p>
      <ul>
        <li><strong>Decreto Legislativo 822</strong> — Ley sobre el Derecho de Autor de la República del Perú</li>
        <li><strong>Decisión 351</strong> — Régimen Común sobre Derecho de Autor y Derechos Conexos de la Comunidad Andina</li>
        <li><strong>Convenio de Berna</strong> — Para la Protección de las Obras Literarias y Artísticas</li>
        <li><strong>Tratados de la OMPI</strong> — Organización Mundial de la Propiedad Intelectual</li>
      </ul>
      <p>
        El autor original y titular de todos los derechos de propiedad intelectual es <strong>{AUTHOR}</strong>.
      </p>

      <h2>3. Restricciones</h2>
      <p>El Usuario NO podrá:</p>
      <ul>
        <li>Copiar, modificar, distribuir o crear obras derivadas del software</li>
        <li>Realizar ingeniería inversa, descompilar, desensamblar o intentar extraer el código fuente</li>
        <li>Sublicenciar, alquilar, prestar o transferir sus derechos de uso a terceros</li>
        <li>Remover, alterar u ocultar avisos de propiedad intelectual, copyright o marcas</li>
        <li>Utilizar la plataforma para desarrollar un producto o servicio competidor</li>
        <li>Automatizar el acceso mediante bots, scrapers o herramientas similares sin autorización</li>
      </ul>

      <h2>4. Actualizaciones</h2>
      <p>
        El Proveedor podrá realizar actualizaciones, mejoras y correcciones al software de manera periódica. 
        Estas actualizaciones forman parte integral de la licencia y se sujetan a los mismos términos.
      </p>

      <h2>5. Terminación de la Licencia</h2>
      <p>
        Esta licencia se termina automáticamente si el Usuario incumple cualquiera de sus términos. 
        Tras la terminación, el Usuario deberá cesar inmediatamente todo uso de la plataforma. 
        Las disposiciones sobre propiedad intelectual sobreviven a la terminación de la licencia.
      </p>

      <h2>6. Garantías y Descargo</h2>
      <p>
        El software se proporciona "TAL CUAL" (AS IS). Si bien el Proveedor se esfuerza por mantener la calidad y precisión del sistema, 
        no garantiza que el software estará libre de errores o interrupciones. Las garantías implícitas de comerciabilidad 
        y adecuación para un propósito particular se excluyen en la medida permitida por la ley peruana.
      </p>

      <h2>7. Registro de la Obra</h2>
      <p>
        Los derechos de autor sobre {SYSTEM_NAME} podrán ser registrados ante INDECOPI (Instituto Nacional de Defensa de la Competencia 
        y de la Protección de la Propiedad Intelectual) conforme al procedimiento establecido en el Decreto Legislativo 822.
      </p>
    </div>
  );
}

function LegalNoticeContent() {
  return (
    <div className="legal-content-body">
      <h1>Aviso Legal</h1>
      <p className="legal-meta">Última actualización: {LAST_UPDATED} • Versión 2.0</p>

      <h2>1. Identificación del Titular</h2>
      <table className="legal-table">
        <tbody>
          <tr><td><strong>Titular y Autor</strong></td><td>{AUTHOR}</td></tr>
          <tr><td><strong>Plataforma</strong></td><td>{SYSTEM_NAME} — Sistema Contable en la Nube (SaaS)</td></tr>
          <tr><td><strong>Versión</strong></td><td>2.0 (2026)</td></tr>
          <tr><td><strong>Tipo de Software</strong></td><td>Software as a Service (SaaS) — Contabilidad Electrónica con IA</td></tr>
          <tr><td><strong>País de Origen</strong></td><td>República del Perú</td></tr>
          <tr><td><strong>Contacto General</strong></td><td>contacto@{DOMAIN}</td></tr>
        </tbody>
      </table>

      <h2>2. Objeto del Sitio Web</h2>
      <p>
        {SYSTEM_NAME} es una plataforma SaaS de contabilidad electrónica diseñada para contadores públicos, estudios contables y empresas 
        del Perú que requieren gestionar sus obligaciones tributarias, laborales y financieras de manera digital, integrada con los sistemas 
        de SUNAT y cumpliendo con la normativa contable y tributaria peruana vigente.
      </p>

      <h2>3. Propiedad Intelectual</h2>
      <p>
        Todo el contenido de {SYSTEM_NAME} — incluyendo código fuente, algoritmos de inteligencia artificial, diseño de interfaz de usuario, 
        textos, logotipos, iconografía, estructura de base de datos y documentación técnica — es propiedad exclusiva de <strong>{AUTHOR}</strong>, 
        protegido bajo las leyes peruanas e internacionales de propiedad intelectual.
      </p>
      <p>
        Se prohíbe expresamente la reproducción, distribución, comunicación pública o transformación de cualquier elemento de la plataforma 
        sin autorización previa y por escrito del titular.
      </p>

      <h2>4. Exención de Responsabilidad Profesional</h2>
      <div className="legal-highlight legal-warning">
        <strong>⚠️ Advertencia Importante:</strong> {SYSTEM_NAME} es una herramienta de asistencia y automatización contable. 
        No sustituye el criterio profesional de un Contador Público Colegiado. Los resultados, análisis y recomendaciones 
        generados por la plataforma — incluyendo los dictámenes del módulo de IA SoftPremium — son orientativos y deben ser 
        validados por un profesional habilitado antes de su uso en declaraciones oficiales ante SUNAT u otros organismos.
      </div>

      <h2>5. Normativa Aplicable</h2>
      <p>Este aviso legal y toda la relación derivada del uso de {SYSTEM_NAME} se rigen por:</p>
      <ul>
        <li><strong>Constitución Política del Perú</strong> — Art. 2 inciso 6 (derecho a la intimidad) y Art. 2 inciso 10 (secreto de comunicaciones)</li>
        <li><strong>Código Civil Peruano</strong> — Libro VII: Fuentes de las Obligaciones (contratos)</li>
        <li><strong>Ley N° 29733</strong> — Ley de Protección de Datos Personales</li>
        <li><strong>Ley N° 29571</strong> — Código de Protección y Defensa del Consumidor</li>
        <li><strong>Decreto Legislativo N° 822</strong> — Ley sobre el Derecho de Autor</li>
        <li><strong>Ley N° 27269</strong> — Ley de Firmas y Certificados Digitales</li>
        <li><strong>Ley N° 30096</strong> — Ley de Delitos Informáticos</li>
        <li><strong>Decreto Legislativo N° 1412</strong> — Ley de Gobierno Digital</li>
        <li><strong>Reglamento General de Protección de Datos (GDPR)</strong> — Unión Europea</li>
      </ul>

      <h2>6. Jurisdicción y Resolución de Controversias</h2>
      <p>
        Para cualquier controversia derivada del uso de {SYSTEM_NAME}, las partes se someten a la jurisdicción de los 
        juzgados y tribunales del Distrito Judicial de Lima, República del Perú.
      </p>
      <p>
        Alternativamente, las partes podrán someter sus controversias a arbitraje institucional ante el 
        <strong> Centro de Arbitraje de la Cámara de Comercio de Lima</strong>, de conformidad con la 
        Ley General de Arbitraje (Decreto Legislativo N° 1071).
      </p>

      <h2>7. Contacto</h2>
      <p>Para consultas legales, ejercicio de derechos ARCO o reclamaciones:</p>
      <ul>
        <li><strong>Asuntos Generales:</strong> contacto@{DOMAIN}</li>
        <li><strong>Privacidad y Datos Personales:</strong> privacidad@{DOMAIN}</li>
        <li><strong>Seguridad:</strong> seguridad@{DOMAIN}</li>
      </ul>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export const LegalPages: React.FC<LegalPagesProps> = ({ initialSection = 'terms', onClose }) => {
  const [activeSection, setActiveSection] = useState<LegalSection>(initialSection);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderContent = () => {
    switch (activeSection) {
      case 'terms': return <TermsContent />;
      case 'privacy': return <PrivacyContent />;
      case 'security': return <SecurityContent />;
      case 'confidentiality': return <ConfidentialityContent />;
      case 'cookies': return <CookiesContent />;
      case 'eula': return <EulaContent />;
      case 'legal': return <LegalNoticeContent />;
      default: return <TermsContent />;
    }
  };

  const currentSection = sections.find(s => s.id === activeSection);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="w-full max-w-5xl h-[95vh] sm:h-[90vh] bg-app-surface border border-app-border rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        
        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-app-border bg-app-bg/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/10 rounded-xl">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-app-text">
                Marco Legal & Cumplimiento
              </h2>
              <p className="text-[10px] text-app-muted font-bold uppercase tracking-wider">
                {SYSTEM_NAME} SaaS • {AUTHOR} • {LAST_UPDATED}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-app-hover rounded-xl transition-all cursor-pointer text-app-muted hover:text-app-text"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* ═══ SIDEBAR DESKTOP ═══ */}
          <nav className="hidden md:flex flex-col w-64 border-r border-app-border bg-app-bg/30 py-3 px-2 shrink-0 overflow-y-auto">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer mb-0.5 ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-black border border-blue-500/20'
                      : 'text-app-muted hover:bg-app-hover hover:text-app-text font-bold'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] uppercase tracking-wider leading-tight">{section.label}</span>
                </button>
              );
            })}

            <div className="mt-auto pt-4 px-3 border-t border-app-border">
              <p className="text-[9px] text-app-muted font-bold uppercase tracking-widest leading-relaxed">
                © 2026 {AUTHOR}
              </p>
              <p className="text-[9px] text-app-muted/60 font-semibold mt-1">
                Todos los derechos reservados. Protegido por D.L. 822 y Convenio de Berna.
              </p>
            </div>
          </nav>

          {/* ═══ MOBILE NAV ═══ */}
          <div className="md:hidden border-b border-app-border bg-app-bg/30 shrink-0">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-between w-full px-4 py-3 text-xs font-black uppercase tracking-wider text-app-text cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {currentSection && <currentSection.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                {currentSection?.label}
              </span>
              <ChevronRight className={`w-4 h-4 transition-transform ${mobileMenuOpen ? 'rotate-90' : ''}`} />
            </button>
            {mobileMenuOpen && (
              <div className="px-2 pb-2 space-y-0.5 animate-fade-in">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => { setActiveSection(section.id); setMobileMenuOpen(false); }}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider cursor-pointer ${
                        section.id === activeSection ? 'bg-blue-600/10 text-blue-600' : 'text-app-muted hover:bg-app-hover'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {section.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ═══ CONTENT ═══ */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 legal-scroll">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* ═══ ESTILOS LEGALES ═══ */}
      <style>{`
        .legal-content-body {
          color: var(--app-text, #0f172a);
        }
        .legal-content-body h1 {
          color: var(--app-text, #0f172a);
          font-size: 1.35rem;
          font-weight: 900;
          letter-spacing: -0.025em;
          margin-bottom: 0.5rem;
        }
        .legal-content-body h2 {
          color: var(--app-text, #0f172a);
          font-size: 0.95rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--app-border, rgba(128,128,128,0.2));
        }
        .legal-content-body h3 {
          color: var(--app-text, #1e293b);
          font-size: 0.85rem;
          font-weight: 800;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .legal-content-body p {
          color: var(--app-text-muted, #334155);
          font-size: 0.825rem;
          line-height: 1.7;
          margin-bottom: 0.75rem;
          font-weight: 500;
        }
        .legal-content-body ul {
          list-style: none;
          padding-left: 0;
          margin-bottom: 1rem;
        }
        .legal-content-body ul li {
          color: var(--app-text-muted, #334155);
          font-size: 0.825rem;
          line-height: 1.7;
          padding-left: 1.25rem;
          position: relative;
          margin-bottom: 0.35rem;
          font-weight: 500;
        }
        .legal-content-body ul li::before {
          content: '▸';
          position: absolute;
          left: 0;
          color: #2563eb;
          font-weight: 900;
        }
        .legal-content-body strong {
          color: var(--app-text, #0f172a);
          font-weight: 800;
        }
        .legal-content-body code {
          font-size: 0.75rem;
          background: rgba(37, 99, 235, 0.08);
          color: #1d4ed8;
          padding: 0.15rem 0.4rem;
          border-radius: 0.35rem;
          font-weight: 700;
          border: 1px solid rgba(37, 99, 235, 0.15);
        }
        .legal-meta {
          color: #64748b !important;
          font-size: 0.7rem !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 1.5rem !important;
        }
        .legal-highlight {
          background: rgba(37, 99, 235, 0.06);
          border: 1px solid rgba(37, 99, 235, 0.2);
          border-radius: 1rem;
          padding: 1rem 1.25rem;
          font-size: 0.8rem;
          line-height: 1.7;
          margin-bottom: 1.5rem;
          font-weight: 500;
          color: var(--app-text, #0f172a);
        }
        .legal-highlight.legal-warning {
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.3);
          color: #92400e;
        }
        .legal-table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.78rem;
        }
        .legal-table th,
        .legal-table td {
          padding: 0.6rem 0.75rem;
          border: 1px solid var(--app-border, rgba(128,128,128,0.2));
          text-align: left;
          font-weight: 600;
          color: var(--app-text, #0f172a);
        }
        .legal-table th {
          background: rgba(37, 99, 235, 0.08);
          color: #1e40af;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.05em;
        }
        .legal-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .legal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .legal-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.3);
          border-radius: 3px;
        }
        .legal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.5);
        }

        /* ─── MODO OSCURO CONTRASTES ─── */
        .dark .legal-content-body { color: #f8fafc; }
        .dark .legal-content-body h1,
        .dark .legal-content-body h2,
        .dark .legal-content-body h3,
        .dark .legal-content-body strong { color: #f8fafc; }
        .dark .legal-content-body p,
        .dark .legal-content-body ul li { color: #cbd5e1; }
        .dark .legal-content-body code { color: #60a5fa; background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.3); }
        .dark .legal-meta { color: #94a3b8 !important; }
        .dark .legal-highlight { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.3); color: #f8fafc; }
        .dark .legal-highlight.legal-warning { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.35); color: #fef08a; }
        .dark .legal-table th, .dark .legal-table td { border-color: rgba(255, 255, 255, 0.1); color: #f8fafc; }
        .dark .legal-table th { background: rgba(59, 130, 246, 0.15); color: #93c5fd; }
      `}</style>
    </div>
  );
};

export default LegalPages;
