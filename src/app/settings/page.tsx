"use client";

import { useEffect, useState, useCallback } from "react";
import { Settings, Loader2, Key, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TeamConfig {
  llmProvider: string;
  llmModel: string | null;
  llmApiKey: string | null;
  skipLlm: boolean;
  figmaAccessToken: string | null;
  slackWebhookUrl: string | null;
  autoPostSlack: boolean;
  confluenceBaseUrl: string | null;
  confluenceEmail: string | null;
  confluenceToken: string | null;
  confluenceSpaceKey: string | null;
  cronEnabled: boolean;
  notifyNewComments: boolean;
  archiveDays: number;
}

const envKeyMap: Record<string, string> = {
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

const placeholderMap: Record<string, string> = {
  google: "AIza...",
  openai: "sk-...",
  anthropic: "sk-ant-...",
};

export default function SettingsPage() {
  const [config, setConfig] = useState<TeamConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        setConfig(await res.json());
      }
    } catch {
      // DB not connected
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  async function save(updates: Partial<TeamConfig>) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="glass rounded-lg p-5">
          <p className="text-sm text-muted-foreground">
            Settings are available after connecting the database.
          </p>
        </div>
      </div>
    );
  }

  const figmaConnected = !!config.figmaAccessToken;
  const llmConnected = !!config.llmApiKey || config.skipLlm;
  const slackConnected = !!config.slackWebhookUrl;
  const confluenceConnected =
    !!config.confluenceBaseUrl &&
    !!config.confluenceEmail &&
    !!config.confluenceToken &&
    !!config.confluenceSpaceKey;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="size-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure integrations, LLM provider, and preferences.
          </p>
        </div>
        {saving && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="mt-8 space-y-4">
        <SettingsCard
          title="Figma"
          description="Connect to the Figma API to sync comments from your design files."
          status={figmaConnected ? "connected" : "not-configured"}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="figma-token" className="text-xs">Personal Access Token</Label>
              <Input
                id="figma-token"
                type="password"
                placeholder="figd_..."
                defaultValue={config.figmaAccessToken ?? ""}
                className="rounded-lg"
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v && !v.includes("••••")) save({ figmaAccessToken: v });
                  else if (!v) save({ figmaAccessToken: null });
                }}
              />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ExternalLink className="size-3 shrink-0 mt-0.5" />
                <span>
                  Generate a{" "}
                  <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    personal access token
                  </a>
                  {" "}with read access to your design files. Individual projects can override this in their settings.
                </span>
              </p>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="LLM Provider"
          description="Choose your AI provider for comment classification."
          status={llmConnected ? "connected" : "not-configured"}
        >
          <div className={cn("grid gap-3 sm:grid-cols-3 transition-opacity", config.skipLlm && "opacity-40 pointer-events-none")}>
            {(["google", "openai", "anthropic"] as const).map((p) => (
              <button
                key={p}
                className={cn(
                  "glass rounded-lg px-4 py-3 text-sm font-medium text-left transition-all",
                  config.llmProvider === p ? "ring-2 ring-primary bg-primary/5" : "glass-hover"
                )}
                onClick={() => save({ llmProvider: p })}
                disabled={config.skipLlm}
                aria-pressed={config.llmProvider === p}
              >
                {p === "google" ? "Google Gemini" : p === "openai" ? "OpenAI GPT" : "Anthropic Claude"}
              </button>
            ))}
          </div>

          {!config.skipLlm && (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="llm-key" className="text-xs">API Key</Label>
              <Input
                id="llm-key"
                type="password"
                placeholder={placeholderMap[config.llmProvider] ?? "API key"}
                defaultValue={config.llmApiKey ?? ""}
                className="rounded-lg"
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v && !v.includes("••••")) save({ llmApiKey: v });
                  else if (!v) save({ llmApiKey: null });
                }}
              />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Key className="size-3 shrink-0 mt-0.5" />
                <span>
                  Enter your API key above, or set <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{envKeyMap[config.llmProvider]}</code> as an environment variable as a fallback.
                </span>
              </p>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <Switch
              checked={config.skipLlm}
              onCheckedChange={(checked) => save({ skipLlm: checked })}
              id="skip-llm"
            />
            <Label htmlFor="skip-llm" className="text-sm">
              Skip LLM (manual classification only)
            </Label>
          </div>

          {config.skipLlm && (
            <p className="mt-2 text-xs text-muted-foreground">
              Comments will be grouped but not auto-classified by priority or category.
            </p>
          )}
        </SettingsCard>

        <SettingsCard
          title="Slack"
          description="Auto-notify your team about new comments."
          status={slackConnected ? "connected" : "not-configured"}
        >
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="slack-url" className="text-xs">Webhook URL</Label>
              <Input
                id="slack-url"
                placeholder="https://hooks.slack.com/services/..."
                defaultValue={config.slackWebhookUrl ?? ""}
                className="rounded-lg"
                onBlur={(e) => {
                  const v = e.target.value;
                  if (v && !v.includes("••••")) save({ slackWebhookUrl: v });
                  else if (!v) save({ slackWebhookUrl: null });
                }}
              />
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ExternalLink className="size-3 shrink-0 mt-0.5" />
                <span>
                  Create an{" "}
                  <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                    Incoming Webhook
                  </a>
                  , pick a channel, and paste the URL here.
                </span>
              </p>
            </div>
            <div className={cn("flex items-center gap-3 transition-opacity", !slackConnected && "opacity-40")}>
              <Switch
                checked={config.autoPostSlack}
                onCheckedChange={(checked) => save({ autoPostSlack: checked })}
                id="auto-slack"
                disabled={!slackConnected}
              />
              <Label htmlFor="auto-slack" className="text-sm">
                Auto-post when new comments detected
              </Label>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Confluence"
          description="Push digest reports to Confluence."
          status={confluenceConnected ? "connected" : "not-configured"}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="conf-url" className="text-xs">Confluence URL</Label>
                <Input id="conf-url" placeholder="https://team.atlassian.net/wiki" defaultValue={config.confluenceBaseUrl ?? ""} className="rounded-lg" onBlur={(e) => save({ confluenceBaseUrl: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf-space" className="text-xs">Space Key</Label>
                <Input id="conf-space" placeholder="DESIGN" defaultValue={config.confluenceSpaceKey ?? ""} className="rounded-lg" onBlur={(e) => save({ confluenceSpaceKey: e.target.value || null })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="conf-email" className="text-xs">Email</Label>
                <Input id="conf-email" type="email" placeholder="you@company.com" defaultValue={config.confluenceEmail ?? ""} className="rounded-lg" onBlur={(e) => save({ confluenceEmail: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conf-token" className="text-xs">API Token</Label>
                <Input
                  id="conf-token"
                  type="password"
                  placeholder="Confluence API token"
                  defaultValue={config.confluenceToken ?? ""}
                  className="rounded-lg"
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v && !v.includes("••••")) save({ confluenceToken: v });
                    else if (!v) save({ confluenceToken: null });
                  }}
                />
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <ExternalLink className="size-3 shrink-0 mt-0.5" />
              <span>
                Generate an{" "}
                <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
                  API token
                </a>
                {" "}and use it with your Atlassian email.
              </span>
            </p>
          </div>
        </SettingsCard>

        <SettingsCard title="Notifications" description="Control automated alerts.">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={config.cronEnabled} onCheckedChange={(checked) => save({ cronEnabled: checked })} id="cron" />
              <Label htmlFor="cron" className="text-sm">Auto-check for new comments (every 60 min)</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={config.notifyNewComments} onCheckedChange={(checked) => save({ notifyNewComments: checked })} id="notify-comments" />
              <Label htmlFor="notify-comments" className="text-sm">Push notifications for new comments</Label>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Data Retention" description="Configure automatic cleanup.">
          <div className="space-y-1.5">
            <Label htmlFor="retention" className="text-xs">Archive after (days)</Label>
            <Input id="retention" type="number" min={7} max={365} defaultValue={config.archiveDays} className="rounded-lg w-32" onBlur={(e) => save({ archiveDays: parseInt(e.target.value) || 90 })} />
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}

function SettingsCard({ title, description, status, children }: { title: string; description: string; status?: "connected" | "not-configured"; children: React.ReactNode }) {
  return (
    <div className="glass rounded-lg p-5 hover-lift">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {status && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 mt-0.5">
            <span className={cn("size-1.5 rounded-full", status === "connected" ? "bg-green-500" : "bg-muted-foreground/40")} />
            {status === "connected" ? "Connected" : "Not configured"}
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
