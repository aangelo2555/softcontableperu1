const nodemailer = require('nodemailer');
const axios = require('axios');

// Configuración del transportador de correo Nodemailer (Gmail / SMTP Genérico)
const createTransporter = (usePort587 = true) => {
    const user = process.env.GMAIL_USER || process.env.SMTP_USER;
    const rawPass = process.env.GMAIL_PASS || process.env.SMTP_PASS;

    if (!user || !rawPass) {
        return null;
    }

    const pass = rawPass.replace(/\s+/g, '');

    if (process.env.SMTP_HOST) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 5000,
            auth: { user, pass }
        });
    }

    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: usePort587 ? 587 : 465,
        secure: !usePort587,
        requireTLS: usePort587,
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000,
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
 * Despachador central de correos con reintentos en HTTPS (Brevo / Resend / SendGrid) y SMTP (Nodemailer).
 */
async function sendHtmlEmail({ toEmail, subject, htmlContent, debugLabel = 'EMAIL', otpCode = null, verificationUrl = null }) {
    console.log(`\n========================================================================`);
    console.log(`📬 [EMAIL SERVICE] Preparando despacho [${debugLabel}]`);
    console.log(`👉 Destinatario : ${toEmail}`);
    console.log(`👉 Asunto       : ${subject}`);
    if (otpCode) console.log(`🔑 CÓDIGO OTP   : [ ${otpCode} ]`);
    if (verificationUrl) console.log(`🔗 ENLACE ACT.  : ${verificationUrl}`);
    console.log(`========================================================================\n`);

    // 1. INTENTO VÍA BREVO HTTP API (Puerto 443 HTTPS - Recomendado para Railway / Cloud)
    const brevoApiKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
    if (brevoApiKey) {
        try {
            console.log('[EMAIL SERVICE] 🚀 Enviando vía Brevo HTTP API (Puerto 443 HTTPS)...');
            const senderEmail = process.env.BREVO_SENDER || process.env.GMAIL_USER || 'aangelo2555@gmail.com';
            const brevoRes = await axios.post('https://api.brevo.com/v3/smtp/email', {
                sender: { name: 'SOFTCONTABLE', email: senderEmail },
                to: [{ email: toEmail }],
                subject,
                htmlContent
            }, {
                headers: {
                    'api-key': brevoApiKey.trim(),
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log(`[EMAIL SERVICE BREVO SUCCESS] ✅ Correo entregado vía Brevo HTTPS. MessageID: ${brevoRes.data.messageId || 'OK'}`);
            return { success: true, simulated: false, provider: 'brevo', messageId: brevoRes.data.messageId };
        } catch (brevoErr) {
            console.error(`[EMAIL SERVICE BREVO ERROR] ⚠️ Brevo falló:`, brevoErr.response?.data || brevoErr.message);
        }
    }

    // 2. INTENTO VÍA RESEND HTTP API (Puerto 443 HTTPS)
    if (process.env.RESEND_API_KEY) {
        try {
            console.log('[EMAIL SERVICE] 🚀 Enviando vía Resend HTTP API (Puerto 443 HTTPS)...');
            const fromSender = process.env.RESEND_FROM || 'SOFTCONTABLE <onboarding@resend.dev>';
            const resendRes = await axios.post('https://api.resend.com/emails', {
                from: fromSender,
                to: [toEmail],
                subject,
                html: htmlContent
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log(`[EMAIL SERVICE RESEND SUCCESS] ✅ Correo entregado vía Resend HTTPS. ID: ${resendRes.data.id}`);
            return { success: true, simulated: false, provider: 'resend', messageId: resendRes.data.id };
        } catch (resendErr) {
            console.error(`[EMAIL SERVICE RESEND ERROR] ⚠️ Resend falló:`, resendErr.response?.data || resendErr.message);
        }
    }

    // 3. INTENTO VÍA SENDGRID HTTP API (Puerto 443 HTTPS)
    if (process.env.SENDGRID_API_KEY) {
        try {
            console.log('[EMAIL SERVICE] 🚀 Enviando vía SendGrid HTTP API (Puerto 443 HTTPS)...');
            const sendgridSender = process.env.SENDGRID_FROM || process.env.GMAIL_USER || 'aangelo2555@gmail.com';
            const sgRes = await axios.post('https://api.sendgrid.com/v3/mail/send', {
                personalizations: [{ to: [{ email: toEmail }] }],
                from: { email: sendgridSender, name: 'SOFTCONTABLE' },
                subject,
                content: [{ type: 'text/html', value: htmlContent }]
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.SENDGRID_API_KEY.trim()}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log(`[EMAIL SERVICE SENDGRID SUCCESS] ✅ Correo entregado vía SendGrid HTTPS.`);
            return { success: true, simulated: false, provider: 'sendgrid' };
        } catch (sgErr) {
            console.error(`[EMAIL SERVICE SENDGRID ERROR] ⚠️ SendGrid falló:`, sgErr.response?.data || sgErr.message);
        }
    }

    // 4. INTENTO VÍA GMAIL / SMTP (Nodemailer)
    let transporter = createTransporter(true);
    if (transporter) {
        const senderEmail = process.env.GMAIL_USER || process.env.SMTP_USER;
        const mailOptions = {
            from: `"SOFTCONTABLE" <${senderEmail}>`,
            to: toEmail,
            subject,
            html: htmlContent
        };

        try {
            console.log('[EMAIL SERVICE] 🚀 Intentando enviar vía SMTP (Puerto 587)...');
            const sendPromise = transporter.sendMail(mailOptions);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('TIMEOUT_SMTP_587')), 6000)
            );

            const info = await Promise.race([sendPromise, timeoutPromise]);
            console.log(`[EMAIL SERVICE SUCCESS] ✅ Correo enviado exitosamente a ${toEmail} (Puerto 587). ID: ${info.messageId}`);
            return { success: true, simulated: false, provider: 'smtp_587', messageId: info.messageId };
        } catch (err587) {
            console.warn(`[EMAIL SERVICE WARN] Puerto 587 falló (${err587.message}). Probando Puerto 465 SSL...`);
            try {
                transporter = createTransporter(false);
                const sendPromise465 = transporter.sendMail(mailOptions);
                const timeoutPromise465 = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('TIMEOUT_SMTP_465')), 6000)
                );

                const info465 = await Promise.race([sendPromise465, timeoutPromise465]);
                console.log(`[EMAIL SERVICE SUCCESS] ✅ Correo enviado exitosamente a ${toEmail} (Puerto 465). ID: ${info465.messageId}`);
                return { success: true, simulated: false, provider: 'smtp_465', messageId: info465.messageId };
            } catch (err465) {
                console.error(`[EMAIL SERVICE ERROR] ❌ Los puertos SMTP tradicionales fallaron en este entorno (${err465.message}).`);
            }
        }
    }

    // 5. RESPALDO LOCAL / AUDITORÍA EN CONSOLA
    console.warn(`[EMAIL SERVICE NOTICE] ℹ️ No se pudo entregar por transporte externo (o no hay llaves API configuradas). El código OTP ha quedado registrado en consola.`);
    return {
        success: true,
        simulated: true,
        provider: 'console_audit',
        message: `Código registrado en registros de consola.`
    };
}

