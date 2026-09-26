import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.config import settings

logger = logging.getLogger("stocksense.email")

def send_otp_email(to_email: str, otp_code: str, username: Optional[str] = None) -> bool:
    """
    Sends a 6-digit OTP password reset email via real Gmail SMTP.
    Security: OTP codes and SMTP passwords are never logged.
    """
    smtp_host = settings.SMTP_HOST
    smtp_port = settings.SMTP_PORT
    smtp_user = settings.SMTP_USERNAME
    smtp_password = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM

    if not smtp_user or not smtp_password:
        logger.error("SMTP credentials are not configured in backend/.env")
        raise RuntimeError("SMTP configuration missing. Please check server environment.")

    display_name = username or "Valued User"

    subject = f"StockSense Security — Password Reset Verification Code"

    # Plain text alternative
    text_content = f"""Hello {display_name},

You requested a password reset for your StockSense account.

Your 6-digit verification code is: {otp_code}

This code will expire in 10 minutes.
For security reasons, you have a maximum of 5 verification attempts.

If you did not request this password reset, please ignore this email or notify your system administrator immediately.

Best regards,
StockSense Operations Security Team
"""

    # Rich responsive HTML template matching StockSense editorial SaaS design
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StockSense Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F7F3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #202020;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F7F7F3; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="540" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #FFFFFF; border: 1px solid #E7E7E2; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          
          <!-- Header Bar with StockSense Logo -->
          <tr>
            <td style="padding: 32px 36px 24px; border-bottom: 1px solid #F0F0EB; background-color: #FFFFFF;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="width: 34px; height: 34px; background-color: #F4D21F; border-radius: 8px; text-align: center; vertical-align: middle;">
                    <div style="width: 14px; height: 14px; background-color: #202020; border-radius: 2.5px; transform: rotate(45deg); margin: 0 auto;"></div>
                  </td>
                  <td style="padding-left: 12px; font-size: 20px; font-weight: 700; color: #202020; letter-spacing: -0.03em;">
                    StockSense
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 36px 28px;">
              <h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #202020; letter-spacing: -0.02em;">
                Password Reset Request
              </h1>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #555555;">
                Hello <strong>{display_name}</strong>,<br>
                We received a request to reset your password for your StockSense account. Use the 6-digit verification code below to complete the reset process:
              </p>

              <!-- 6-Digit OTP Box -->
              <div style="margin: 28px 0; padding: 24px; background-color: #F7F7F3; border: 1px dashed #D4D4CB; border-radius: 12px; text-align: center;">
                <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: #888888; margin-bottom: 8px;">
                  Your Verification Code
                </div>
                <div style="font-family: 'SF Mono', 'Roboto Mono', Menlo, monospace; font-size: 36px; font-weight: 700; letter-spacing: 0.25em; color: #202020;">
                  {otp_code}
                </div>
                <div style="font-size: 12px; color: #E5A400; font-weight: 600; margin-top: 10px;">
                  ⏱ Valid for 10 minutes (Max 5 attempts)
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #FAF9F5; border-left: 3px solid #202020; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #666666;">
                  <strong>Security Note:</strong> StockSense support will never ask you for this code. If you did not initiate this request, you can safely disregard this email.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #777777;">
                Need help? Contact your inventory administrator.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px; background-color: #F7F7F3; border-top: 1px solid #E7E7E2; font-size: 11px; color: #888888; text-align: center;">
              © StockSense Core Inventory Management System. All rights reserved.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"StockSense Operations <{from_email}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain"))
    msg.attach(MIMEText(html_content, "html"))

    try:
        server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(smtp_user, smtp_password)
        server.sendmail(from_email, [to_email], msg.as_string())
        server.quit()
        logger.info(f"OTP verification email successfully dispatched via Gmail SMTP to recipient.")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via SMTP ({smtp_host}:{smtp_port}): {str(e)}")
        raise e
