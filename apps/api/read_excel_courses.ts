import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile('C:\\Users\\flavi\\Il mio Drive (flaviopieretti61@gmail.com)\\Documenti\\UniversitàDeiSaperi\\UniAgorà\\assets\\Corsi.xlsx');
const worksheet = workbook.getWorksheet(1);

// Leggi header
const headers: (string | number | undefined)[] = [];
worksheet.getRow(1).eachCell((cell) => {
  headers.push(cell.value);
});

console.log('HEADERS:', JSON.stringify(headers));
console.log('TOTAL_ROWS:', worksheet.rowCount);

// Leggi primi 2 dati
const data: any[] = [];
for (let i = 2; i <= Math.min(3, worksheet.rowCount); i++) {
  const row: any[] = [];
  worksheet.getRow(i).eachCell((cell) => {
    row.push(cell.value);
  });
  data.push(row);
}

console.log('SAMPLE_DATA:', JSON.stringify(data, null, 2));