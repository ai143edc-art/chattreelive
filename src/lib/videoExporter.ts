function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const fs = Math.min(28, Math.max(14, Math.round(W * 0.022)));
  const text = 'chattreeapp.fun';
  ctx.save();
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

export async function exportVideo(filename: string, onProgress?: (p: number) => void): Promise<void> {
  const screen = document.querySelector('.screen') as HTMLElement | null;
  const phone = document.querySelector('.phone') as HTMLElement | null;
  const body = document.querySelector('.wa-body') as HTMLElement | null;
  if (!screen || !phone || !body) throw new Error('Open a chat first.');
  if (typeof (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
    throw new Error('Video export is not supported in this browser.');
  }

  const SCALE = 2;
  const viewportH = Math.round(screen.clientHeight * SCALE);
  const screenTop0 = screen.getBoundingClientRect().top;
  const fixedTopH = Math.round((body.getBoundingClientRect().top - screenTop0) * SCALE);

  const html2canvas = (await import('html2canvas')).default;
  const prev = { transform: phone.style.transform, screenH: screen.style.height, bodyH: body.style.height, bodyOv: body.style.overflow };
  phone.style.transform = 'none';
  screen.style.height = 'auto';
  body.style.height = 'auto';
  body.style.overflow = 'visible';

  let srcFull: HTMLCanvasElement;
  let srcEmpty: HTMLCanvasElement;
  let rects: number[];
  try {
    const screenTop = screen.getBoundingClientRect().top;
    srcFull = await html2canvas(screen, { scale: SCALE, useCORS: true, backgroundColor: null, logging: false });
    rects = [...screen.querySelectorAll<HTMLElement>('.row[data-mi]')]
      .map((el) => (el.getBoundingClientRect().bottom - screenTop) * SCALE);
    const hide = document.createElement('style');
    hide.textContent = '.row{visibility:hidden!important}';
    document.head.appendChild(hide);
    srcEmpty = await html2canvas(screen, { scale: SCALE, useCORS: true, backgroundColor: null, logging: false });
    document.head.removeChild(hide);
  } finally {
    phone.style.transform = prev.transform;
    screen.style.height = prev.screenH;
    body.style.height = prev.bodyH;
    body.style.overflow = prev.bodyOv;
  }

  if (!rects.length) rects = [srcFull.height];
  const W = srcFull.width;
  const H = Math.min(viewportH, srcFull.height);
  const bodyViewH = H - fixedTopH;
  const bodyScrollMax = Math.max(0, srcFull.height - fixedTopH - bodyViewH);

  const holdOf = (i: number) => {
    const prevB = i === 0 ? fixedTopH : rects[i - 1];
    return Math.max(650, Math.min(2600, 500 + (rects[i] - prevB) * 1.1));
  };
  const times: number[] = [];
  let acc = 600;
  for (let i = 0; i < rects.length; i++) { times.push(acc); acc += holdOf(i); }
  let total = acc + 900;
  const cap = 90000;
  const squeeze = total > cap ? cap / total : 1;
  if (squeeze < 1) { for (let i = 0; i < times.length; i++) times[i] *= squeeze; total *= squeeze; }

  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d')!;
  const scrollFor = (i: number) => Math.max(0, Math.min(bodyScrollMax, rects[i] - fixedTopH - bodyViewH + Math.round(28 * SCALE)));

  const draw = (t: number) => {
    let c = -1;
    for (let i = 0; i < times.length; i++) { if (t >= times[i]) c = i; else break; }
    ctx.clearRect(0, 0, W, H);
    const target = c < 0 ? 0 : scrollFor(c);
    const from = c <= 0 ? 0 : scrollFor(c - 1);
    let s = target;
    if (c >= 0) {
      const k = Math.min(1, (t - times[c]) / (380 * squeeze));
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      s = from + (target - from) * ease;
    }
    ctx.drawImage(srcFull, 0, 0, W, fixedTopH, 0, 0, W, fixedTopH);
    const sy = fixedTopH + s;
    ctx.drawImage(srcEmpty, 0, sy, W, bodyViewH, 0, fixedTopH, W, bodyViewH);
    if (c >= 0) {
      const y0 = sy;
      const y1 = Math.min(rects[c], sy + bodyViewH);
      if (y1 > y0) ctx.drawImage(srcFull, 0, y0, W, y1 - y0, 0, fixedTopH, W, y1 - y0);
    }
    drawWatermark(ctx, W, H);
  };

  draw(0);
  const stream = (out as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
  const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  rec.start();

  await new Promise<void>((resolve) => {
    const t0 = performance.now();
    const tick = () => {
      const t = performance.now() - t0;
      draw(Math.min(t, total));
      onProgress?.(Math.min(1, t / total));
      if (t >= total) { resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await stopped;

  const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(filename || 'chat').replace(/[^a-z0-9._-]+/gi, '_')}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}
