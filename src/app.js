require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const authRoutes = require('./routes/auth');
const colaboradoresRoutes = require('./routes/colaboradores');
const batidasRoutes = require('./routes/batidas');
const abonosRoutes = require('./routes/abonos');
const ausenciasRoutes = require('./routes/ausencias');
const feriadosRoutes = require('./routes/feriados');
const relatoriosRoutes = require('./routes/relatorios');
const cartaoPontoRoutes = require('./routes/cartaoPonto');
const notificacoesRoutes = require('./routes/notificacoes');
const usuariosRoutes = require('./routes/usuarios');
const empresasRoutes = require('./routes/empresas');
const auditoriaRoutes = require('./routes/auditoria');
const afdRoutes = require('./routes/afd');
const dashboardRoutes = require('./routes/dashboard');
const epiRoutes = require('./routes/epi');
const nr1Routes = require('./routes/nr1');
const folhaPagamentoRoutes = require('./routes/folhaPagamento');

const app = express();
app.use(cors({ exposedHeaders: ['X-Total-Count', 'X-Pagina', 'X-Total-Paginas'] }));
if (!process.env.VERCEL) app.use(morgan('dev')); // logs verbosos só fora de serverless
app.use(express.json());

// Estático: só faz sentido fora da Vercel (lá, /app é servido diretamente
// pela plataforma como arquivo estático — ver vercel.json — e /uploads só
// existe no fallback de disco local, que não roda em serverless).
if (!process.env.VERCEL) {
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  app.use('/app', express.static(path.join(__dirname, '..', 'mobile')));
  // Painel administrativo: na Vercel essa rota é resolvida pelo vercel.json
  // (arquivo estático servido pela plataforma). Fora dela — Docker/VPS/local —
  // é o próprio Express quem precisa servir o arquivo.
  app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, '..', 'sistema-ponto-integrado.html')));
}

app.get('/api/health', (req, res) => res.json({ status: 'ok', hora: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/colaboradores', colaboradoresRoutes);
app.use('/api/batidas', batidasRoutes);
app.use('/api/abonos', abonosRoutes);
app.use('/api/ausencias', ausenciasRoutes);
app.use('/api/feriados', feriadosRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/cartao-ponto', cartaoPontoRoutes);
app.use('/api/notificacoes', notificacoesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/afd', afdRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/epi', epiRoutes);
app.use('/api/nr1', nr1Routes);
app.use('/api/folha-pagamento', folhaPagamentoRoutes);

// Tratamento de erro genérico
app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
});

module.exports = app;
