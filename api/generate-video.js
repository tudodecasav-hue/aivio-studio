const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

module.exports.config = { maxDuration: 30 };

const safe = (value, fallback = '') => String(value ?? fallback).replace(/[<>]/g, '').slice(0, 180);
const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#8B1E1E';

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.slice(-4000) || `ffmpeg exited ${code}`)));
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  try {
    const p = req.body || {};
    const name = safe(p.businessName, 'Projeto');
    const primary = safeColor(p.primary);
    const secondary = safeColor(p.secondary || '#F4E9D8');
    const products = Array.isArray(p.products) ? p.products.slice(0, 3) : [];
    const slides = [
      { title: 'APRESENTAÇÃO DO PROJETO', body: `${name}\n${safe(p.category, 'Projeto personalizado')}` },
      { title: 'SITE PERSONALIZADO', body: safe(p.description, 'Site criado especificamente para este cliente.') },
      { title: 'CARDÁPIO / SERVIÇOS', body: products.length ? products.map(x => `${safe(x.name, 'Produto')} — R$ ${safe(x.price, '0,00')}`).join('\n') : 'Produtos e serviços do projeto' },
      { title: 'CONTATO E CONVERSÃO', body: `${safe(p.phone, '')}\n${safe(p.address, '')}\nWhatsApp disponível no projeto` },
      { title: 'PROJETO PRONTO', body: `Material preparado para ${name}.\nPDF + vídeo + link para análise.` }
    ];

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `aivio-${id}-`));
    const out = path.join(dir, 'demonstracao.mp4');
    const inputs = [];
    const filters = [];

    slides.forEach((slide, i) => {
      const titleFile = path.join(dir, `title-${i}.txt`);
      const bodyFile = path.join(dir, `body-${i}.txt`);
      fs.writeFileSync(titleFile, slide.title, 'utf8');
      fs.writeFileSync(bodyFile, slide.body, 'utf8');
      inputs.push('-f', 'lavfi', '-i', `color=c=${i % 2 ? secondary : primary}:s=1280x720:r=30:d=2`);
      filters.push(`[${i}:v]drawtext=font='DejaVu Sans':textfile='${titleFile}':fontcolor=${i % 2 ? primary : '#ffffff'}:fontsize=48:x=60:y=130:box=1:boxcolor=${i % 2 ? '#ffffff' : '#111111'}@0.10:boxborderw=20,drawtext=font='DejaVu Sans':textfile='${bodyFile}':fontcolor=${i % 2 ? '#222222' : '#ffffff'}:fontsize=28:x=60:y=260:line_spacing=16[v${i}]`);
    });

    const concat = slides.map((_, i) => `[v${i}]`).join('') + `concat=n=${slides.length}:v=1:a=0,format=yuv420p[v]`;
    const filter = filters.join(';') + ';' + concat;
    const args = [...inputs, '-filter_complex', filter, '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out, '-y'];

    await runFfmpeg(args);
    const data = fs.readFileSync(out);
    fs.rmSync(dir, { recursive: true, force: true });

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^a-z0-9]+/gi, '-')}-demonstracao.mp4"`);
    res.setHeader('Content-Length', data.length);
    return res.status(200).send(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Não foi possível gerar o vídeo MP4.', detail: error.message });
  }
};
