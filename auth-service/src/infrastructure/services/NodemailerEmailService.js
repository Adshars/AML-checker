import nodemailer from 'nodemailer';
import logger from '../../shared/logger/index.js';

/**
 * Email service using Nodemailer
 * Handles all email sending operations
 */
export class NodemailerEmailService {
  constructor(config) {
    this.config = config;
    this.transporter = null;
  }

  /**
   * Create and return transporter
   * @returns {Object} - Nodemailer transporter
   */
  getTransporter() {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          user: this.config.user,
          pass: this.config.pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }
    return this.transporter;
  }

  /**
   * Verify SMTP connection
   * @returns {Promise<boolean>}
   */
  async verifyConnection() {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      logger.info('SMTP Connection established successfully');
      return true;
    } catch (error) {
      logger.error('SMTP Connection Failed', {
        code: error.code,
        message: error.message,
        response: error.response
      });
      throw new Error('Could not connect to SMTP server');
    }
  }

  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetLink - Password reset link
   */
  async sendResetEmail(email, resetLink) {
    try {
      await this.verifyConnection();

      const mailOptions = {
        from: '"AML Checker Security" <security@amlchecker.local>',
        to: email,
        subject: 'Password Reset - AML Checker',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Password Reset</h2>
            <p>We received a request to reset the password for your account.</p>
            <p>Click the button below to set a new password (link valid for 1 hour):</p>
            <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
            <p>Lub skopiuj ten link: ${resetLink}</p>
            <hr>
            <p><small>If this wasn't you, please ignore this message.</small></p>
          </div>
        `
      };

      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);

      logger.info(`Email sent successfully: ${info.messageId}`);
      logger.warn(`Preview URL (CLICK ME): ${nodemailer.getTestMessageUrl(info)}`);

    } catch (error) {
      logger.error('Error sending email', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      throw new Error('Email sending failed');
    }
  }

  /**
   * Send welcome email to new user
   * @param {string} email - Recipient email
   * @param {string} firstName - User's first name
   * @param {string} role - User's role
   * @param {string} frontendUrl - Frontend URL for login link
   */
  async sendWelcomeEmail(email, firstName, role, frontendUrl) {
    try {
      await this.verifyConnection();

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
        `
      };

      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);

      logger.info(`Welcome email sent successfully: ${info.messageId}`, {
        recipient: email,
        role
      });
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
  }
}

export default NodemailerEmailService;
