'use client'

import { useState, useEffect } from 'react'
import { ChatInterface } from '@/components/chat-interface'
import { Message, Conversation, loadConversations, saveConversations, createConversation } from '@/lib/conversations'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquare, Trash2 } from 'lucide-react'

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvoId, setCurrentConvoId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  // Load conversations from localStorage on mount
  useEffect(() => {
    const loaded = loadConversations()
    setConversations(loaded)
    // Select the most recent conversation if one exists
    if (loaded.length > 0) {
      setCurrentConvoId(loaded[0].id)
      setMessages(loaded[0].messages)
    }
  }, [])

  // Save conversations when they change
  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations)
    }
  }, [conversations])

  const handleMessagesChange = (newMessages: Message[]) => {
    setMessages(newMessages)
    
    // If no current conversation, create one
    if (!currentConvoId && newMessages.length > 0) {
      const title = newMessages[0]?.content?.slice(0, 30) + '...' || 'New Chat'
      const newConvo = createConversation(title)
      newConvo.messages = newMessages
      setConversations(prev => [newConvo, ...prev])
      setCurrentConvoId(newConvo.id)
    } else if (currentConvoId) {
      // Update existing conversation
      setConversations(prev => 
        prev.map(c => 
          c.id === currentConvoId 
            ? { ...c, messages: newMessages, updatedAt: new Date().toISOString() }
            : c
        )
      )
    }
  }

  const handleFirstMessage = (title: string) => {
    if (currentConvoId) {
      setConversations(prev =>
        prev.map(c =>
          c.id === currentConvoId ? { ...c, title } : c
        )
      )
    }
  }

  const handleNewChat = () => {
    const newConvo = createConversation('New Chat')
    setConversations(prev => [newConvo, ...prev])
    setCurrentConvoId(newConvo.id)
    setMessages([])
  }

  const handleSelectChat = (id: string) => {
    const convo = conversations.find(c => c.id === id)
    if (convo) {
      setCurrentConvoId(id)
      setMessages(convo.messages)
    }
  }

  const handleDeleteChat = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id))
    if (currentConvoId === id) {
      const remaining = conversations.filter(c => c.id !== id)
      if (remaining.length > 0) {
        setCurrentConvoId(remaining[0].id)
        setMessages(remaining[0].messages)
      } else {
        setCurrentConvoId(null)
        setMessages([])
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-0px)]">
      {/* Chat History Sidebar */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="p-3 border-b">
          <Button onClick={handleNewChat} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {conversations.map((convo) => (
                <div
                  key={convo.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted ${
                    currentConvoId === convo.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => handleSelectChat(convo.id)}
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">
                    {convo.title || 'New Chat'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteChat(convo.id)
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1">
        <ChatInterface
          messages={messages}
          onMessagesChange={handleMessagesChange}
          onFirstMessage={handleFirstMessage}
          conversationId={currentConvoId || undefined}
        />
      </div>
    </div>
  )
}
