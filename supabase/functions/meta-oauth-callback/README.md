# Meta OAuth Callback Function

This Supabase Edge Function handles the Meta OAuth callback and exchanges the authorization code for an access token.

## Setup

1. Set environment variables in Supabase Dashboard:
   - `META_APP_ID`: Your Meta App ID
   - `META_APP_SECRET`: Your Meta App Secret
   - `META_REDIRECT_URI`: Your redirect URI (Supabase callback URL)
   - `APP_URL`: Your app URL (e.g., http://localhost:5454)

2. Deploy the function:
   ```bash
   supabase functions deploy meta-oauth-callback
   ```

3. The function will be available at:
   `https://[your-project].supabase.co/functions/v1/meta-oauth-callback`

