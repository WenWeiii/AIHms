import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useFirebase } from '../FirebaseProvider';
import { useSocket } from '../SocketProvider';
import { UserProfile, CallStatus, CallType, CallData } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../LanguageProvider';

interface CallContextType {
  initiateCall: (recipient: UserProfile, type: CallType) => void;
  answerCall: () => void;
  endCall: () => void;
  callStatus: CallStatus;
  incomingCall: CallData | null;
  activeCallRecipient: UserProfile | null;
  callType: CallType | null;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useFirebase();
  const { socket } = useSocket();
  const { t } = useTranslation();
  
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [activeCallRecipient, setActiveCallRecipient] = useState<UserProfile | null>(null);
  const [callType, setCallType] = useState<CallType | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('incoming-call', (data: CallData) => {
      console.log('[Call] Incoming call:', data);
      setIncomingCall(data);
      setCallType(data.type);
    });

    socket.on('call-accepted', async (signal: any) => {
      console.log('[Call] Call accepted, signal received');
      if (peerConnection.current) {
        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(signal));
        setCallStatus('connected');
      }
    });

    socket.on('ice-candidate', async (candidate: any) => {
      console.log('[Call] Remote ICE candidate received');
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("[Call] Error adding ice candidate", e);
        }
      } else if (peerConnection.current) {
        // Queue candidates if remote description is not set yet
        console.log('[Call] Queuing ICE candidate');
      }
    });

    socket.on('call-ended', () => {
      cleanupCall();
    });

    return () => {
      socket.off('incoming-call');
      socket.off('call-accepted');
      socket.off('ice-candidate');
      socket.off('call-ended');
    };
  }, [socket]);

  const cleanupCall = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setIncomingCall(null);
    setActiveCallRecipient(null);
    setCallType(null);
  };

  const createPeerConnection = (targetUserId: string) => {
    console.log('[Call] Creating Peer Connection for:', targetUserId);
    const pc = new RTCPeerConnection(ICE_SERVERS);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        console.log('[Call] Sending local ICE candidate');
        socket.emit('ice-candidate', {
          to: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[Call] Received remote track');
      setRemoteStream(event.streams[0]);
    };

    peerConnection.current = pc;
    return pc;
  };

  const initiateCall = async (recipient: UserProfile, type: CallType) => {
    console.log('[Call] Initiating call to:', recipient.uid, 'type:', type);
    if (!socket || !user) {
      console.error('[Call] Socket or User missing', { socket: !!socket, user: !!user });
      return;
    }

    try {
      console.log('[Call] Requesting media stream...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video',
        audio: true,
      });
      console.log('[Call] Media stream acquired');
      setLocalStream(stream);
      setActiveCallRecipient(recipient);
      setCallStatus('calling');
      setCallType(type);

      const pc = createPeerConnection(recipient.uid);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call-user', {
        userToCall: recipient.uid,
        signalData: offer,
        from: user.uid,
        name: profile?.displayName || user.email,
        type,
      });
    } catch (err) {
      console.error("Could not get media stream", err);
      alert("Please ensure you have granted camera and microphone permissions.");
    }
  };

  const answerCall = async () => {
    console.log('[Call] Answering call from:', incomingCall?.from);
    if (!incomingCall || !socket || !user) {
      console.error('[Call] Call data, socket or user missing');
      return;
    }

    try {
      console.log('[Call] Requesting media stream for answer...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.type === 'video',
        audio: true,
      });
      console.log('[Call] Media stream acquired for answer');

      setLocalStream(stream);
      setCallStatus('connected');

      const pc = createPeerConnection(incomingCall.from);
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('answer-call', {
        signal: answer,
        to: incomingCall.from,
      });

      setIncomingCall(null);
    } catch (err) {
      console.error("Could not answer call", err);
      cleanupCall();
    }
  };

  const endCall = () => {
    if (socket) {
      const targetId = activeCallRecipient?.uid || incomingCall?.from;
      if (targetId) {
        socket.emit('end-call', { to: targetId });
      }
    }
    cleanupCall();
  };

  // Sync streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <CallContext.Provider value={{
      initiateCall,
      answerCall,
      endCall,
      callStatus,
      incomingCall,
      activeCallRecipient,
      callType
    }}>
      {children}
      
      {/* Global Call UI */}
      <AnimatePresence>
        {incomingCall && callStatus === 'idle' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl space-y-8"
            >
              <div className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-primary relative">
                <User size={48} />
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-primary/20 rounded-[2.5rem]"
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-headline font-black uppercase tracking-[0.2em] text-outline">Incoming {incomingCall.type} call</p>
                <h3 className="text-3xl font-headline font-black text-primary truncate">{incomingCall.name}</h3>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={endCall}
                  className="flex-1 py-4 bg-error text-on-error rounded-2xl font-headline font-black flex items-center justify-center gap-2 hover:bg-error/90 transition-all"
                >
                  <PhoneOff size={20} />
                  Decline
                </button>
                <button 
                  onClick={answerCall}
                  className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-headline font-black flex items-center justify-center gap-2 hover:bg-primary/90 transition-all"
                >
                  <Phone size={20} />
                  Answer
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {(callStatus === 'calling' || callStatus === 'connected') && (
          <div className="fixed inset-0 z-[1000] bg-on-surface flex flex-col items-center justify-center p-6 text-white overflow-hidden">
            {/* Background Decor */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="absolute -top-[20%] -right-[20%] w-[80vw] h-[80vw] bg-primary/20 rounded-full blur-[100px]" />
              <div className="absolute -bottom-[20%] -left-[20%] w-[80vw] h-[80vw] bg-secondary/20 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-4xl h-full flex flex-col gap-8">
              {/* Remote View */}
              <div className="flex-1 bg-surface-container-low rounded-[3rem] overflow-hidden relative shadow-2xl border border-white/5">
                {callType === 'video' ? (
                  <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-signature-gradient">
                     <div className="w-48 h-48 bg-white/10 rounded-full flex items-center justify-center text-white backdrop-blur-xl relative">
                        <User size={80} />
                        {callStatus === 'connected' && (
                          <motion.div 
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="absolute inset-0 bg-white/20 rounded-full"
                          />
                        )}
                     </div>
                     <p className="mt-8 text-4xl font-headline font-black tracking-tighter">
                        {activeCallRecipient?.displayName || incomingCall?.name || 'User'}
                     </p>
                     <p className="mt-2 text-outline-on-surface opacity-60 uppercase tracking-widest text-xs font-headline font-black">
                        {callStatus === 'calling' ? 'Calling...' : 'In-call'}
                     </p>
                  </div>
                )}

                {/* Local View */}
                {callType === 'video' && (
                  <div className="absolute top-8 right-8 w-40 h-56 bg-surface-container-low rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 z-20">
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      muted 
                      playsInline 
                      className="w-full h-full object-cover mirror"
                    />
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-6 pb-8">
                <button className="w-20 h-20 rounded-[2.5rem] bg-white/10 backdrop-blur-xl text-white flex items-center justify-center hover:bg-white/20 transition-all border border-white/10">
                  <Mic size={32} />
                </button>
                <button 
                  onClick={endCall}
                  className="w-24 h-24 rounded-[3rem] bg-error text-on-error flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"
                >
                  <PhoneOff size={40} />
                </button>
                {callType === 'video' && (
                  <button className="w-20 h-20 rounded-[2.5rem] bg-white/10 backdrop-blur-xl text-white flex items-center justify-center hover:bg-white/20 transition-all border border-white/10">
                    <Video size={32} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
