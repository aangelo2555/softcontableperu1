const nodemailer = require('nodemailer');

// Configuración del transportador de correo Nodemailer (Gmail / SMTP Genérico para Railway)
const createTransporter = (usePort587 = true) => {
    const user = process.env.GMAIL_USER || process.env.SMTP_USER;
    const rawPass = process.env.GMAIL_PASS || process.env.SMTP_PASS;

    if (!user || !rawPass) {
        return null;
    }

    // Quitar espacios automáticamente si se copió de Google con separadores (ej: "fedd psgu vimk sjxv" -> "feddpsguvimksjxv")
    const pass = rawPass.replace(/\s+/g, '');

    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            connectionTimeout: 7000,
            greetingTimeout: 7000,
            socketTimeout: 8000,
            auth: { user, pass }
        });
    }

    // Gmail en entorno Cloud (Railway): Port 587 STARTTLS es la vía estándar compatible
    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: usePort587 ? 587 : 465,
        secure: !usePort587, // false para 587 (STARTTLS), true para 465 (SSL)
        requireTLS: usePort587,
        connectionTimeout: 7000,
        greetingTimeout: 7000,
        socketTimeout: 8000,
        auth: {
            user: user,
            pass: pass
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};

/**
 * Envia un correo electrónico con el código OTP de 6 dígitos para restablecer contraseña.
 * @param {Object} params
 * @param {string} params.toEmail - Correo del usuario
 * @param {string} params.otpCode - Código de 6 dígitos
 * @param {string} [params.userName] - Nombre opcional del usuario
 */
async function sendResetOtpEmail({ toEmail, otpCode, userName }) {
    console.log(`[EMAIL SERVICE] Intentando enviar OTP para: ${toEmail}`);
    
    let transporter = createTransporter(true); // Intento 1: Puerto 587 STARTTLS

    // Plantilla HTML profesional SOFTCONTABLE SaaS
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 20px; color: #0f172a; }
                .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
                .header { text-align: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
                .logo-title { font-size: 22px; font-weight: 900; color: #0f172a; letter-spacing: 1px; margin: 0; }
                .logo-blue { color: #2563eb; }
                .otp-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
                .otp-code { font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #1e40af; margin: 10px 0; font-family: 'Courier New', Courier, monospace; }
                .badge { display: inline-block; background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px; }
                .footer { text-align: center; margin-top: 28px; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 16px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="logo-title">SOFT <span class="logo-blue">CONTABLE</span></h1>
                    <p style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Sistema Contable en la Nube v2.0</p>
                </div>

                <p style="font-size: 14px; margin-bottom: 8px;">Hola <strong>${userName || 'Usuario'}</strong>,</p>
                <p style="font-size: 13px; color: #334155; line-height: 1.6;">
                    Recibimos una solicitud para restablecer la contraseña de tu cuenta registrada en <strong>SOFTCONTABLE SaaS</strong>.
                </p>

                <div class="otp-card">
                    <span class="badge">Código de Verificación OTP</span>
                    <div class="otp-code">${otpCode}</div>
                    <p style="font-size: 11px; color: #64748b; margin: 0;">Este código vence en <strong>15 minutos</strong>.</p>
                </div>

                <p style="font-size: 12px; color: #475569;">
                    Ingresa este código de 6 dígitos en la pantalla de recuperación del sistema para validar tu identidad. Si no solicitaste este cambio, puedes ignorar este mensaje de manera segura.
                </p>

                <div class="footer">
                    <p style="margin: 0;">&copy; 2026 SOFTCONTABLE SaaS. Todos los derechos reservados.</p>
                    <p style="margin: 4px 0 0 0; color: #94a3b8;">Seguridad Contable &amp; Tributaria SUNAT Perú 2026</p>
                </div>
            </div>
        </body>
        </html>
    `;

    if (!transporter) {
        console.log(`\n==================================================`);
        console.log(`[EMAIL SERVICE] ⚠️ No se detectó GMAIL_USER ni GMAIL_PASS en las variables de entorno de Railway.`);
        console.log(`[SECURITY OTP DEV CODE] Correo: ${toEmail} | OTP: ${otpCode}`);
        console.log(`==================================================\n`);

        return {
            success: true,
            simulated: true,
            message: `Código generado.`
        };
    }

    const senderEmail = process.env.GMAIL_USER || process.env.SMTP_USER;
    const mailOptions = {
        from: `"SOFTCONTABLE Security" <${senderEmail}>`,
        to: toEmail,
        subject: `🔑 ${otpCode} es tu código de verificación SOFTCONTABLE`,
        html: htmlContent
    };

    // Intento 1: Puerto 587 (STARTTLS - Estándar Cloud)
    try {
        const sendPromise = transporter.sendMail(mailOptions);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT_SMTP_587')), 6000)
        );

        const info = await Promise.race([sendPromise, timeoutPromise]);
        console.log(`[EMAIL SERVICE SUCCESS] ✅ Correo enviado exitosamente a ${toEmail} (Puerto 587). ID: ${info.messageId}`);
        return { success: true, simulated: false, messageId: info.messageId };
    } catch (err587) {
        console.warn(`[EMAIL SERVICE WARN] Puerto 587 falló (${err587.message}). Intentando Puerto 465 SSL...`);
        
        // Intento 2: Puerto 465 (SSL)
        try {
            transporter = createTransporter(false);
            const sendPromise465 = transporter.sendMail(mailOptions);
            const timeoutPromise465 = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_SMTP_465')), 6000)
            );

            const info465 = await Promise.race([sendPromise465, timeoutPromise465]);
            console.log(`[EMAIL SERVICE SUCCESS] ✅ Correo enviado exitosamente a ${toEmail} (Puerto 465). ID: ${info465.messageId}`);
            return { success: true, simulated: false, messageId: info465.messageId };
        } catch (err465) {
            console.error(`[EMAIL SERVICE ERROR] ❌ Ambos puertos SMTP (587 y 465) fallaron o expiraron en Railway.`);
            console.log(`[SECURITY OTP FALLBACK] Código OTP para ${toEmail}: ${otpCode}`);
            return {
                success: true,
                simulated: true,
                error: err465.message,
                message: `Código generado correctamente.`
            };
        }
    }
}

module.exports = {
    sendResetOtpEmail
};
