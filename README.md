# UdsAgora 

> **Gestione integrata di iscrizioni, soci e corsi per organizzazioni culturali e associative**

---

## 🎯 Cos'è

UdsAgora è una **piattaforma web moderna** progettata per semplificare la gestione amministrativa di università, associazioni e organizzazioni che gestiscono iscrizioni di soci e corsi formativi.

### ✨ Funzionalità Principali

**Gestione Soci**
- Anagrafica completa con dati personali, contatti e documenti
- Categorizzazione (Ordinario, Coniuge, Giovani, Convenzione, ecc.)
- Storico iscrizioni e rinnovi

**Gestione Iscrizioni**
- Iscrizioni annuali (NUOVA, RINNOVO) con workflow di approvazione
- Monitoraggio pagamenti (contanti, bonifico, POS, ecc.)
- Gestione quote per categoria e anno accademico

**Gestione Corsi**
- Creazione e monitoraggio corsi formativi
- Iscrizioni corsisti con gestione posti
- Fogli di presenza e firme digitalizzate

**Report Avanzati**
- Riepilogo incassi per categoria, corso e metodo di pagamento
- Dettaglio iscrizioni con export PDF/Excel
- Chiusura di Cassa con conteggio contanti
- Registrazione piccole spese e rettifiche
- Audit log completo di tutte le operazioni

**Sicurezza e Compliance**
- Autenticazione con ruoli (ADMIN, SEGRETERIA, CONSIGLIO)
- Form privacy integrata con firma digitale
- GDPR compliant (Supabase Central EU)

---

## 🚀 Tech Stack

**Frontend:** React 18 + TypeScript + Vite + TailwindCSS + React Router  
**Backend:** Node.js 20+ + Express.js + TypeScript + Prisma ORM  
**Database:** PostgreSQL (Supabase, Ireland region)  
**DevOps:** GitHub + Render (auto-deploy) + Supabase

---

## 📦 Deployment

**Live in produzione:** https://udsagora.onrender.com

L'app è deployata con **auto-deploy automatico da GitHub**:

```bash
git push  # → Render builda e deploya in ~1 minuto
```

**Infrastruttura:**
- Render (PaaS gratuito)
- Supabase PostgreSQL (500 MB free tier, Central EU (Frankfurt))
- **Costo:** €0 (scalabile a ~€32/mese con SLA garantito)

---


## 📄 Info

**Proprietà:    Pejo61** 

**Developed by: Pejo61**

Versione 1.0.0 — Maggio 2026



## 📄 maint

**KeepAlive:** 
- Per tenere in vita il  servizio SUPABASE:

su Github è stato creato una Action che fa una richiesta a un API di supabase, schedulata  ogni lunedì e giovedì alle 12:00 UTC 

sono state create due variabili Secret sul Setting del repository udsagora

è stato creato il processo .github/workflows/supabase_keep_alive.yml

- Per tenere in vita il  servizio RENDER:
é stato creato un servizio monitoraggio HTTPS per https://udsagora.onrender.com/login

Resquest su:    https://dashboard.uptimerobot.com/monitors

schedulato:     ogni 10 minuti
