// Secure 1:1 voice/video calling for Continue Chat, over WebRTC.
//
// SECURITY: the actual audio/video is peer-to-peer and encrypted end-to-end by
// WebRTC itself (mandatory DTLS-SRTP) — it never passes through our server. Only
// the tiny "signaling" messages (SDP offer/answer + ICE candidates, i.e. how to
// connect — NOT the media) go through the room's Supabase Realtime broadcast
// channel, which is scoped to the unguessable room id. STUN (Google's public
// servers) is used only to discover network routes; no media flows through it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Side } from './rooms';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected';
export type CallEnd = '' | 'declined' | 'ended' | 'media' | 'failed';
type SignalKind = 'invite' | 'answer' | 'ice' | 'reject' | 'end' | 'cancel';
interface Signal {
  kind: SignalKind; from: Side; video?: boolean;
  sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit;
}

export interface CallApi {
  state: CallState;
  isVideo: boolean;
  muted: boolean;
  camOff: boolean;
  ended: CallEnd;          // brief reason shown right after a call closes
  seconds: number;         // connected duration
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  start: (video: boolean) => void;
  accept: () => void;
  reject: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCam: () => void;
}

/** 1:1 WebRTC call bound to a room. Pass roomId=null while there's no active room. */
export function useCall(roomId: string | null, mySide: Side): CallApi {
  const [state, setState] = useState<CallState>('idle');
  const [isVideo, setIsVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [ended, setEnded] = useState<CallEnd>('');
  const [seconds, setSeconds] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const incomingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const remoteReady = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const stateRef = useRef<CallState>('idle'); stateRef.current = state;
  const isVideoRef = useRef(false); isVideoRef.current = isVideo;

  const send = useCallback((s: Omit<Signal, 'from'>) => {
    chanRef.current?.send({ type: 'broadcast', event: 'signal', payload: { ...s, from: mySide } });
  }, [mySide]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    const t0 = Date.now();
    timerRef.current = window.setInterval(() => setSeconds(Math.floor((Date.now() - t0) / 1000)), 1000);
  }, []);

  const cleanup = useCallback((reason: CallEnd) => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = undefined; }
    try { pcRef.current?.getSenders().forEach((s) => { try { s.track?.stop(); } catch { /* ignore */ } }); } catch { /* ignore */ }
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    pendingIce.current = []; incomingOffer.current = null; remoteReady.current = false;
    setLocalStream(null); setRemoteStream(null);
    setMuted(false); setCamOff(false); setSeconds(0);
    setState('idle');
    setEnded(reason);
    if (reason) window.setTimeout(() => setEnded(''), 1800);
  }, []);

  const flushIce = useCallback(async () => {
    for (const c of pendingIce.current) { try { await pcRef.current?.addIceCandidate(c); } catch { /* ignore */ } }
    pendingIce.current = [];
  }, []);

  const newPc = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => { if (e.candidate) send({ kind: 'ice', candidate: e.candidate.toJSON() }); };
    pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? null);
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') { setState('connected'); startTimer(); }
      else if (st === 'failed') cleanup('failed');
    };
    pcRef.current = pc;
    return pc;
  }, [send, startTimer, cleanup]);

  const getMedia = useCallback(async (video: boolean): Promise<MediaStream> => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video });
    localRef.current = s; setLocalStream(s);
    return s;
  }, []);

  const handleSignal = useCallback(async (sig: Signal) => {
    if (sig.from === mySide) return;
    switch (sig.kind) {
      case 'invite':
        if (stateRef.current !== 'idle') { send({ kind: 'reject' }); return; }   // busy
        incomingOffer.current = sig.sdp ?? null;
        setIsVideo(!!sig.video);
        setState('ringing');
        break;
      case 'answer':
        if (pcRef.current && sig.sdp) {
          await pcRef.current.setRemoteDescription(sig.sdp);
          remoteReady.current = true; await flushIce();
          setState('connecting');
        }
        break;
      case 'ice':
        if (sig.candidate) {
          if (remoteReady.current && pcRef.current) { try { await pcRef.current.addIceCandidate(sig.candidate); } catch { /* ignore */ } }
          else pendingIce.current.push(sig.candidate);
        }
        break;
      case 'reject':
        cleanup('declined'); break;
      case 'end':
      case 'cancel':
        cleanup(stateRef.current === 'connected' ? 'ended' : ''); break;
    }
  }, [mySide, send, flushIce, cleanup]);

  // subscribe to the room's call signaling channel
  useEffect(() => {
    if (!roomId) return;
    const ch = sb.channel(`call-${roomId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'signal' }, (p) => { void handleSignal(p.payload as Signal); }).subscribe();
    chanRef.current = ch;
    return () => { sb.removeChannel(ch); chanRef.current = null; };
  }, [roomId, handleSignal]);

  // stop everything if the component using this unmounts mid-call
  useEffect(() => () => cleanup(''), [cleanup]);

  const start = useCallback((video: boolean) => {
    if (stateRef.current !== 'idle') return;
    setEnded(''); setIsVideo(video); setState('calling');
    (async () => {
      try {
        const stream = await getMedia(video);
        const pc = newPc();
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ kind: 'invite', video, sdp: offer });
      } catch { cleanup('media'); }
    })();
  }, [getMedia, newPc, send, cleanup]);

  const accept = useCallback(() => {
    if (stateRef.current !== 'ringing' || !incomingOffer.current) return;
    setEnded(''); setState('connecting');
    (async () => {
      try {
        const stream = await getMedia(isVideoRef.current);
        const pc = newPc();
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        await pc.setRemoteDescription(incomingOffer.current!);
        remoteReady.current = true; await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ kind: 'answer', sdp: answer });
      } catch { send({ kind: 'reject' }); cleanup('media'); }
    })();
  }, [getMedia, newPc, flushIce, send, cleanup]);

  const reject = useCallback(() => { send({ kind: 'reject' }); cleanup(''); }, [send, cleanup]);
  const hangup = useCallback(() => {
    send(stateRef.current === 'calling' ? { kind: 'cancel' } : { kind: 'end' });
    cleanup(stateRef.current === 'connected' ? 'ended' : '');
  }, [send, cleanup]);

  const toggleMute = useCallback(() => {
    const s = localRef.current; if (!s) return;
    const on = s.getAudioTracks().some((t) => t.enabled);
    s.getAudioTracks().forEach((t) => { t.enabled = !on; });
    setMuted(on);
  }, []);
  const toggleCam = useCallback(() => {
    const s = localRef.current; if (!s) return;
    const on = s.getVideoTracks().some((t) => t.enabled);
    s.getVideoTracks().forEach((t) => { t.enabled = !on; });
    setCamOff(on);
  }, []);

  return { state, isVideo, muted, camOff, ended, seconds, localStream, remoteStream, start, accept, reject, hangup, toggleMute, toggleCam };
}
