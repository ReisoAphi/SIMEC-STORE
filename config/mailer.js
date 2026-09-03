// config/mailer.js
const nodemailer = require('nodemailer');
const { SMTP } = require('./env');

const transporter = nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    secure: SMTP.secure,
    auth: SMTP.user && SMTP.pass ? { user: SMTP.user, pass: SMTP.pass } : undefined,
});

module.exports = { transporter, MAIL_FROM: SMTP.from, SALES_INBOX: SMTP.salesInbox };
