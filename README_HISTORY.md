# User Activity History System

## Overview
Sistem za čuvanje istorije svih korisničkih akcija sa automatskim cleanup-om starih zapisa.

## Database Schema

### Tabela: `user_activity_history`

Čuva sve akcije korisnika:
- `generate_image` - Generisanje slike modela sa garderobom
- `edit_image` - Editovanje slike
- `generate_video` - Generisanje video klipa
- `create_captions` - Kreiranje captions za društvene mreže
- `create_model` - Kreiranje novog modela
- `dress_model` - Dressing modela (već postoji u `dressed_models`)

## Retention Policy

**Default: 15 dana**

- Svi zapisi stariji od 15 dana se automatski brišu
- Može se konfigurisati kroz `cleanup_old_activity_history(retention_days)` funkciju
- Preporučeno: Pokrenuti cleanup dnevno (npr. u 2 AM)

## Setup Instructions

1. **Kreirajte tabelu u Supabase:**
   ```sql
   -- Pokrenite migraciju iz migrations/create_user_activity_history.sql
   ```

2. **Automatski cleanup (opciono):**
   - Ako imate `pg_cron` extension, otkomentarišite cron job u SQL fajlu
   - Ili pokrenite cleanup ručno:
   ```sql
   SELECT cleanup_old_activity_history(15);
   ```

3. **Korišćenje u kodu:**
   ```typescript
   import { userHistory } from '../lib/supabase'
   
   // Čuvanje akcije
   await userHistory.saveActivity({
     userId: user.id,
     activityType: 'generate_image',
     imageUrl: 'https://...',
     metadata: { ... }
   })
   
   // Dohvatanje istorije
   const { data } = await userHistory.getUserHistory(user.id, 15)
   ```

## Benefits

1. **Analytics** - Možete pratiti šta korisnici rade
2. **Debugging** - Lakše pronalaženje problema
3. **User Experience** - Mogućnost prikazivanja istorije korisniku
4. **Performance** - Automatski cleanup sprečava rast baze

## Storage Considerations

- Slike i video se čuvaju u Supabase Storage (ne u bazi)
- U bazi se čuvaju samo URL-ovi i metadata
- JSONB polja za fleksibilno čuvanje dodatnih podataka

## Future Enhancements

- Dashboard za prikaz istorije korisniku
- Export istorije
- Analytics dashboard za admin
- Notifikacije za važne akcije



