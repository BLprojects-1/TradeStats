# Supabase Email Authentication Setup Guide

## 1. Configure URL Settings
- Go to Authentication > URL Configuration
- Site URL: http://localhost:3000 (for development)
- Redirect URLs: http://localhost:3000/auth/callback
## 2. Enable Email Confirmation
- Go to Authentication > Providers > Email
- Turn ON 'Enable Email Confirmations'
- Set up SMTP settings if needed
- Save Changes

## 3. Testing the Flow
- Sign up with a valid email
- Check your inbox for the confirmation email
- Click the link to complete registration
- Use the 'Resend Confirmation Email' button if needed

