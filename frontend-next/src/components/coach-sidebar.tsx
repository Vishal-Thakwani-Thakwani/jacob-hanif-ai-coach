"use client";

import { useState } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Moon,
  Heart,
  Footprints,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { Conversation } from "@/lib/conversations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  syncOura,
  syncOuraHistory,
  OuraData,
} from "@/lib/api";

interface CoachSidebarProps {
  ouraData: OuraData | null;
  setOuraData: (data: OuraData | null) => void;
  conversations: Conversation[];
  currentConvoId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

export function CoachSidebar({ 
  ouraData, 
  setOuraData,
  conversations,
  currentConvoId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
}: CoachSidebarProps) {
  const [ouraToken, setOuraToken] = useState("");
  const [ouraHistory, setOuraHistory] = useState<Record<string, unknown> | null>(null);
  const [isOuraSyncing, setIsOuraSyncing] = useState(false);

  const handleOuraSync = async () => {
    if (!ouraToken) return;
    setIsOuraSyncing(true);
    try {
      const [todayData, historyData] = await Promise.all([
        syncOura(ouraToken),
        syncOuraHistory(ouraToken),
      ]);
      setOuraData(todayData);
      setOuraHistory(historyData);
    } catch (error) {
      console.error("Oura sync failed:", error);
    } finally {
      setIsOuraSyncing(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "progressing":
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "regressing":
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <Sidebar className="border-r">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-orange-500">
            <Image
              src="/jacob.jpg"
              alt="Jacob Hanif"
              width={40}
              height={40}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="font-bold">Jacob Hanif</h2>
            <p className="text-xs text-muted-foreground">AI Coach</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Chat History */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chats
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onNewChat}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  No conversations yet
                </p>
              ) : (
                conversations.map((convo) => (
                  <div
                    key={convo.id}
                    className={`group flex items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent ${
                      currentConvoId === convo.id ? "bg-accent" : ""
                    }`}
                    onClick={() => onSelectChat(convo.id)}
                  >
                    <span className="truncate flex-1 text-xs">
                      {convo.title || "New Chat"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(convo.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        {/* Oura Integration */}
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Oura Ring
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Oura Access Token"
                value={ouraToken}
                onChange={(e) => setOuraToken(e.target.value)}
                className="text-sm"
              />
              <Button
                onClick={handleOuraSync}
                disabled={!ouraToken || isOuraSyncing}
                className="w-full"
                size="sm"
              >
                {isOuraSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Sync Data
              </Button>
            </div>

            {ouraData && (
              <Card className="mt-3">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm">Today</CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs flex items-center gap-1">
                      <Heart className="h-3 w-3" /> Readiness
                    </span>
                    <Badge variant="outline">{ouraData.readiness_score || "-"}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs flex items-center gap-1">
                      <Moon className="h-3 w-3" /> Sleep
                    </span>
                    <Badge variant="outline">{ouraData.sleep_score || "-"}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs flex items-center gap-1">
                      <Activity className="h-3 w-3" /> Activity
                    </span>
                    <Badge variant="outline">{ouraData.activity_score || "-"}</Badge>
                  </div>
                  {ouraData.steps && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs flex items-center gap-1">
                        <Footprints className="h-3 w-3" /> Steps
                      </span>
                      <Badge variant="outline">{ouraData.steps.toLocaleString()}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {ouraHistory && (
              <Card className="mt-2">
                <CardHeader className="py-2 px-3">
                  <CardTitle className="text-sm">7-Day Avg</CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-3 text-xs space-y-1">
                  {(ouraHistory as { averages?: Record<string, unknown> }).averages && (
                    <>
                      <div className="flex justify-between">
                        <span>Readiness</span>
                        <span>{String((ouraHistory as { averages: Record<string, unknown> }).averages.readiness_avg_7d ?? "-")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Sleep</span>
                        <span>{String((ouraHistory as { averages: Record<string, unknown> }).averages.sleep_avg_7d ?? "-")}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>HRV Trend</span>
                        <span className="flex items-center gap-1">
                          {getTrendIcon(String((ouraHistory as { averages: Record<string, unknown> }).averages.hrv_trend || "stable"))}
                          {String((ouraHistory as { averages: Record<string, unknown> }).averages.hrv_trend || "stable")}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

      </SidebarContent>
    </Sidebar>
  );
}
