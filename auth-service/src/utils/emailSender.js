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

/**
 * Send welcome email to newly registered user
 * @param {string} email - User's email address
 * @param {string} firstName - User's first name
 * @param {string} role - User's role (admin, user, superadmin)
 */
export const sendWelcomeEmail = async (email, firstName, role) => {
  try {
    const transporter = createTransporter();

    // Verify SMTP connection
    try {
      await transporter.verify();
      logger.info('SMTP Connection established successfully (welcome email)');
    } catch (verifyError) {
      logger.error('SMTP Connection Failed (welcome email)', { 
        code: verifyError.code, 
        message: verifyError.message,
        response: verifyError.response 
      });
      throw new Error('Could not connect to SMTP server');
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
    const loginUrl = `${frontendUrl}/login`;

    const mailOptions = {
      from: '"AML Checker Platform" <noreply@amlchecker.local>',
      to: email,
      subject: 'Welcome to AML Checker',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
          <h2 style="color: #007bff;">Welcome, ${firstName}!</h2>
          <p>Your account has been successfully created on the AML Checker platform.</p>
          <p>Your role: <strong style="color: #28a745;">${role.toUpperCase()}</strong></p>
          <p>Please log in using the credentials provided by your administrator.</p>
          <div style="margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to Dashboard
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">Login URL: <a href="${loginUrl}">${loginUrl}</a></p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">
            This is an automated message. If you did not expect this email, please contact your administrator.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Welcome email sent successfully: ${info.messageId}`, { 
      recipient: email, 
      role 
    });
    
    // Link to view the email in Ethereal (for testing purposes)
    logger.warn(`Preview Welcome Email (CLICK ME): ${nodemailer.getTestMessageUrl(info)}`);

  } catch (error) {
    logger.error('Error sending welcome email', { 
      message: error.message, 
      stack: error.stack,
      code: error.code,
      recipient: email
    });
    throw new Error('Welcome email sending failed');
  }
};