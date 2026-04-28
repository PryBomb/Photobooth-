/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Download, 
  Video, 
  Music, 
  VolumeX, 
  Volume2, 
  Mic, 
  MicOff, 
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

const VINTAGE_MUSIC_URL = 'https://www.chosic.com/wp-content/uploads/2021/07/The-Old-Clock-Shop.mp3';

export default function App() {
  // State
  const [layout, setLayout] = useState('triple');
  const [activeFilter, setActiveFilter] = useState('bryant');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [includeMic, setIncludeMic] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const LAYOUT_CONFIGS: Record<string, { count: number; name: string }> = {
    'polaroid': { count: 1, name: 'Polaroid' },
    'double': { count: 2, name: '2 Strips' },
    'triple': { count: 3, name: '3 Strips' },
    'quad': { count: 4, name: '4 Strips' },
    'collage': { count: 4, name: 'Collage' },
  };

  const FILTERS: Record<string, { class: string; canvas: string; name: string }> = {
    'bryant': { class: 'filter-bryant', canvas: 'grayscale(100%) contrast(140%) brightness(110%)', name: 'Bryant' },
    'noir': { class: 'filter-noir', canvas: 'grayscale(100%) contrast(180%) brightness(90%)', name: 'Noir' },
    'sepia': { class: 'filter-sepia', canvas: 'sepia(80%) contrast(110%) brightness(100%)', name: 'Sepia' },
    'natural': { class: 'filter-natural', canvas: 'contrast(105%) saturate(110%)', name: 'Natural' },
  };

  // Sound generator
  const playBeep = useCallback((freq = 880, duration = 0.1, type: OscillatorType = 'sine') => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  }, []);

  const playShutterSound = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    // A slightly more complex click sound
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBuffer.length; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }, []);

  const playMachineSound = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const duration = 2.0;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, ctx.currentTime + duration - 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(80, ctx.currentTime);
    const motorGain = ctx.createGain();
    motorGain.gain.setValueAtTime(0.015, ctx.currentTime);

    motor.connect(motorGain);
    motorGain.connect(gain);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    motor.start();
    noise.stop(ctx.currentTime + duration);
    motor.stop(ctx.currentTime + duration);
  }, []);

  // Initialize Camera & Audio
  const initMedia = useCallback(async () => {
    try {
      const constraints = {
        video: { width: 1280, height: 720 },
        audio: includeMic
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error('Error accessing media:', err);
      setError('Camera or Microphone access denied. Check permissions.');
    }
  }, [includeMic]);

  useEffect(() => {
    initMedia();
    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [initMedia]);

  // Recording Logic
  const startRecording = useCallback(() => {
    if (!stream) return;
    recordedChunksRef.current = [];
    
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    let mimeType = '';
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }

    try {
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setReplayUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
    } catch (e) {
      console.error('Recorder initialization failed:', e);
    }
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const capturePhoto = useCallback((idx: number) => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    canvasRef.current.width = 640;
    canvasRef.current.height = 480;

    setIsFlashActive(true);
    playShutterSound();
    setTimeout(() => setIsFlashActive(false), 100);

    ctx.drawImage(videoRef.current, 0, 0, 640, 480);

    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
    setPhotos(prev => {
      const next = [...prev];
      next[idx] = dataUrl;
      return next;
    });
  }, [playShutterSound]);

  const runSession = async () => {
    if (!stream || isCapturing) return;
    
    setIsCapturing(true);
    setPhotos([]);
    setReplayUrl(null);
    setSessionFinished(false);

    if (musicRef.current) {
      musicRef.current.muted = isMuted;
      musicRef.current.currentTime = 0;
      musicRef.current.play().catch(() => {});
    }

    startRecording();

    const photoCount = LAYOUT_CONFIGS[layout].count;

    for (let i = 0; i < photoCount; i++) {
      for (let c = 3; c > 0; c--) {
        setCountdown(c);
        playBeep(880, 0.1);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(null);
      capturePhoto(i);
      await new Promise(r => setTimeout(r, 1000));
    }

    setTimeout(() => {
      stopRecording();
      setIsCapturing(false);
      setSessionFinished(true);
      playMachineSound();
      if (musicRef.current) musicRef.current.pause();
    }, 1000);
  };

  const handleDownloadStrip = async () => {
    if (photos.length < LAYOUT_CONFIGS[layout].count) return;
    setIsSaving(true);
    
    const stripCanvas = document.createElement('canvas');
    const ctx = stripCanvas.getContext('2d');
    if (!ctx) return;

    let width = 400;
    let height = 1000;
    const count = LAYOUT_CONFIGS[layout].count;

    if (layout === 'polaroid') {
      width = 400;
      height = 500;
    } else if (layout === 'collage') {
      width = 600;
      height = 700;
    } else {
      height = 40 + (count * 285) + 120; // Dynamic height for 1, 2, 3, 4 strips
    }

    stripCanvas.width = width;
    stripCanvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    if (layout === 'collage') {
      const imgSize = 270;
      const startX = 20;
      const startY = 20;
      for (let i = 0; i < 4; i++) {
        const img = new Image();
        img.src = photos[i];
        await new Promise(r => img.onload = r);
        const col = i % 2;
        const row = Math.floor(i / 2);
        ctx.filter = FILTERS[activeFilter].canvas;
        ctx.drawImage(img, startX + (col * (imgSize + 20)), startY + (row * (imgSize + 20)), imgSize, imgSize);
      }
    } else if (layout === 'polaroid') {
      const imgW = 340;
      const imgH = 340; // Square for polaroid
      const img = new Image();
      img.src = photos[0];
      await new Promise(r => img.onload = r);
      ctx.filter = FILTERS[activeFilter].canvas;
      ctx.drawImage(img, 30, 30, imgW, imgH);
    } else {
      // Strip layouts (2, 3, 4) - Standard 2x6 logic
      // We'll scale up for high quality (600x1800)
      stripCanvas.width = 600;
      stripCanvas.height = 1800;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 600, 1800);

      const imgW = 540;
      const imgH = 405;
      const startY = 30;
      const spacing = 20;
      
      for (let i = 0; i < count; i++) {
        const img = new Image();
        img.src = photos[i];
        await new Promise(r => img.onload = r);
        ctx.filter = FILTERS[activeFilter].canvas;
        ctx.drawImage(img, 30, startY + (i * (imgH + spacing)), imgW, imgH);
      }
      
      width = 600;
      height = 1800;
    }

    // Branding
    ctx.filter = 'none';
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '600 16px Inter';
    ctx.fillText(new Date().toLocaleDateString().toUpperCase(), width / 2, height - 60);

    const link = document.createElement('a');
    link.download = `${layout}-${Date.now()}.jpg`;
    link.href = stripCanvas.toDataURL('image/jpeg', 1.0);
    link.click();
    setIsSaving(false);
  };

  const handleDownloadVideo = () => {
    if (replayUrl) {
      const link = document.createElement('a');
      link.download = `memory-${Date.now()}.webm`;
      link.href = replayUrl;
      link.click();
    }
  };

  return (
    <div className="min-h-screen bg-minimal-bg text-minimal-ink selection:bg-black selection:text-white pb-20">
      {/* HUD Header */}
      <nav className="fixed top-0 left-0 w-full p-6 flex justify-between items-center z-50 backdrop-blur-md bg-minimal-bg/60 border-b border-minimal-border">
        <div className="flex flex-col">
          <span className="font-serif text-2xl font-black tracking-tighter leading-none">FRAME.</span>
          <span className="font-mono text-[10px] uppercase tracking-widest opacity-40">Minimal Photobooth v3.0</span>
        </div>
        
        <div className="hidden md:flex items-center gap-2 bg-minimal-ink/5 p-1 rounded-full border border-minimal-border">
          {Object.entries(LAYOUT_CONFIGS).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => !isCapturing && setLayout(key)}
              disabled={isCapturing}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                layout === key 
                ? 'bg-minimal-ink text-white shadow-lg' 
                : 'text-minimal-ink/40 hover:text-minimal-ink hover:bg-minimal-ink/5'
              }`}
            >
              {cfg.name}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-full transition-all ${isMuted ? 'text-gray-300' : 'text-minimal-ink'}`}
            title={isMuted ? "Unmute Music" : "Mute Music"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button 
            onClick={() => setIncludeMic(!includeMic)}
            className={`p-2 rounded-full transition-all ${!includeMic ? 'text-gray-300' : 'text-minimal-ink'}`}
            title={includeMic ? "Mute Mic" : "Include Mic Audio"}
          >
            {includeMic ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Layout Selection */}
      <div className="md:hidden pt-24 px-6 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 pb-2">
          {Object.entries(LAYOUT_CONFIGS).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => !isCapturing && setLayout(key)}
              disabled={isCapturing}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                layout === key 
                ? 'bg-minimal-ink text-white' 
                : 'bg-white border border-minimal-border text-minimal-ink/40'
              }`}
            >
              {cfg.name}
            </button>
          ))}
        </div>
      </div>

      <main className="pt-8 md:pt-32 flex flex-col items-center max-w-7xl mx-auto px-6">
        <div className="w-full grid lg:grid-cols-12 gap-12 items-start">
          
          {/* Left: Video Viewfinder */}
          <div className="lg:col-span-12 xl:col-span-7 flex flex-col items-center">
            <div className="relative w-full aspect-video bg-white shadow-2xl rounded-2xl overflow-hidden border-8 border-white p-1">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                muted 
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-100 ${FILTERS[activeFilter].class} ${isFlashActive ? 'opacity-0' : 'opacity-100'}`}
              />
              
              {/* Countdown Overlay */}
              <AnimatePresence>
                {countdown !== null && (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]"
                  >
                    <span className="text-[180px] font-countdown text-white drop-shadow-2xl">
                      {countdown}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Flash Screen */}
              <AnimatePresence>
                {isFlashActive && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white z-50"
                  />
                )}
              </AnimatePresence>

              {/* HUD Marks */}
              <div className="absolute top-8 left-8 flex flex-col gap-1">
                <div className="w-8 h-[2px] bg-white/40" />
                <div className="h-8 w-[2px] bg-white/40" />
              </div>
              <div className="absolute bottom-8 right-8 flex flex-col items-end gap-1">
                <div className="h-8 w-[2px] bg-white/40" />
                <div className="w-8 h-[2px] bg-white/40" />
              </div>

              {isCapturing && (
                <div className="absolute bottom-10 left-10 flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-sm text-[10px] font-bold tracking-widest uppercase animate-pulse">
                    <div className="w-2 h-2 bg-white rounded-full" />
                    Recording {photos.length}/{LAYOUT_CONFIGS[layout].count}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-12 flex flex-col items-center gap-6">
              {/* Filter Selector */}
              <div className="flex bg-minimal-ink/5 p-1 rounded-full border border-minimal-border">
                {Object.entries(FILTERS).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => !isCapturing && setActiveFilter(key)}
                    className={`px-6 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all ${
                      activeFilter === key 
                      ? 'bg-minimal-ink text-white' 
                      : 'text-minimal-ink/40 hover:text-minimal-ink'
                    }`}
                  >
                    {cfg.name}
                  </button>
                ))}
              </div>

              <button
                onClick={runSession}
                disabled={isCapturing}
                className="group relative px-12 py-5 bg-minimal-ink text-white rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-xl"
              >
                <div className="relative z-10 flex items-center gap-3 font-bold tracking-widest text-xs uppercase">
                  {isCapturing ? <RefreshCw className="animate-spin w-4 h-4" /> : <Camera className="w-4 h-4" />}
                  {isCapturing ? 'Wait for Flash' : `Capture ${LAYOUT_CONFIGS[layout].name}`}
                </div>
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <p className="font-mono text-[9px] uppercase tracking-widest opacity-30">Camera ready • {layout.toUpperCase()} MODE</p>
            </div>
            
            {error && (
              <div className="mt-6 flex items-center gap-2 text-red-500 font-mono text-[10px] uppercase tracking-widest">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>

          {/* Right: The Machine Slot & Output */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col items-center">
            <div className="relative w-full max-sm:max-w-xs max-w-sm">
              {/* The "Machine Slot" */}
              <div className="relative bg-white h-24 w-full rounded-t-3xl border-x-4 border-t-4 border-minimal-border shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.1)] z-20 flex flex-col items-center justify-center overflow-hidden">
                <div className="w-4/5 h-2 bg-minimal-ink/10 rounded-full mb-1" />
                <div className="w-3/4 h-1 bg-minimal-ink/5 rounded-full" />
                <div className="absolute -bottom-1 w-full h-4 bg-minimal-border" />
              </div>

              {/* Emerging Strip */}
              <div className="relative w-full flex justify-center -mt-4 bg-minimal-border/20 py-10 rounded-b-3xl border-b-4 border-x-4 border-minimal-border transition-all duration-1000 min-h-[300px] overflow-hidden">
                <AnimatePresence mode="wait">
                  {sessionFinished && (
                    <motion.div
                      key={layout}
                      initial={{ y: -600, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", damping: 12, stiffness: 40, delay: 0.2 }}
                      className={`relative bg-white p-4 ${layout === 'collage' ? 'w-[280px]' : 'w-[200px]'} shadow-2xl flex flex-col gap-4 border border-minimal-border origin-top z-10`}
                    >
                      <div className={layout === 'collage' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-3'}>
                        {photos.map((src, idx) => (
                          <div key={idx} className={`${layout === 'polaroid' ? 'aspect-square' : 'aspect-[4/3]'} bg-gray-50 flex items-center justify-center overflow-hidden border-2 border-white shadow-inner relative`}>
                            <motion.img 
                              initial={{ opacity: 0, scale: 1.1 }}
                              animate={{ opacity: 1, scale: 1 }}
                              src={src} 
                              alt="" 
                              className={`w-full h-full object-cover ${FILTERS[activeFilter].class}`} 
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className={`flex flex-col items-center ${layout === 'polaroid' ? 'pt-6 pb-2' : 'pt-2 border-t border-minimal-border/50'}`}>
                        <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">{new Date().toLocaleDateString()}</span>
                      </div>
                      
                      {/* Polaroid bottom lift effect */}
                      {layout === 'polaroid' && <div className="absolute inset-x-0 bottom-0 h-10 bg-white pointer-events-none" />}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Progress Indicators */}
                {!sessionFinished && !isCapturing && (
                  <div className="flex flex-col items-center justify-center opacity-20">
                    <ImageIcon size={48} className="mb-4" />
                    <p className="font-mono text-[10px] uppercase tracking-widest text-center">Awaiting Capture<br/>(Choose layout above)</p>
                  </div>
                )}
                {isCapturing && (
                   <div className="flex flex-col items-center justify-center animate-pulse opacity-40">
                     <div className="w-16 h-1 w-full bg-minimal-ink rounded-full mb-8" />
                     <p className="font-mono text-[10px] uppercase tracking-widest">Printing {photos.length} of {LAYOUT_CONFIGS[layout].count}...</p>
                   </div>
                )}
              </div>
            </div>

            {/* Actions for Finished Session */}
            <AnimatePresence>
              {sessionFinished && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-12 flex flex-col gap-4 w-full max-w-xs"
                >
                  <button
                    onClick={handleDownloadStrip}
                    disabled={isSaving}
                    className="flex justify-between items-center w-full px-6 py-4 bg-white border-2 border-minimal-ink/10 hover:border-minimal-ink rounded-2xl font-mono text-[11px] uppercase tracking-widest font-bold transition-all shadow-sm"
                  >
                    Save Photo Strip
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleDownloadVideo}
                    className="flex justify-between items-center w-full px-6 py-4 bg-white border-2 border-minimal-ink/10 hover:border-minimal-ink rounded-2xl font-mono text-[11px] uppercase tracking-widest font-bold transition-all shadow-sm"
                  >
                    Download Memory MP4
                    <Video className="w-4 h-4" />
                  </button>

                  <div className="pt-8 border-t border-minimal-border mt-4">
                    <p className="font-serif text-sm italic text-center mb-6">"Motion Memory Replay"</p>
                    
                    <div className="relative bg-white p-2 w-full shadow-xl border border-minimal-border">
                       <div className="aspect-video bg-black overflow-hidden rounded-sm relative">
                         <video 
                           src={replayUrl!} 
                           loop 
                           autoPlay 
                           className={`w-full h-full object-cover ${FILTERS[activeFilter].class} opacity-90`} 
                         />
                         <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20 pointer-events-none" />
                         
                         {/* Playback HUD */}
                         <div className="absolute top-2 left-2 flex items-center gap-1 opacity-50">
                           <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                           <span className="font-mono text-[8px] text-white uppercase tracking-widest">Memory Playback</span>
                         </div>
                       </div>
                       
                       <div className="flex justify-between items-center px-1 pt-2">
                        <span className="font-mono text-[8px] font-bold opacity-30 tracking-tighter">REF: {Math.floor(Math.random() * 9000) + 1000}</span>
                        <span className="font-mono text-[8px] font-bold opacity-30 tracking-tighter">{LAYOUT_CONFIGS[layout].name.toUpperCase()}</span>
                       </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Hidden Resources */}
      <canvas ref={canvasRef} className="hidden" />
      <audio ref={musicRef} src={VINTAGE_MUSIC_URL} loop />

      {/* Detail Footer */}
      <footer className="fixed bottom-0 left-0 w-full p-8 flex justify-center pointer-events-none">
        <div className="flex items-center gap-12 opacity-30">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em]">
            <CheckCircle2 size={12} />
            Pure Fiber
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em]">
            <CheckCircle2 size={12} />
            Safe Harbor
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em]">
            <CheckCircle2 size={12} />
            Zero Latency
          </div>
        </div>
      </footer>
    </div>
  );
}
