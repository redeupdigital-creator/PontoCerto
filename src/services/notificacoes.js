const nodemailer = require('nodemailer');
const { Notificacao } = require('../models');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // sem SMTP configurado -> só notificação in-app
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

/**
 * Cria uma notificação (sempre, como registro/auditoria) e tenta enviar por
 * e-mail se houver SMTP configurado e um destinatário. Nunca lança erro para
 * quem chamou — falha de e-mail não pode derrubar a operação principal
 * (ex.: aprovar um abono não pode falhar por causa do envio de e-mail).
 */
async function notificar({ colaboradorId = null, tipo, titulo, mensagem, emailDestino = null }) {
  const notificacao = await Notificacao.create({
    colaboradorId,
    tipo,
    titulo,
    mensagem,
    canal: emailDestino ? 'email' : 'sistema',
  });

  const t = getTransporter();
  if (t && emailDestino) {
    try {
      await t.sendMail({
        from: process.env.SMTP_FROM || 'nao-responda@pontocerto.local',
        to: emailDestino,
        subject: titulo,
        text: mensagem,
      });
      await notificacao.update({ emailEnviado: true });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[notificacoes] falha ao enviar e-mail:', err.message);
    }
  } else if (!t) {
    // eslint-disable-next-line no-console
    console.log(`[notificacoes] (SMTP não configurado, notificação registrada apenas no sistema) ${titulo}`);
  }

  return notificacao;
}

module.exports = { notificar };
