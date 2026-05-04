export function emailVerifyTemplate(name: string, verifyLink: string) {
  return `
  <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,sans-serif;">

    <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:#4f46e5;padding:20px;text-align:center;color:#fff;">
        <h2 style="margin:0;">Verify Your Email</h2>
      </div>

      <!-- Body -->
      <div style="padding:30px;text-align:center;color:#333;">

        <h3 style="margin-bottom:10px;">Hello ${name},</h3>

        <p style="font-size:15px;color:#666;">
          Welcome! Please verify your email address to activate your account.
        </p>

        <!-- Button -->
        <div style="margin:30px 0;">
          <a href="${verifyLink}" 
             style="
              background:#4f46e5;
              color:#ffffff;
              padding:14px 28px;
              text-decoration:none;
              border-radius:8px;
              font-size:16px;
              display:inline-block;
              font-weight:bold;
              box-shadow:0 3px 10px rgba(79,70,229,0.3);
             ">
            Verify Email
          </a>
        </div>

        <p style="font-size:13px;color:#888;">
          This link will expire in <b>15 minutes</b>.
        </p>

        <p style="font-size:12px;color:#aaa;margin-top:20px;">
          If you did not create this account, you can ignore this email.
        </p>

      </div>

      <!-- Footer -->
      <div style="background:#f1f1f1;padding:15px;text-align:center;font-size:12px;color:#777;">
        © ${new Date().getFullYear()} Your Platform Name. All rights reserved.
      </div>

    </div>
  </div>
  `;
}