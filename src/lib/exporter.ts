function stampWatermark(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const fs = Math.min(30, Math.max(15, Math.round(W * 0.024)));
  const text = 'chattreeapp.fun';
  ctx.save();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.font = `600 ${fs}px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif`;
  ctx.textBaseline = 'middle';
  const padX = Math.round(fs * 0.72), padY = Math.round(fs * 0.44);
  const chipW = ctx.measureText(text).width + padX * 2;
  const chipH = fs + padY * 2;
  const margin = Math.round(fs * 0.85);
  const x = W - chipW - margin, y = H - chipH - margin, r = chipH / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + chipW, y, x + chipW, y + chipH, r);
  ctx.arcTo(x + chipW, y + chipH, x, y + chipH, r);
  ctx.arcTo(x, y + chipH, x, y, r);
  ctx.arcTo(x, y, x + chipW, y, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(17,27,33,0.5)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + padX, y + chipH / 2 + 1);
  ctx.restore();
}

export async function exportChat(mode: 'png' | 'pdf', filename: string): Promise<void> {
  const screen = document.querySelector('.screen') as HTMLElement | null;
  const phone = document.querySelector('.phone') as HTMLElement | null;
  const body = document.querySelector('.wa-body') as HTMLElement | null;
  if (!screen || !phone || !body) throw new Error('Open a chat first.');

  const html2canvas = (await import('html2canvas')).default;

  const prev = {
    transform: phone.style.transform,
    screenH: screen.style.height,
    bodyH: body.style.height,
    bodyOv: body.style.overflow,
  };
  phone.style.transform = 'none';
  screen.style.height = 'auto';
  body.style.height = 'auto';
  body.style.overflow = 'visible';

  try {
    const canvas = await html2canvas(screen, { scale: 2, useCORS: true, backgroundColor: null, logging: false });
    stampWatermark(canvas);
    const safe = (filename || 'chat').replace(/[^a-z0-9._-]+/gi, '_');
    if (mode === 'png') {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${safe}.png`;
      a.click();
    } else {
      const { jsPDF } = await import('jspdf');
      const w = canvas.width, h = canvas.height;
      const pdf = new jsPDF({ orientation: h >= w ? 'p' : 'l', unit: 'px', format: [w, h] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
      pdf.save(`${safe}.pdf`);
    }
  } finally {
    phone.style.transform = prev.transform;
    screen.style.height = prev.screenH;
    body.style.height = prev.bodyH;
    body.style.overflow = prev.bodyOv;
  }
}
