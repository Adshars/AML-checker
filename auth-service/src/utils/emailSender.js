import nodemailer from 'nodemailer';
import logger from './logger.js';

// Configuration of the email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
    port: process.env.EMAIL_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false,
    }
  });
};

export const sendResetEmail = async (email, resetLink) => {
  try {
    const transporter = createTransporter();

    try {
      await transporter.verify();
      logger.info('SMTP Connection established successfully');
    } catch (verifyError) {
      logger.error('SMTP Connection Failed', { 
        code: verifyError.code, 
        message: verifyError.message,
        response: verifyError.response 
      });
      throw new Error('Could not connect to SMTP server');
    }

    const mailOptions = {
      from: '"AML Checker Security" <security@amlchecker.local>', // Sender
      to: email, // Recipient
      subject: 'Reset Hasła - AML Checker',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Resetowanie hasła</h2>
          <p>Otrzymaliśmy prośbę o zresetowanie hasła dla Twojego konta.</p>
          <p>Kliknij w poniższy przycisk, aby ustawić nowe hasło (link ważny 1h):</p>
          <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Zresetuj hasło</a>
          <p>Lub skopiuj ten link: ${resetLink}</p>
          <hr>
          <p><small>Jeśli to nie Ty, zignoruj tę wiadomość.</small></p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent successfully: ${info.messageId}`);
    
    // Link to view the email in Ethereal (for testing purposes)
    logger.warn(`Preview URL (CLICK ME): ${nodemailer.getTestMessageUrl(info)}`);

  } catch (error) {
    logger.error('Error sending email', { 
      message: error.message, 
      stack: error.stack,
      code: error.code 
    });
    throw new Error('Email sending failed');
  }
};