/**
 * Envía el correo de verificación de cuenta y bienvenida (Plantilla estilo Flow).
 */
async function sendAccountVerificationEmail({ toEmail, userName, verificationUrl, otpCode }) {
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
                .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.04); }
                .header { text-align: center; margin-bottom: 28px; }
                .logo-title { font-size: 24px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px; margin: 0; text-transform: uppercase; }
                .logo-blue { color: #2563eb; }
                .btn-verify { background: #2563eb; color: #ffffff !important; padding: 14px 34px; border-radius: 12px; font-size: 15px; font-weight: 800; text-decoration: none; display: inline-block; box-shadow: 0 4px 14px rgba(37,99,235,0.25); text-align: center; transition: background 0.2s; }
                .otp-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 14px; padding: 18px; text-align: center; margin: 24px 0; }
                .otp-val { font-size: 30px; font-weight: 900; letter-spacing: 6px; color: #1e40af; font-family: 'Courier New', Courier, monospace; margin: 6px 0; }
                .contact-card { background: #f1f5f9; border-radius: 14px; padding: 18px 20px; margin-top: 24px; font-size: 13px; color: #334155; line-height: 1.8; }
                .footer { text-align: center; margin-top: 32px; font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 class="logo-title">SOFT <span class="logo-blue">CONTABLE</span></h1>
                    <p style="font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Sistema Contable en la Nube v2.0</p>
                </div>

                <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">¡Hola ${userName || 'Estimado(a)'}!</p>
                <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
                    Gracias por registrarte con nosotros. Estás a un paso de comenzar a usar <strong>SoftContable</strong> y acceder a todas las herramientas que tenemos para ti, tu estudio contable y empresas.
                </p>

                <p style="font-size: 14px; color: #334155; margin-bottom: 24px;">
                    Haz click en el siguiente botón para completar tu registro:
                </p>

                <div style="text-align: center; margin: 28px 0;">
                    <a href="${verificationUrl}" class="btn-verify" target="_blank">
                        Completar mi registro
                    </a>
                </div>

                <div class="otp-box">
                    <p style="font-size: 12px; color: #64748b; margin: 0 0 4px 0; font-weight: 600;">O ingresa este código de verificación en pantalla:</p>
                    <div class="otp-val">${otpCode}</div>
                    <p style="font-size: 11px; color: #94a3b8; margin: 0;">Válido por 24 horas</p>
                </div>

                <p style="font-size: 13px; color: #475569; margin-top: 24px; line-height: 1.5;">
                    Si tienes alguna duda, también puedes contactarnos a través de los datos que te dejamos a continuación:
                </p>

                <div class="contact-card">
                    <div>📧 <strong>Correo:</strong> soporte@softcontable.pe</div>
                    <div>🇵🇪 <strong>Perú:</strong> +51 923 887 478 / Lima</div>
                    <div>💬 <strong>WhatsApp:</strong> Atención al Cliente &amp; Onboarding</div>
                </div>

                <div class="footer">
                    <p style="margin: 0;">&copy; 2026 Angelo Thomas Serna Simeon - SOFTCONTABLE SaaS. Todos los derechos reservados.</p>
                    <p style="margin: 4px 0 0 0; color: #94a3b8;">Seguridad Contable &amp; Tributaria SUNAT Perú</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendHtmlEmail({
        toEmail,
        subject: `✉️ Completa tu registro en SoftContable (${otpCode})`,
        htmlContent,
        debugLabel: 'ACCOUNT_VERIFICATION',
        otpCode,
        verificationUrl
    });
}

/**
 * Envia un correo electrónico con el código OTP de 6 dígitos para restablecer contraseña.
 */
async function sendResetOtpEmail({ toEmail, otpCode, userName }) {
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
                    <p style="margin: 0;">&copy; 2026 Angelo Thomas Serna Simeon - SOFTCONTABLE SaaS. Todos los derechos reservados.</p>
                    <p style="margin: 4px 0 0 0; color: #94a3b8;">Seguridad Contable &amp; Tributaria SUNAT Perú</p>
                </div>
            </div>
        </body>
        </html>
    `;

    return sendHtmlEmail({
        toEmail,
        subject: `🔑 ${otpCode} es tu código de verificación SOFTCONTABLE`,
        htmlContent,
        debugLabel: 'RESET_PASSWORD_OTP',
        otpCode
    });
}

module.exports = {
    sendHtmlEmail,
    sendAccountVerificationEmail,
    sendResetOtpEmail
};
