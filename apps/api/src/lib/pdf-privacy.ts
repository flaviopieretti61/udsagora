// Generazione della "Domanda di ammissione socio" come PDF, sovrapponendo
// i dati anagrafici del socio sopra il template assets/Template_Privacy.pdf.
//
// Coordinate in punti tipografici (1pt = 1/72 inch). Sistema di riferimento PDF:
// origine in basso a sinistra, y cresce verso l'alto.
// Pagina A4 = 595.3 × 841.9 pt.
//
// Le coordinate sono raccolte qui in un solo oggetto per facilitarne la regolazione.
// Se dopo la stampa di prova qualche campo è disallineato basta ritoccare i numeri qui.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_NUOVO_PATH = path.resolve(__dirname, '../../../../assets/Template_Privacy_Nuovo.pdf');
const TEMPLATE_RINNOVO_PATH = path.resolve(__dirname, '../../../../assets/Template_Privacy_Rinnovo.pdf');

// --- Coordinate dei campi sulla pagina 1 -----------------------------------
const C = {
  fontSize: 10,
  page1: {
    // Riquadri in alto a destra
    blocco: { x: 470, y: 793 },
    ricevuta: { x: 470, y: 776 },
    nuovoIscritto: { x: 470, y: 759 },

    // Tabella anagrafica (label a sinistra, valore inizia dopo l'etichetta)
    cognome: { x: 175, y: 655 },
    nome: { x: 405, y: 655 },
    codiceFiscale: { x: 175, y: 625 },
    luogoNascita: { x: 175, y: 596 },
    dataNascita: { x: 405, y: 596 },
    indirizzo: { x: 175, y: 565 },
    cittaProv: { x: 175, y: 536 },
    cap: { x: 405, y: 536 },
    email: { x: 175, y: 507 },
    telefonoCasa: { x: 405, y: 478 },
    cellulare: { x: 175, y: 478 },

    // Data e firma in fondo alla pagina 1
    data: { x: 50, y: 70 },
  },
  // Pagina 2: data finale in fondo
  page2: {
    data: { x: 50, y: 75 },
  },
} as const;

export interface PrivacyMember {
  cognome: string;
  nome: string;
  codiceFiscale?: string | null;
  dataNascita?: Date | null;
  luogoNascita?: string | null;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
  email?: string | null;
  telefono?: string | null;
  cellulare?: string | null;
}

export interface PrivacyOptions {
  data?: Date; // data da stampare in basso (default: oggi)
  blocco?: string;
  ricevuta?: string;
  nuovoIscritto?: boolean; // se true mette una X nel riquadro corrispondente
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function cittaProv(member: PrivacyMember): string {
  return [member.citta, member.provincia ? `(${member.provincia})` : null]
    .filter(Boolean)
    .join(' ');
}

export async function generatePrivacyForm(
  member: PrivacyMember,
  opts: PrivacyOptions = {},
): Promise<Uint8Array> {
  // Scegli il template in base al parametro nuovoIscritto
  const templatePath = opts.nuovoIscritto !== false ? TEMPLATE_NUOVO_PATH : TEMPLATE_RINNOVO_PATH;
  const templateBytes = await readFile(templatePath);
  const pdf = await PDFDocument.load(templateBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const pages = pdf.getPages();
  if (pages.length < 1) throw new Error('Template PDF privo di pagine');
  const page1 = pages[0]!;
  const page2 = pages[1];

  const draw = (text: string | undefined | null, pos: { x: number; y: number }) => {
    if (!text) return;
    page1.drawText(text, {
      x: pos.x,
      y: pos.y,
      size: C.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  };

  // Riquadri intestazione
  draw(opts.blocco, C.page1.blocco);
  draw(opts.ricevuta, C.page1.ricevuta);
  // Non disegnare la X (già nel template appropriato)

  // Anagrafica
  draw(member.cognome, C.page1.cognome);
  draw(member.nome, C.page1.nome);
  draw(member.codiceFiscale ?? '', C.page1.codiceFiscale);
  draw(member.luogoNascita ?? '', C.page1.luogoNascita);
  draw(member.dataNascita ? fmtDate(member.dataNascita) : '', C.page1.dataNascita);
  draw(member.indirizzo ?? '', C.page1.indirizzo);
  draw(cittaProv(member), C.page1.cittaProv);
  draw(member.cap ?? '', C.page1.cap);
  draw(member.email ?? '', C.page1.email);
  draw(member.telefono ?? '', C.page1.telefonoCasa);
  draw(member.cellulare ?? '', C.page1.cellulare);

  // Data in fondo pagina 1
  const oggi = opts.data ?? new Date();
  draw(fmtDate(oggi), C.page1.data);

  // Pagina 2: data
  if (page2) {
    page2.drawText(fmtDate(oggi), {
      x: C.page2.data.x,
      y: C.page2.data.y,
      size: C.fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return pdf.save();
}
