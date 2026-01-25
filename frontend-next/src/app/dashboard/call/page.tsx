'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export default function CallPage() {
  const [isCallActive, setIsCallActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [jacobResponse, setJacobResponse] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const callTimerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await processAudio(audioBlob)
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setTranscript('')
      
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Microphone access denied. Please allow microphone access.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)
    
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      // Step 1: Transcribe audio with OpenAI Whisper
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      
      const transcribeResponse = await fetch(`${BACKEND_URL}/voice/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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
        setIsProcessing(false)
        // Resume recording if call is still active
        if (isCallActive) {
          setTimeout(startRecording, 500)
        }
        return
      }

      // Step 2: Get AI response
      const chatResponse = await fetch(`${BACKEND_URL}/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: userMessage }),
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
      await speakResponse(fullResponse, session.access_token)
      
    } catch (err) {
      console.error('Error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsProcessing(false)
      // Try to continue the call
      if (isCallActive) {
        setTimeout(startRecording, 1000)
      }
    }
  }

  const speakResponse = async (text: string, accessToken: string) => {
    setIsSpeaking(true)
    setIsProcessing(false)
    
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
        const errorText = await response.text()
        throw new Error(`Voice synthesis failed: ${errorText}`)
      }

      // Play audio
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
          // Resume recording after Jacob finishes speaking
          if (isCallActive) {
            setTimeout(startRecording, 300)
          }
        }
        await audioRef.current.play()
      }
    } catch (err) {
      console.error('Voice synthesis error:', err)
      setError(err instanceof Error ? err.message : 'Voice synthesis failed')
      setIsSpeaking(false)
      // Still try to continue the call
      if (isCallActive) {
        setTimeout(startRecording, 500)
      }
    }
  }

  const startCall = async () => {
    setIsCallActive(true)
    setError(null)
    setTranscript('')
    setJacobResponse('')
    
    // Start with a greeting from Jacob
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        // Get Jacob's greeting
        setIsProcessing(true)
        const chatResponse = await fetch(`${BACKEND_URL}/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            message: "The user just started a voice call with you. Give a brief, friendly greeting (2-3 sentences max) and ask how you can help with their training today." 
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
          await speakResponse(greeting, session.access_token)
        }
      }
    } catch (err) {
      console.error('Failed to get greeting:', err)
      // Start recording anyway
      startRecording()
    }
  }

  const endCall = () => {
    setIsCallActive(false)
    stopRecording()
    if (audioRef.current) {
      audioRef.current.pause()
    }
    setIsSpeaking(false)
    setIsProcessing(false)
  }

  const toggleMute = () => {
    if (isRecording) {
      stopRecording()
    } else if (!isSpeaking && !isProcessing) {
      startRecording()
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
              className={`rounded-full object-cover border-4 ${
                isCallActive 
                  ? isSpeaking 
                    ? 'border-green-500 animate-pulse' 
                    : isRecording
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
                    : isRecording 
                    ? 'bg-orange-500 animate-pulse' 
                    : isProcessing
                    ? 'bg-blue-500'
                    : 'bg-gray-500'
                }>
                  {isSpeaking ? 'Speaking' : isRecording ? 'Listening' : isProcessing ? 'Thinking' : 'Ready'}
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
                  {isSpeaking && <Volume2 className="h-4 w-4 animate-pulse" />}
                  Jacob:
                </p>
                <p>{jacobResponse}</p>
              </div>
            )}

            {/* Status indicators */}
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Jacob is thinking...</span>
              </div>
            )}

            {isRecording && !isProcessing && (
              <div className="flex items-center justify-center gap-2 text-orange-500 py-4">
                <div className="relative">
                  <Mic className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <span>Recording... speak now</span>
              </div>
            )}

            {!isCallActive && (
              <div className="text-center text-muted-foreground py-4">
                Click "Start Call" to begin talking with Jacob
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
            <>
              <Button
                size="lg"
                variant={isRecording ? "default" : "outline"}
                onClick={toggleMute}
                disabled={isSpeaking || isProcessing}
                className={isRecording ? "bg-orange-500 hover:bg-orange-600" : ""}
              >
                {isRecording ? (
                  <>
                    <MicOff className="h-5 w-5 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
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
              <CardTitle className="text-lg">How it works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>1. Click "Start Call" - Jacob will greet you</p>
              <p>2. Click "Start Recording" and speak your question</p>
              <p>3. Click "Stop Recording" when done speaking</p>
              <p>4. Wait for Jacob to respond in his voice</p>
              <p>5. Repeat until you're done, then "End Call"</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
