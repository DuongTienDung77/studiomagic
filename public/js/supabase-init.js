// Điền thông tin từ project Supabase của anh tại đây:
window.SUPABASE_URL = 'https://muvpelkmfhamgbwnewkh.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dnBlbGttZmhhbWdid25ld2toIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyOTc5NDIsImV4cCI6MjA3Mjg3Mzk0Mn0.ubB9KtqXwwmXLOQOQItyOBv_v4u0lO3nlyuNiuCr0X0';
window.REDIRECT_URL = 'https://dungai.online/auth/callback';

window.supabaseClient = window.supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);
