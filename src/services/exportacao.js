const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Gera um arquivo .xlsx (Buffer) a partir de colunas e linhas genéricas.
 * @param {{titulo:string, subtitulo?:string, colunas:{chave:string,rotulo:string,largura?:number}[], linhas:object[]}} spec
 */
async function gerarXlsx({ titulo, subtitulo, colunas, linhas }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PontoCerto';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(titulo.slice(0, 31) || 'Relatório');

  sheet.mergeCells(1, 1, 1, colunas.length);
  const tituloCell = sheet.getCell(1, 1);
  tituloCell.value = titulo;
  tituloCell.font = { bold: true, size: 14 };

  if (subtitulo) {
    sheet.mergeCells(2, 1, 2, colunas.length);
    const subCell = sheet.getCell(2, 1);
    subCell.value = subtitulo;
    subCell.font = { italic: true, color: { argb: 'FF6B7480' } };
  }

  const linhaCabecalho = subtitulo ? 4 : 3;
  colunas.forEach((col, i) => {
    const cell = sheet.getCell(linhaCabecalho, i + 1);
    cell.value = col.rotulo;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A54' } };
    cell.alignment = { vertical: 'middle' };
    sheet.getColumn(i + 1).width = col.largura || 18;
  });

  linhas.forEach((linha, idx) => {
    const rowIdx = linhaCabecalho + 1 + idx;
    colunas.forEach((col, i) => {
      const cell = sheet.getCell(rowIdx, i + 1);
      cell.value = linha[col.chave] ?? '';
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F5F7' } };
    });
  });

  sheet.getRow(linhaCabecalho).height = 20;

  return workbook.xlsx.writeBuffer();
}

/**
 * Gera um arquivo .pdf (Buffer) a partir de colunas e linhas genéricas,
 * em formato de tabela paginada.
 */
function gerarPdf({ titulo, subtitulo, colunas, linhas }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const larguraUtil = doc.page.width - 80;
    const larguraColuna = larguraUtil / colunas.length;
    const alturaLinha = 20;

    function desenharCabecalho() {
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1F3A54').text(titulo, 40, 40);
      if (subtitulo) {
        doc.font('Helvetica').fontSize(10).fillColor('#6B7480').text(subtitulo, 40, 62);
      }
      const y = subtitulo ? 84 : 68;
      doc.rect(40, y, larguraUtil, alturaLinha).fill('#1F3A54');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      colunas.forEach((col, i) => {
        doc.text(col.rotulo, 40 + i * larguraColuna + 4, y + 6, { width: larguraColuna - 8 });
      });
      return y + alturaLinha;
    }

    let y = desenharCabecalho();
    doc.font('Helvetica').fontSize(9).fillColor('#1F2937');

    if (linhas.length === 0) {
      doc.text('Nenhum registro encontrado para os filtros aplicados.', 40, y + 12);
    }

    linhas.forEach((linha, idx) => {
      if (y + alturaLinha > doc.page.height - 40) {
        doc.addPage();
        y = desenharCabecalho();
        doc.font('Helvetica').fontSize(9).fillColor('#1F2937');
      }
      if (idx % 2 === 1) {
        doc.rect(40, y, larguraUtil, alturaLinha).fill('#F4F5F7');
        doc.fillColor('#1F2937');
      }
      colunas.forEach((col, i) => {
        const valor = linha[col.chave] ?? '';
        doc.text(String(valor), 40 + i * larguraColuna + 4, y + 6, { width: larguraColuna - 8 });
      });
      y += alturaLinha;
    });

    doc.end();
  });
}

module.exports = { gerarXlsx, gerarPdf };
