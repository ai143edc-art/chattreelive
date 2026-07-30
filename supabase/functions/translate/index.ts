// OPTIONAL production translation via Gemini (keeps the API key server-side).
// The app works out of the box with the free MyMemory provider in src/lib/translate.ts;
// switch to this when you outgrow MyMemory's free daily limit.
//
// Deploy:
//   supabase functions deploy translate
//   supabase secrets set GEMINI_API_KEY=your_key
// Then in src/lib/translate.ts, route translateBatch through:
//   const { data } = await sb.functions.invoke('translate', { body: { texts, to } });
//   return data.translations;

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { texts, to } = await req.json();
    if (!Array.isArray(texts) || !to) return json({ error: 'Provide texts[] and to' }, 400);
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ error: 'GEMINI_API_KEY not set' }, 500);

    const target = to === 'hi' ? 'Hindi' : 'English';
    const prompt =
      `Translate each item of this JSON array of chat messages into ${target}. `
      + 'Keep the same order and count, preserve emojis, keep it natural and conversational. '
      + 'Return ONLY a JSON array of strings, nothing else.\n'
      + JSON.stringify(texts);

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    const data = await r.json();
    let out: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
    out = out.replace(/```json|```/g, '').trim();
    let translations: string[];
    try { translations = JSON.parse(out); } catch { translations = texts; }
    return json({ translations });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
