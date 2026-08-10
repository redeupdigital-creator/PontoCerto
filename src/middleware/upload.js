const multer = require('multer');

// Sempre memória (buffer), nunca disco: o serviço de storage
// (src/services/storage.js) decide, em cada ambiente, para onde o buffer vai
// — Supabase Storage em produção/serverless, ou disco local em desenvolvimento.
// Isso é essencial para rodar em Vercel, onde o sistema de arquivos do
// deployment é somente leitura em runtime (exceto /tmp, que é efêmero).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Arquivo deve ser uma imagem'));
    cb(null, true);
  },
});

module.exports = upload;
