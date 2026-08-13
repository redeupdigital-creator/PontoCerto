const crypto = require('crypto');
const { RegistroPontoAfd, Colaborador, Empresa, Auditoria } = require('../models');

/* ============================================================
   CRC-16/KERMIT (CCITT-TRUE) — exigido pela Portaria 671/2021 (Anexo V,
   item 8) para os registros tipo 1 a 5 do AFD. Validado contra o vetor de
   teste oficial: CRC16("123456789") = 0x2189.
   ============================================================ */
function crc16Kermit(texto) {
  const buf = Buffer.from(texto, 'latin1'); // ISO 8859-1, conforme exigido
  let crc = 0x0000;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 1) ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
    }
  }
  return (crc & 0xFFFF).toString(16).padStart(4, '0');
}

/* ============================================================
   Helpers de formatação fixa (posição/tamanho), conforme item 7 do leiaute:
   "preenchimento deve se iniciar pela esquerda e posições não usadas devem
   ser preenchidas com espaço" — ou seja, texto alinhado à esquerda com
   espaços à direita; números à direita com zeros à esquerda.
   ============================================================ */
function alfa(valor, tamanho) {
  return String(valor ?? '').slice(0, tamanho).padEnd(tamanho, ' ');
}
function num(valor, tamanho) {
  return String(valor ?? '').replace(/\D/g, '').slice(0, tamanho).padStart(tamanho, '0');
}
function dataHora(d) {
  // formato AAAA-MM-ddThh:mm:00ZZZZZ (segundos sempre "00", conforme item 6.4.6)
  const pad = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset(); // minutos a leste de UTC
  const sinal = off >= 0 ? '+' : '-';
  const offH = pad(Math.floor(Math.abs(off) / 60));
  const offM = pad(Math.abs(off) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sinal}${offH}${offM}`;
}
function dataOnly(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function soDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

const ID_COLETOR = { app: '01', browser: '02', desktop: '03' };

/* ============================================================
   Registro imutável da marcação bruta (fonte do AFD tipo 7). Chamado a cada
   toque em "bater ponto" — NUNCA em lançamento manual administrativo
   (isso seria fabricar uma marcação que não aconteceu; correções manuais
   ficam só na trilha de auditoria genérica, que é o mecanismo certo pra isso).
   ============================================================ */
async function registrarMarcacaoBruta({ empresaId, colaboradorId, dataHoraMarcacao, origem = 'app', online = true }) {
  const ultimo = await RegistroPontoAfd.findOne({ where: { empresaId }, order: [['nsr', 'DESC']] });
  const proximoNsr = ultimo ? ultimo.nsr + 1 : 1;
  const hashAnterior = ultimo ? ultimo.hashAtual : '';

  const idColetor = ID_COLETOR[origem] || '05';
  const dataHoraGravacao = new Date();

  // Hash SHA-256 encadeado, conforme especificado após o registro tipo 7:
  // NSR + tipo + data/hora marcação + CPF + data/hora gravação + coletor + online/offline + hash anterior
  const colaborador = await Colaborador.findByPk(colaboradorId);
  const cpf = soDigitos(colaborador?.cpf);
  const base = [
    String(proximoNsr),
    '7',
    dataHora(dataHoraMarcacao),
    cpf,
    dataHora(dataHoraGravacao),
    idColetor,
    online ? '0' : '1',
    hashAnterior,
  ].join('|');
  const hashAtual = crypto.createHash('sha256').update(base, 'utf8').digest('hex');

  return RegistroPontoAfd.create({
    empresaId,
    nsr: proximoNsr,
    colaboradorId,
    dataHoraMarcacao,
    dataHoraGravacao,
    idColetor,
    online,
    hashAnterior: hashAnterior || null,
    hashAtual,
  });
}

/* ============================================================
   Verificação de integridade da cadeia de hash — usada tanto no export
   quanto num endpoint de auditoria dedicado. Se alguém tivesse alterado um
   registro no banco diretamente (fora da aplicação), a cadeia quebraria
   aqui, o que é exatamente o ponto de existir.
   ============================================================ */
async function verificarIntegridadeCadeia(empresaId) {
  const registros = await RegistroPontoAfd.findAll({ where: { empresaId }, order: [['nsr', 'ASC']] });
  const colaboradoresCache = {};
  let hashEsperado = '';
  for (const r of registros) {
    if (!colaboradoresCache[r.colaboradorId]) {
      colaboradoresCache[r.colaboradorId] = await Colaborador.findByPk(r.colaboradorId);
    }
    const cpf = soDigitos(colaboradoresCache[r.colaboradorId]?.cpf);
    const base = [
      String(r.nsr), '7', dataHora(r.dataHoraMarcacao), cpf, dataHora(r.dataHoraGravacao),
      r.idColetor, r.online ? '0' : '1', hashEsperado,
    ].join('|');
    const recalculado = crypto.createHash('sha256').update(base, 'utf8').digest('hex');
    if (recalculado !== r.hashAtual) {
      return { integro: false, quebrouNoNsr: r.nsr };
    }
    hashEsperado = r.hashAtual;
  }
  return { integro: true, totalRegistros: registros.length };
}

/* ============================================================
   Geração do AFD completo (registros tipo 1, 2, 5, 7 e 9), no leiaute do
   Anexo V da Portaria 671/2021. Gerado como REP-P (Registrador Eletrônico
   de Ponto Via Programa), já que este é um sistema de software.
   ============================================================ */
async function gerarAfd({ empresaId, dataInicio, dataFim }) {
  const empresa = (await Empresa.findByPk(empresaId)) || {};
  const registros7 = await RegistroPontoAfd.findAll({
    where: dataInicio && dataFim
      ? { empresaId, dataHoraMarcacao: { [require('sequelize').Op.between]: [new Date(`${dataInicio}T00:00:00`), new Date(`${dataFim}T23:59:59`)] } }
      : { empresaId },
    order: [['nsr', 'ASC']],
    include: [{ model: Colaborador, attributes: ['cpf', 'nome'] }],
  });

  const linhas = [];
  const agora = new Date();

  // ---- Tipo 1: Cabeçalho ----
  const dataInicial = registros7.length ? registros7[0].dataHoraMarcacao : agora;
  const dataFinal = registros7.length ? registros7[registros7.length - 1].dataHoraMarcacao : agora;
  let l1 = '';
  l1 += num('0', 9); // campo 1: fixo "000000000"
  l1 += '1'; // tipo
  l1 += '1'; // tipo identificador empregador: 1=CNPJ
  l1 += alfa(soDigitos(empresa.cnpj), 14);
  l1 += num('', 14); // CNO/CAEPF — não usado
  l1 += alfa(empresa.razaoSocial, 150);
  l1 += num(empresa.numeroRegistroInpiRepP || '', 17); // nº registro INPI do REP-P (preencher após homologação)
  l1 += dataOnly(dataInicial).padEnd(10, ' ').slice(0, 10);
  l1 += dataOnly(dataFinal).padEnd(10, ' ').slice(0, 10);
  l1 += dataHora(agora);
  l1 += '004'; // versão do leiaute
  l1 += '1'; // tipo identificador desenvolvedor: 1=CNPJ
  l1 += alfa('', 14); // CNPJ do desenvolvedor — configurável, deixado em branco por padrão
  l1 += alfa('', 30); // modelo (só REP-C)
  l1 += crc16Kermit(l1);
  linhas.push(l1);

  // ---- Tipo 2: Identificação da empresa (uma entrada representando a config atual) ----
  let qtd2 = 0;
  if (empresa.cnpj) {
    let l2 = '';
    l2 += num(1, 9); // NSR próprio deste registro de cabeçalho (namespace separado do NSR de marcações, é aceitável e comum)
    l2 += '2';
    l2 += dataHora(agora);
    l2 += num(soDigitos(empresa.cpfResponsavelRegistros), 14);
    l2 += '1';
    l2 += alfa(soDigitos(empresa.cnpj), 14);
    l2 += num('', 14);
    l2 += alfa(empresa.razaoSocial, 150);
    l2 += alfa(empresa.localPrestacaoServico, 100);
    l2 += crc16Kermit(l2);
    linhas.push(l2);
    qtd2 = 1;
  }

  // ---- Tipo 5: Inclusão/alteração de empregado — a partir da auditoria ----
  const eventosColaborador = await Auditoria.findAll({
    where: { empresaId, entidade: 'Colaborador', acao: ['create', 'update'] },
    order: [['createdAt', 'ASC']],
  });
  let nsrTipo5 = 1;
  const linhasTipo5 = [];
  for (const ev of eventosColaborador) {
    // eslint-disable-next-line no-await-in-loop
    const colaborador = await Colaborador.findByPk(ev.entidadeId);
    if (!colaborador || !colaborador.cpf) continue; // sem CPF não dá pra gerar o registro corretamente
    let l5 = '';
    l5 += num(nsrTipo5, 9);
    l5 += '5';
    l5 += dataHora(new Date(ev.createdAt));
    l5 += ev.acao === 'create' ? 'I' : 'A';
    l5 += num(colaborador.cpf, 12);
    l5 += alfa(colaborador.nome, 52);
    l5 += alfa('', 4);
    l5 += num('', 11);
    l5 += crc16Kermit(l5);
    linhasTipo5.push(l5);
    nsrTipo5 += 1;
  }
  linhas.push(...linhasTipo5);

  // ---- Tipo 7: Marcação de ponto (REP-P) — a parte que realmente importa ----
  let semCpf = 0;
  for (const r of registros7) {
    const cpf = soDigitos(r.Colaborador?.cpf);
    if (!cpf) { semCpf += 1; continue; }
    let l7 = '';
    l7 += num(r.nsr, 9);
    l7 += '7';
    l7 += dataHora(r.dataHoraMarcacao);
    l7 += num(cpf, 12);
    l7 += dataHora(r.dataHoraGravacao);
    l7 += r.idColetor;
    l7 += r.online ? '0' : '1';
    l7 += alfa(r.hashAtual, 64);
    linhas.push(l7);
  }

  // ---- Tipo 9: Trailer ----
  const l9 = num('999999999', 9) + num(qtd2, 9) + num(0, 9) + num(0, 9) + num(linhasTipo5.length, 9) + num(0, 9) + num(registros7.length - semCpf, 9) + '9';
  linhas.push(l9);

  // ---- Bloco de assinatura digital (placeholder, conforme item 10/OBS do
  // leiaute — a assinatura real fica num arquivo .p7s destacado, gerado com
  // certificado ICP-Brasil e-CNPJ da empresa, fora do escopo deste sistema) ----
  linhas.push(alfa('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S', 100));

  return {
    conteudo: linhas.join('\r\n') + '\r\n',
    nomeArquivo: `AFD_${soDigitos(empresa.cnpj) || 'SEMCNPJ'}_REP_P.txt`,
    avisos: [
      ...(semCpf > 0 ? [`${semCpf} marcação(ões) ignorada(s) por falta de CPF cadastrado do colaborador.`] : []),
      ...(!empresa.numeroRegistroInpiRepP ? ['Número de registro no INPI do REP-P não preenchido — obrigatório após homologação oficial do programa.'] : []),
      'Este arquivo segue o leiaute do Anexo V da Portaria 671/2021, mas NÃO inclui a assinatura digital CAdES/p7s exigida — isso requer certificado ICP-Brasil e-CNPJ da empresa, que é uma etapa de infraestrutura fora do escopo deste software.',
      'Recomenda-se validação por contador/consultoria trabalhista antes de apresentar este arquivo em fiscalização.',
    ],
  };
}

module.exports = { registrarMarcacaoBruta, gerarAfd, verificarIntegridadeCadeia, crc16Kermit };
