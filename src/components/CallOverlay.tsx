import { useEffect, useRef } from 'react';
import type { CallApi } from '../lib/webrtcCall';
import type { TKey } from '../lib/i18n';

type T = (k: TKey) => string;

function mmss(s: number): string {
  const m = Math.floor(s / 60); const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Full-screen call UI for Continue Chat — incoming/outgoing/in-call. */
export default function CallOverlay({ call, otherName, t }: { call: CallApi; otherName: string; t: T }) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (remoteRef.current) remoteRef.current.srcObject = call.remoteStream; }, [call.remoteStream]);
  useEffect(() => { if (localRef.current) localRef.current.srcObject = call.localStream; }, [call.localStream]);

  const { state, isVideo, ended } = call;
  const showVideo = isVideo && state === 'connected';

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 500, color: '#fff',
    background: showVideo ? '#0b1013' : 'linear-gradient(160deg,#075e54,#0b201c)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
    padding: '38px 20px 40px', boxSizing: 'border-box', overflow: 'hidden',
  };
  const avatar: React.CSSProperties = {
    width: 108, height: 108, borderRadius: '50%', background: '#ffffff28', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontSize: 46, fontWeight: 800, margin: '0 auto 18px',
  };
  const roundBtn = (bg: string): React.CSSProperties => ({
    width: 62, height: 62, borderRadius: '50%', border: 'none', background: bg, color: '#fff',
    fontSize: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(0,0,0,.3)',
  });
  const smallBtn = (bg: string): React.CSSProperties => ({ ...roundBtn(bg), width: 54, height: 54, fontSize: 22 });

  // brief "call ended / declined" flash after the call closes
  if (state === 'idle') {
    if (!ended) return null;
    const msg = ended === 'declined' ? t('callDeclined')
      : ended === 'media' ? t('callErrMedia')
        : ended === 'failed' ? t('callFailed') : t('callEnded');
    return (
      <div style={{ ...overlay, justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={avatar}>{(otherName || '?').charAt(0).toUpperCase()}</div>
          <div style={{ fontSize: 17, opacity: 0.9 }}>{msg}</div>
        </div>
      </div>
    );
  }

  const statusText = state === 'calling' ? t('callCalling')
    : state === 'ringing' ? (isVideo ? t('callRingingVideo') : t('callRingingVoice'))
      : state === 'connecting' ? t('callConnecting')
        : mmss(call.seconds);

  return (
    <div style={overlay}>
      {showVideo && (
        <video ref={remoteRef} autoPlay playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#0b1013' }} />
      )}
      {/* remote audio always plays (a video element renders + plays the audio track even for a voice call) */}
      {!showVideo && <video ref={remoteRef} autoPlay playsInline style={{ display: 'none' }} />}

      {showVideo && (
        <video ref={localRef} autoPlay playsInline muted
          style={{ position: 'absolute', top: 16, right: 16, width: 108, height: 150, objectFit: 'cover', borderRadius: 12, border: '2px solid #ffffff55', zIndex: 2, background: '#000' }} />
      )}

      {/* header: name + status */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', textShadow: showVideo ? '0 1px 6px rgba(0,0,0,.6)' : 'none' }}>
        <div style={{ fontSize: 23, fontWeight: 800 }}>{otherName}</div>
        <div style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>{statusText}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>{t('callEncrypted')}</div>
      </div>

      {/* centre avatar for non-video states */}
      {!showVideo && (
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={avatar}>{(otherName || '?').charAt(0).toUpperCase()}</div>
        </div>
      )}

      {/* controls */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 22, alignItems: 'center' }}>
        {state === 'ringing' ? (
          <>
            <button style={roundBtn('#e5484d')} onClick={call.reject} title={t('callDecline')} aria-label={t('callDecline')}>✕</button>
            <button style={roundBtn('#25d366')} onClick={call.accept} title={t('callAccept')} aria-label={t('callAccept')}>{isVideo ? '📹' : '📞'}</button>
          </>
        ) : (
          <>
            {(state === 'connected' || state === 'connecting') && (
              <button style={smallBtn(call.muted ? '#ffffff33' : '#ffffff22')} onClick={call.toggleMute}
                title={call.muted ? t('callUnmute') : t('callMute')} aria-label={t('callMute')}>{call.muted ? '🔇' : '🎙️'}</button>
            )}
            {isVideo && (state === 'connected' || state === 'connecting') && (
              <button style={smallBtn(call.camOff ? '#ffffff33' : '#ffffff22')} onClick={call.toggleCam}
                title={t('callCam')} aria-label={t('callCam')}>{call.camOff ? '📷' : '🎥'}</button>
            )}
            <button style={roundBtn('#e5484d')} onClick={call.hangup} title={t('callEnd')} aria-label={t('callEnd')}>📞</button>
          </>
        )}
      </div>
    </div>
  );
}
