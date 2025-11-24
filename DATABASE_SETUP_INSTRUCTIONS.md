# 📊 Kako da podesiš bazu podataka

## Korak 1: Otvori Supabase Dashboard

1. Idi na https://supabase.com/dashboard
2. Otvori svoj projekat
3. Idi na **SQL Editor** (leva strana menija)

## Korak 2: Pokreni SQL skriptu

1. Klikni na **"New Query"** dugme
2. Otvori fajl: `/Users/nemanjalakic/Documents/fashionnikolainemanja/SUPABASE_SETUP.sql`
3. **Kopiraj SVE** iz tog fajla
4. **Zalepi** u SQL Editor u Supabase-u
5. Klikni **"Run"** (ili pritisni Cmd/Ctrl + Enter)

## Korak 3: Proveri da li je uspelo

Trebalo bi da vidiš:
- ✅ 4 reda sa rezultatima (brojevi tabela)
- ✅ 4 reda sa planovima (free, monthly, sixMonth, annual)

Ako vidiš bilo kakve greške, kopiraj mi ih!

## Šta ova skripta radi:

### Kreira 4 nove tabele:
1. **subscription_plans** - Lista svih planova (free, monthly, 6-month, annual)
2. **subscriptions** - Pretplate korisnika
3. **user_tokens** - Token balance svakog korisnika
4. **token_usage_log** - Log svih potrošenih tokena (za analitiku)

### Podešava sigurnost:
- RLS policies - korisnici mogu da vide samo svoje podatke
- Automatsko kreiranje tokena za nove korisnike
- Zaštita od negativnih tokena

### Kreira default planove:
- **Free Plan**: 0 tokena - $0
- **Monthly Plan**: 100,000 tokena - $9.99/mesec
- **6-Month Plan**: 100,000 tokena/mesec - $49.99/6 meseci (ušteda $10)
- **Annual Plan**: 100,000 tokena/mesec - $89.99/godinu (ušteda $30) ⭐

### Funkcije:
- Automatsko inicijalizovanje tokena za nove korisnike
- Dodavanje tokena (za kupovinu)
- Reset tokena na početku perioda

## ⚠️ VAŽNO:

- **Pokreni ovu skriptu SAMO JEDNOM**
- Skripta je **safe** - neće obrisati postojeće podatke
- Ako tabele već postoje, neće ih ponovo kreirati
- Planovi će biti update-ovani ako već postoje

## Nakon što pokreneš skriptu:

1. Refreshuj aplikaciju u browseru
2. Loguj se (ili kreiraj novi nalog)
3. Novi korisnici automatski dobijaju Free plan (0 tokena)
4. Idi na "Upgrade Plan" → izaberi plan → klikni "Subscribe"
5. Instant aktivacija u demo mode-u! 🎉

## Provera da li sve radi:

```sql
-- Proveri koliko planova imaš
SELECT * FROM subscription_plans;

-- Proveri svoju pretplatu (zameni sa svojim user ID)
SELECT * FROM subscriptions WHERE user_id = 'YOUR_USER_ID';

-- Proveri svoje tokene
SELECT * FROM user_tokens WHERE user_id = 'YOUR_USER_ID';
```

## Ako nešto ne radi:

1. Proveri da li si pokrenuo skriptu
2. Proveri da li imaš greške u konzoli
3. Pošalji mi screenshot greške
4. Mogu da ti pomognem da popravimo!

