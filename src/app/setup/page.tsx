"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Check,
  ArrowRight,
  PenTool,
  Brain,
  Hash,
  BookOpen,
  Bell,
  FolderPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const steps = [
  { icon: PenTool, label: "Figma" },
  { icon: Brain, label: "LLM" },
  { icon: Hash, label: "Slack" },
  { icon: BookOpen, label: "Confluence" },
  { icon: Bell, label: "Notifications" },
  { icon: FolderPlus, label: "Project" },
];

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  function next() {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      router.push("/");
    }
  }

  function skip() {
    next();
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="size-6 text-primary" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-semibold">Set up FigBack</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let&apos;s connect your tools. Takes about 3 minutes.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s.label}
              className={`flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </div>
          ))}
        </div>

        <div className="glass mt-6 rounded-lg p-6">
          <StepContent step={step} onNext={next} onSkip={skip} />
        </div>
      </div>
    </div>
  );
}

function StepContent({
  step,
  onNext,
  onSkip,
}: {
  step: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  switch (step) {
    case 0:
      return (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Verify Figma Connection</h2>
          <p className="text-sm text-muted-foreground">
            Your Figma access token is set via environment variables. Let&apos;s verify it works.
          </p>
          <Button onClick={onNext} className="w-full btn-gradient rounded-lg">
            Verify Connection
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      );
    case 1:
      return (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Choose LLM Provider</h2>
          <p className="text-sm text-muted-foreground">
            Select which LLM provider to use for comment classification.
          </p>
          <div className="grid gap-2">
            {["Google Gemini", "OpenAI GPT", "Anthropic Claude"].map((p) => (
              <button
                key={p}
                className="glass glass-hover rounded-lg px-4 py-3 text-left text-sm font-medium"
                onClick={onNext}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      );
    case 2:
      return (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Connect Slack</h2>
          <p className="text-sm text-muted-foreground">
            Get notified about new comments in your Slack channel.
          </p>
          <div className="space-y-2">
            <Label htmlFor="slack">Webhook URL</Label>
            <Input id="slack" placeholder="https://hooks.slack.com/services/..." className="rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSkip} className="flex-1 rounded-lg">
              Skip
            </Button>
            <Button onClick={onNext} className="flex-1 btn-gradient rounded-lg">
              Connect
            </Button>
          </div>
        </div>
      );
    case 3:
      return (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Connect Confluence</h2>
          <p className="text-sm text-muted-foreground">
            Push digest reports directly to Confluence.
          </p>
          <div className="space-y-2">
            <Label htmlFor="confluence">Confluence URL</Label>
            <Input id="confluence" placeholder="https://your-team.atlassian.net" className="rounded-lg" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSkip} className="flex-1 rounded-lg">
              Skip
            </Button>
            <Button onClick={onNext} className="flex-1 btn-gradient rounded-lg">
              Connect
            </Button>
          </div>
        </div>
      );
    case 4:
      return (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Enable Notifications</h2>
          <p className="text-sm text-muted-foreground">
            Get push notifications when new comments are detected on your designs.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onSkip} className="flex-1 rounded-lg">
              Skip
            </Button>
            <Button onClick={onNext} className="flex-1 btn-gradient rounded-lg">
              Enable
            </Button>
          </div>
        </div>
      );
    case 5:
      return (
        <div className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Create First Project</h2>
          <p className="text-sm text-muted-foreground">
            Name your project and paste Figma file URLs to start tracking.
          </p>
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" placeholder="e.g. Checkout Redesign" className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="figma-url">Figma file URL</Label>
            <Input id="figma-url" placeholder="https://www.figma.com/file/..." className="rounded-lg" />
          </div>
          <Button onClick={onNext} className="w-full btn-gradient rounded-lg">
            Create & Start Watching
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </div>
      );
    default:
      return null;
  }
}
