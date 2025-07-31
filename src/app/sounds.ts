let audioContext: AudioContext | null = null;

export const playDingSound = () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Create oscillators for the iPhone message sound
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Configure oscillators
    osc1.type = 'sine';
    osc2.type = 'triangle';
    
    // iPhone message frequencies
    osc1.frequency.setValueAtTime(1020, audioContext.currentTime);
    osc1.frequency.setValueAtTime(1220, audioContext.currentTime + 0.1);
    
    osc2.frequency.setValueAtTime(1020, audioContext.currentTime);
    osc2.frequency.setValueAtTime(1220, audioContext.currentTime + 0.1);

    // Configure gain (volume envelope)
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.005);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

    // Connect nodes
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Play sound
    osc1.start(audioContext.currentTime);
    osc2.start(audioContext.currentTime);
    osc1.stop(audioContext.currentTime + 0.3);
    osc2.stop(audioContext.currentTime + 0.3);

  } catch (error) {
    console.error('Error playing sound:', error);
  }
}; 