'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

// Extend Window interface for speech recognition
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

export default function CallPage() {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [jacobResponse, setJacobResponse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-US'
        
        recognition.onresult = (event) => {
          const current = event.resultIndex
          const result = event.results[current]
          const transcriptText = result[0].transcript
          setTranscript(transcriptText)
          
          if (result.isFinal) {
            handleUserMessage(transcriptText)
          }
        }
        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
          if (event.error === 'not-allowed') {
            setError('Microphone access denied. Please allow microphone access.')
          }
        }
        
        recognition.onend = () => {
          setIsListening(false)
          // Auto-restart if call is still active and not processing
          if (isCallActive && !isProcessing && !isSpeaking) {
            setTimeout(() => {
              if (isCallActive) startListening()
            }, 500)
          }
        }
        
        recognitionRef.current = recognition
      } else {
        setError('Speech recognition not supported in this browser. Try Chrome.')
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [isCallActive, isProcessing, isSpeaking])

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

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isSpeaking) {
      try {
        recognitionRef.current.start()
        setIsListening(true)
        setTranscript('')
      } catch (e) {
        console.error('Failed to start recognition:', e)
      }
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return
    
    setIsProcessing(true)
    stopListening()
    
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Send to chat API (non-streaming for simplicity)
      const chatResponse = await fetch(`${BACKEND_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message }),
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
                }
              } catch {
                // Not JSON, might be raw token
                if (data && data !== '[DONE]') {
                  fullResponse += data
                }
              }
            }
          }
        }
      }

      setJacobResponse(fullResponse)
      
      // Convert to speech with ElevenLabs
      await speakResponse(fullResponse, session.access_token)
      
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsProcessing(false)
    }
  }

  const speakResponse = async (text: string, accessToken: string) => {
    setIsSpeaking(true)
    
    try {
      const response = await fetch(`${BACKEND_URL}/voice/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('Failed to synthesize voice')
      }

      // Play audio
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
          // Resume listening after Jacob finishes speaking
          if (isCallActive) {
            setTimeout(startListening, 300)
          }
        }
        await audioRef.current.play()
      }
    } catch (err) {
      console.error('Voice synthesis error:', err)
      setIsSpeaking(false)
      // Still try to continue the call
      if (isCallActive) {
        setTimeout(startListening, 500)
      }
    }
  }

  const startCall = () => {
    setIsCallActive(true)
    setError(null)
    setTranscript('')
    setJacobResponse('')
    
    // Start with Jacob greeting
    handleUserMessage("Hey Jacob, I just started a call with you!")
  }

  const endCall = () => {
    setIsCallActive(false)
    stopListening()
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsSpeaking(false)
    setIsProcessing(false)
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
              className={`rounded-full object-cover border-4 ${
                isCallActive 
                  ? isSpeaking 
                    ? 'border-green-500 animate-pulse' 
                    : isListening
                    ? 'border-orange-500'
                    : 'border-blue-500'
                  : 'border-gray-600'
              }`}
            />
            {isCallActive && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                <Badge className={
                  isSpeaking 
                    ? 'bg-green-500' 
                    : isListening 
                    ? 'bg-orange-500 animate-pulse' 
                    : 'bg-blue-500'
                }>
                  {isSpeaking ? 'Speaking' : isListening ? 'Listening' : isProcessing ? 'Thinking' : 'Connected'}
                </Badge>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold">Call Jacob</h1>
          <p className="text-muted-foreground">
            {isCallActive 
              ? `Call in progress - ${formatDuration(callDuration)}`
              : 'Have a real-time voice conversation with your AI coach'
            }
          </p>
        </div>

        {/* Error message */}
        {error && (
          <Card className="mb-6 border-red-500 bg-red-500/10">
            <CardContent className="pt-4">
              <p className="text-red-500 text-center">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Call Status Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            {/* Transcript */}
            {transcript && (
              <div className="mb-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">You said:</p>
                <p>{transcript}</p>
              </div>
            )}
            
            {/* Jacob's Response */}
            {jacobResponse && (
              <div className="mb-4 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <p className="text-sm text-orange-500 mb-1 flex items-center gap-2">
                  {isSpeaking && <Volume2 className="h-4 w-4 animate-pulse" />}
                  Jacob:
                </p>
                <p>{jacobResponse}</p>
              </div>
            )}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Jacob is thinking...</span>
              </div>
            )}

            {/* Listening indicator */}
            {isListening && !isProcessing && (
              <div className="flex items-center justify-center gap-2 text-orange-500">
                <Mic className="h-4 w-4 animate-pulse" />
                <span>Listening... speak now</span>
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
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <Phone className="h-5 w-5" />
              Start Call
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                variant="outline"
                onClick={isListening ? stopListening : startListening}
                disabled={isSpeaking || isProcessing}
              >
                {isListening ? (
                  <>
                    <MicOff className="h-5 w-5 mr-2" />
                    Mute
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Unmute
                  </>
                )}
              </Button>
              
              <Button 
                size="lg" 
                variant="destructive"
                onClick={endCall}
                className="gap-2"
              >
                <PhoneOff className="h-5 w-5" />
                End Call
              </Button>
            </>
          )}
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} className="hidden" />

        {/* Tips */}
        {!isCallActive && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-lg">Tips for your call</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Speak clearly and wait for Jacob to finish before responding</p>
              <p>• Ask about exercises, form tips, recovery, or workout plans</p>
              <p>• Works best in Chrome browser</p>
              <p>• Make sure your microphone is allowed</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
