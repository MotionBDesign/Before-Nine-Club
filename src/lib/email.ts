// Email notification helper
// Replace with your preferred email service: Resend, SendGrid, Postmark, etc.

type EmailOptions = {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  // Using Resend (recommended - simple API, good free tier)
  // npm install resend
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({ from: 'Before Nine Club <hello@beforenineclub.com>', to, subject, html })

  // For now, log emails in development
  console.log('📧 Email:', { to, subject })
  console.log('Content:', html)

  return { success: true }
}

export async function sendLoginEmail(email: string, loginUrl: string) {
  return sendEmail({
    to: email,
    subject: 'Your Before Nine Club login link',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #92400e;">Before Nine Club</h1>
        <p>Click the button below to sign in to your account:</p>
        <a href="${loginUrl}" style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Sign In</a>
        <p style="color: #666; font-size: 14px;">This link expires in 15 minutes.</p>
        <p style="color: #666; font-size: 14px;">If you didn't request this email, you can safely ignore it.</p>
      </div>
    `,
  })
}

export async function sendWelcomeEmail(email: string, name: string) {
  return sendEmail({
    to: email,
    subject: 'Welcome to Before Nine Club!',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #92400e;">Welcome, ${name}! 🎉</h1>
        <p>You're now a member of Before Nine Club. Here's what to do next:</p>
        <ul>
          <li>Check your dashboard for upcoming events</li>
          <li>RSVP to the next breakfast</li>
          <li>Join our WhatsApp group for updates</li>
        </ul>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Go to Dashboard</a>
        <p style="color: #666; font-size: 14px;">See you at the next event!</p>
      </div>
    `,
  })
}

export async function sendEventReminderEmail(email: string, name: string, eventTitle: string, eventDate: string, location: string, rsvpUrl: string) {
  return sendEmail({
    to: email,
    subject: `Reminder: ${eventTitle} - RSVP needed`,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #92400e;">Hey ${name}!</h1>
        <p>Just a reminder about our upcoming event:</p>
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h2 style="margin: 0 0 8px 0;">${eventTitle}</h2>
          <p style="margin: 0; color: #666;">${eventDate}</p>
          <p style="margin: 0; color: #666;">${location}</p>
        </div>
        <p>Let us know if you're coming:</p>
        <a href="${rsvpUrl}" style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">RSVP Now</a>
      </div>
    `,
  })
}

export async function sendPaymentFailedEmail(email: string, name: string) {
  return sendEmail({
    to: email,
    subject: 'Action needed: Payment failed',
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h1 style="color: #92400e;">Payment Issue</h1>
        <p>Hey ${name},</p>
        <p>We had trouble processing your latest payment for Before Nine Club.</p>
        <p>Please update your payment method to keep your membership active:</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">Update Payment</a>
        <p style="color: #666; font-size: 14px;">If you have any questions, just reply to this email.</p>
      </div>
    `,
  })
}
