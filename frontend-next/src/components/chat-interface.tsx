"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Upload, Loader2, X, Crown, Lock, Camera } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { streamMessage, OuraData } from "@/lib/api";
import { Message } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";

interface UsageInfo {
  used: number;
  limit: number | "unlimited";
  remaining: number | "unlimited";
  is_pro: boolean;
}

interface ChatInterfaceProps {
  ouraData?: OuraData | null;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
  onFirstMessage?: (title: string) => void;
  conversationId?: string;
  isPro?: boolean;
  initialUsage?: { used: number; limit: number };
}

export function ChatInterface({ 
  ouraData, 
  messages, 
  onMessagesChange,
  onFirstMessage,
  conversationId,
  isPro = false,
  initialUsage = { used: 0, limit: 5 }
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo>({
    used: initialUsage.used,
    limit: isPro ? "unlimited" : initialUsage.limit,
    remaining: isPro ? "unlimited" : initialUsage.limit - initialUsage.used,
    is_pro: isPro
  });
  const [limitReached, setLimitReached] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Update usage state when isPro prop changes
  useEffect(() => {
    setUsage(prev => ({
      ...prev,
      limit: isPro ? "unlimited" : initialUsage.limit,
      remaining: isPro ? "unlimited" : initialUsage.limit - prev.used,
      is_pro: isPro
    }));
    if (isPro) {
      setLimitReached(false);
    }
  }, [isPro, initialUsage.limit]);

  // Auto-scroll to bottom when messages change or streaming content updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Handle paste events for images (Command+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file && usage.is_pro) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1];
            setSelectedImage(base64);
            setImageType(file.type);
          };
          reader.readAsDataURL(file);
        } else if (!usage.is_pro) {
          // Show message that image upload is Pro only
          alert("Image upload is a Pro feature. Upgrade to analyze your form!");
        }
        break;
      }
    }
  };

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
    
    // Check if limit reached for free users
    if (!usage.is_pro && typeof usage.remaining === "number" && usage.remaining <= 0) {
      setLimitReached(true);
      return;
    }

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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("Session:", session ? "found" : "missing", "Error:", sessionError);
      
      if (!session?.access_token) {
        throw new Error("Not authenticated. Please sign in again.");
      }
      
      console.log("Sending message to backend...");
      console.log("Backend URL:", process.env.NEXT_PUBLIC_BACKEND_URL);

      // Stream the response
      let fullContent = "";
      for await (const token of streamMessage(
        messageContent,
        session.access_token,
        conversationId,
        selectedImage || undefined,
        imageType || undefined
      )) {
        // Check if this is a usage update (JSON with usage field)
        if (token.startsWith('{"done":true')) {
          try {
            const data = JSON.parse(token);
            if (data.usage) {
              setUsage(data.usage);
              if (!data.usage.is_pro && data.usage.remaining <= 0) {
                setLimitReached(true);
              }
            }
          } catch {
            // Not JSON, just a token
            fullContent += token;
            setStreamingContent(fullContent);
          }
        } else {
          fullContent += token;
          setStreamingContent(fullContent);
        }
      }

      // Add the complete assistant message
      onMessagesChange([
        ...updatedMessages,
        { role: "assistant", content: fullContent },
      ]);
      setStreamingContent("");
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to get response";
      
      // Check if it's a rate limit error (429)
      if (errorMessage.includes("429") || errorMessage.includes("limit")) {
        setLimitReached(true);
        onMessagesChange([
          ...updatedMessages,
          {
            role: "assistant",
            content: "You've reached your daily message limit. Upgrade to Pro for unlimited coaching!",
          },
        ]);
      } else if (errorMessage.includes("403") || errorMessage.includes("Pro feature")) {
        onMessagesChange([
          ...updatedMessages,
          {
            role: "assistant",
            content: "This feature requires a Pro subscription. Upgrade to unlock image analysis, Oura integration, and more!",
          },
        ]);
      } else {
        onMessagesChange([
          ...updatedMessages,
          {
            role: "assistant",
            content: `Error: ${errorMessage}`,
          },
        ]);
      }
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

      {/* Limit Reached Banner */}
      {limitReached && !usage.is_pro && (
        <div className="px-4 py-3 bg-gradient-to-r from-orange-500/10 to-red-600/10 border-t border-orange-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-orange-500" />
              <span className="text-sm font-medium">
                You&apos;ve used all {usage.limit} free messages today
              </span>
            </div>
            <Link href="/pricing">
              <Button size="sm" className="bg-gradient-to-r from-orange-500 to-red-600">
                Upgrade to Pro
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t bg-background">
        {/* Usage Counter for Free Users */}
        {!usage.is_pro && typeof usage.remaining === "number" && (
          <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
            <span>
              {usage.used}/{usage.limit} messages used today
            </span>
            {usage.remaining <= 2 && usage.remaining > 0 && (
              <Badge variant="outline" className="text-orange-500 border-orange-500">
                {usage.remaining} left
              </Badge>
            )}
          </div>
        )}
        
        <div className="flex gap-2 items-end">
          {/* Hidden file input - accepts camera on mobile */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          
          {/* Image Upload Button - Pro Only */}
          {usage.is_pro ? (
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Upload image, take photo, or paste (Cmd+V)"
            >
              <Camera className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              disabled
              title="Image upload is a Pro feature"
              className="opacity-50 cursor-not-allowed"
            >
              <div className="relative">
                <Camera className="h-4 w-4" />
                <Lock className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-orange-500" />
              </div>
            </Button>
          )}
          
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={limitReached && !usage.is_pro 
              ? "Upgrade to Pro for unlimited messages..." 
              : "Ask about training, form, recovery..."}
            className="min-h-[44px] max-h-32 resize-none"
            disabled={isLoading || (limitReached && !usage.is_pro)}
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !selectedImage) || (limitReached && !usage.is_pro)}
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
