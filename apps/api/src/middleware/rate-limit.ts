import rateLimit from 'express-rate-limit';

/**
 * Rate limiter dedicato all'endpoint di login.
 *
 * Protegge da brute-force / credential-stuffing limitando i tentativi
 * per indirizzo IP. Solo i tentativi FALLITI contano verso il limite
 * (`skipSuccessfulRequests: true`), così un utente legittimo che inserisce
 * la password corretta non viene mai bloccato.
 *
 * Disabilitato in ambiente di test per non interferire con eventuali suite.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // finestra di 15 minuti
  limit: 10, // max 10 tentativi falliti per IP nella finestra
  skipSuccessfulRequests: true, // i login riusciti non consumano il budget
  standardHeaders: 'draft-7', // header RateLimit-* standard
  legacyHeaders: false, // disabilita gli header X-RateLimit-* deprecati
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    error:
      'Troppi tentativi di accesso falliti. Riprova tra qualche minuto.',
  },
});
