'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone, PhoneOff, Volume2, Loader2, Mic } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

type CallState = 'idle' | 'starting' | 'listening' | 'processing' | 'speaking'

export default function CallPage() {
  const [callState, setCallState] = useState<CallState>('idle')
  const [transcript, setTranscript] = useState('')
  const [jacobResponse, setJacobResponse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  
  const vadRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const accessTokenRef = useRef<string | null>(null)
  const supabase = createClient()

  const isCallActive = callState !== 'idle'

  // Call duration timer
  useEffect(() => {
    if (isCallActive) {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
      setCallDuration(0)
    }
    
    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [isCallActive])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Process audio and get AI response
  const processAudio = useCallback(async (audioBlob: Blob) => {
    if (!accessTokenRef.current) return
    
    setCallState('processing')
    
    try {
      // Step 1: Transcribe audio with OpenAI Whisper
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')
      
      const transcribeResponse = await fetch(`${BACKEND_URL}/voice/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessTokenRef.current}`,
        },
        body: formData,
      })

      if (!transcribeResponse.ok) {
        const errorText = await transcribeResponse.text()
        throw new Error(`Transcription failed: ${errorText}`)
      }

      const { text: userMessage } = await transcribeResponse.json()
      setTranscript(userMessage)
      
      if (!userMessage.trim()) {
        // Empty transcript, resume listening
        setCallState('listening')
        return
      }

      // Step 2: Get AI response with conversation context
      const chatResponse = await fetch(`${BACKEND_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessTokenRef.current}`,
        },
        body: JSON.stringify({ 
          message: userMessage,
          conversation_id: conversationId 
        }),
      })

      if (!chatResponse.ok) {
        throw new Error('Failed to get AI response')
      }

      // Read the streamed response
      const reader = chatResponse.body?.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              try {
                const parsed = JSON.parse(data)
                if (parsed.token) {
                  fullResponse += parsed.token
                  setJacobResponse(fullResponse)
                }
              } catch {
                if (data && data !== '[DONE]' && !data.startsWith('{')) {
                  fullResponse += data
                  setJacobResponse(fullResponse)
                }
              }
            }
          }
        }
      }

      // Step 3: Convert response to Jacob's voice
      await speakResponse(fullResponse)
      
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setCallState('listening')
    }
  }, [conversationId])

  const speakResponse = async (text: string) => {
    if (!accessTokenRef.current) return
    
    setCallState('speaking')
    
    try {
      const response = await fetch(`${BACKEND_URL}/voice/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessTokenRef.current}`,
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Voice synthesis failed: ${errorText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const audioBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.onended = () => {
          URL.revokeObjectURL(audioUrl)
          setCallState('listening')
          vadRef.current?.start()
        }
        audioRef.current.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          console.error('Audio playback error')
          setCallState('listening')
          vadRef.current?.start()
        }
        await audioRef.current.play()
      }
    } catch (err) {
      console.error('Voice synthesis error:', err)
      setError(err instanceof Error ? err.message : 'Voice synthesis failed')
      setCallState('listening')
      vadRef.current?.start()
    }
  }

  const initializeVAD = useCallback(async () => {
    try {
      // Dynamically import VAD to avoid SSR issues
      const { MicVAD } = await import('@ricky0123/vad-web')
      
      const vad = await MicVAD.new({
        onnxWASMBasePath: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/',
        baseAssetPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/',
        model: 'legacy',
        onSpeechStart: () => {
          console.log('Speech started')
          setAudioLevel(1)
        },
        onSpeechEnd: (audio: Float32Array) => {
          console.log('Speech ended, processing...')
          setAudioLevel(0)
          
          // Convert Float32Array to WAV blob
          const wavBlob = float32ArrayToWav(audio, 16000)
          processAudio(wavBlob)
        },
        onVADMisfire: () => {
          console.log('VAD misfire (too short)')
        },
        positiveSpeechThreshold: 0.8,
        negativeSpeechThreshold: 0.5,
        redemptionMs: 500,
        minSpeechMs: 250,
      })
      
      vadRef.current = vad
      return vad
    } catch (err) {
      console.error('VAD initialization failed:', err)
      throw new Error(`Voice detection failed to initialize. Please try refreshing the page. Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }, [processAudio])

  const startCall = async () => {
    // iOS Safari audio unlock hack
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
      }
    } catch (e) {
      console.warn('Silent audio playback failed', e);
    }

    setCallState('starting')
    setError(null)
    setTranscript('')
    setJacobResponse('')
    
    // Generate conversation ID for this call session
    const callId = crypto.randomUUID()
    setConversationId(callId)
    
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }
      accessTokenRef.current = session.access_token

      // Initialize VAD
      await initializeVAD()
      
      // Get Jacob's greeting
      const chatResponse = await fetch(`${BACKEND_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          message: "The user just started a voice call with you. Give a brief, friendly greeting (2-3 sentences max) and ask how you can help with their training today.",
          conversation_id: callId
        }),
      })

      if (chatResponse.ok) {
        const reader = chatResponse.body?.getReader()
        const decoder = new TextDecoder()
        let greeting = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue
                try {
                  const parsed = JSON.parse(data)
                  if (parsed.token) {
                    greeting += parsed.token
                    setJacobResponse(greeting)
                  }
                } catch {
                  if (data && data !== '[DONE]' && !data.startsWith('{')) {
                    greeting += data
                    setJacobResponse(greeting)
                  }
                }
              }
            }
          }
        }

        // Speak the greeting
        await speakResponse(greeting)
      } else {
        // Start listening directly if greeting fails
        setCallState('listening')
        vadRef.current?.start()
      }
    } catch (err) {
      console.error('Failed to start call:', err)
      setError(err instanceof Error ? err.message : 'Failed to start call')
      setCallState('idle')
    }
  }

  const endCall = () => {
    // Stop VAD
    if (vadRef.current) {
      vadRef.current.pause()
      vadRef.current.destroy()
      vadRef.current = null
    }
    
    // Stop audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    
    setCallState('idle')
    setConversationId(null)
    accessTokenRef.current = null
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vadRef.current) {
        vadRef.current.pause()
        vadRef.current.destroy()
      }
    }
  }, [])

  const getStatusText = () => {
    switch (callState) {
      case 'starting': return 'Connecting...'
      case 'listening': return 'Listening... speak now'
      case 'processing': return 'Processing...'
      case 'speaking': return 'Jacob is speaking...'
      default: return 'Start a call to talk with Jacob'
    }
  }

  const getStatusColor = () => {
    switch (callState) {
      case 'listening': return 'bg-orange-500'
      case 'processing': return 'bg-blue-500'
      case 'speaking': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="relative w-32 h-32 mx-auto mb-4">
            <Image
              src="/jacob-avatar.jpg"
              alt="Jacob Hanif"
              fill
              className={`rounded-full object-cover border-4 transition-all duration-300 ${
                callState === 'speaking' 
                  ? 'border-green-500 scale-105' 
                  : callState === 'listening'
                  ? 'border-orange-500'
                  : callState === 'processing'
                  ? 'border-blue-500'
                  : 'border-gray-600'
              }`}
            />
            {isCallActive && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <Badge className={`${getStatusColor()} animate-pulse`}>
                  {callState === 'listening' ? 'Listening' : 
                   callState === 'speaking' ? 'Speaking' : 
                   callState === 'processing' ? 'Thinking' : 'Connecting'}
                </Badge>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold">Call Jacob</h1>
          <p className="text-muted-foreground">
            {isCallActive 
              ? `Call in progress - ${formatDuration(callDuration)}`
              : 'Have a hands-free voice conversation with your AI coach'
            }
          </p>
        </div>

        {/* Error message */}
        {error && (
          <Card className="mb-6 border-red-500 bg-red-500/10">
            <CardContent className="pt-4">
              <p className="text-red-500 text-center">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mx-auto mt-2 block"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Call Status Card */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            {/* Audio Level Indicator */}
            {callState === 'listening' && (
              <div className="flex items-center justify-center gap-2 py-4">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 rounded-full transition-all duration-100 ${
                        audioLevel > i * 0.2 ? 'bg-orange-500' : 'bg-gray-300'
                      }`}
                      style={{ height: `${12 + i * 4}px` }}
                    />
                  ))}
                </div>
                <Mic className="h-5 w-5 text-orange-500 animate-pulse ml-2" />
                <span className="text-orange-500">Listening... just speak naturally</span>
              </div>
            )}

            {/* Your message */}
            {transcript && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">You said:</p>
                <p>{transcript}</p>
              </div>
            )}
            
            {/* Jacob's Response */}
            {jacobResponse && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <p className="text-sm text-orange-500 mb-1 flex items-center gap-2">
                  {callState === 'speaking' && <Volume2 className="h-4 w-4 animate-pulse" />}
                  Jacob:
                </p>
                <p>{jacobResponse}</p>
              </div>
            )}

            {/* Status indicators */}
            {callState === 'processing' && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Jacob is thinking...</span>
              </div>
            )}

            {callState === 'starting' && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Connecting...</span>
              </div>
            )}

            {!isCallActive && (
              <div className="text-center text-muted-foreground py-4">
                Click &quot;Start Call&quot; to begin talking with Jacob
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call Controls */}
        <div className="flex justify-center gap-4">
          {!isCallActive ? (
            <Button 
              size="lg" 
              onClick={startCall}
              className="bg-green-600 hover:bg-green-700 gap-2 px-8"
            >
              <Phone className="h-5 w-5" />
              Start Call
            </Button>
          ) : (
            <Button 
              size="lg" 
              variant="destructive"
              onClick={endCall}
              className="gap-2 px-8"
            >
              <PhoneOff className="h-5 w-5" />
              End Call
            </Button>
          )}
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} className="hidden" />

        {/* How it works */}
        {!isCallActive && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Click &quot;Start Call&quot; and Jacob will greet you</p>
              <p>2. Just speak naturally - no buttons to press</p>
              <p>3. When you pause, Jacob will respond automatically</p>
              <p>4. Continue the conversation as long as you want</p>
              <p>5. Click &quot;End Call&quot; when done</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// Helper function to convert Float32Array to WAV blob
function float32ArrayToWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  
  // WAV header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, samples.length * 2, true)
  
  // Convert samples
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }
  
  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
