"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Upload, Loader2, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { streamMessage, OuraData } from "@/lib/api";
import { Message } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";

interface ChatInterfaceProps {
  ouraData?: OuraData | null;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  onFirstMessage?: (title: string) => void;
  conversationId?: string;
}

export function ChatInterface({ 
  ouraData, 
  messages, 
  onMessagesChange,
  onFirstMessage,
  conversationId 
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setSelectedImage(base64);
        setImageType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImageType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    // Notify parent if this is the first message (for conversation title)
    if (messages.length === 0 && onFirstMessage) {
      onFirstMessage(input.slice(0, 40) + (input.length > 40 ? "..." : ""));
    }

    const userMessage: Message = {
      role: "user",
      content: input,
      image: selectedImage
        ? `data:${imageType};base64,${selectedImage}`
        : undefined,
    };

    const updatedMessages = [...messages, userMessage];
    onMessagesChange(updatedMessages);
    const messageContent = input;
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      // Get access token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated. Please sign in again.");
      }

      // Stream the response
      let fullContent = "";
      for await (const token of streamMessage(
        messageContent,
        session.access_token,
        conversationId,
        selectedImage || undefined,
        imageType || undefined
      )) {
        fullContent += token;
        setStreamingContent(fullContent);
      }

      // Add the complete assistant message
      onMessagesChange([
        ...updatedMessages,
        { role: "assistant", content: fullContent },
      ]);
      setStreamingContent("");
    } catch (error) {
      onMessagesChange([
        ...updatedMessages,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        },
      ]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
      removeImage();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-full overflow-hidden mb-4 ring-2 ring-orange-500">
              <Image
                src="/jacob.jpg"
                alt="Jacob Hanif"
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-2xl font-bold mb-2">Jacob Hanif AI Coach</h2>
            <p className="text-muted-foreground max-w-md">
              UK National Calisthenics Champion. Ask me about planche progressions, 
              strength training, form analysis, or recovery optimization.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-6 max-w-md">
              {[
                "How do I train for a full planche?",
                "Analyze my form (upload photo)",
                "My planche is stalling, help",
                "Best exercises for back lever",
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  className="text-sm h-auto py-3 px-4 text-left"
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <Avatar className="w-8 h-8 overflow-hidden">
                    <Image
                      src="/jacob.jpg"
                      alt="Jacob"
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </Avatar>
                )}
                <Card
                  className={`max-w-[80%] p-4 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Uploaded"
                      className="rounded-lg mb-2 max-w-xs"
                    />
                  )}
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </Card>
                {message.role === "user" && (
                  <Avatar className="w-8 h-8 bg-blue-600 flex items-center justify-center">
                    <span className="text-xs text-white font-bold">You</span>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8 overflow-hidden">
                  <Image
                    src="/jacob.jpg"
                    alt="Jacob"
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </Avatar>
                <Card className="max-w-[80%] p-4 bg-muted">
                  {streamingContent ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{streamingContent}</ReactMarkdown>
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                    </div>
                  ) : (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  )}
                </Card>
              </div>
            )}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Image Preview */}
      {selectedImage && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img
              src={`data:${imageType};base64,${selectedImage}`}
              alt="Preview"
              className="h-20 rounded-lg border"
            />
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={removeImage}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-background">
        <div className="flex gap-2 items-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about training, form, recovery..."
            className="min-h-[44px] max-h-32 resize-none"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !selectedImage)}
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
