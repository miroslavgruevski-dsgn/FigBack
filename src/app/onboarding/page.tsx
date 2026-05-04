"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Link2,
  Sparkles,
  LayoutDashboard,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const slides = [
  {
    step: 1,
    icon: Link2,
    color: "from-primary to-[oklch(0.55_0.22_285)]",
    title: "Connect your Figma files",
    description:
      "Paste any Figma file URL and FigBack starts watching for new comments automatically. You can add multiple files per project.",
    detail: "Settings \u2192 Add Figma file URL \u2192 Done",
  },
  {
    step: 2,
    icon: Sparkles,
    color: "from-[oklch(0.55_0.22_285)] to-[oklch(0.55_0.18_310)]",
    title: "Every comment is classified automatically",
    description:
      "Each new comment is analyzed by your chosen LLM (Gemini, GPT, or Claude). Comments get a priority, category, and effort tag.",
    detail: "Runs on every sync \u2022 No manual work",
  },
  {
    step: 3,
    icon: LayoutDashboard,
    color: "from-[oklch(0.55_0.18_310)] to-primary",
    title: "Get a visual digest",
    description:
      "Review a clean, priority-sorted digest of all feedback. Share it with stakeholders or push it to Slack and Confluence.",
    detail: "Export \u2022 Share link \u2022 Slack \u2022 Confluence",
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [active, setActive] = useState(0);

  function next() {
    if (active < slides.length - 1) {
      setActive((s) => s + 1);
    } else {
      router.push("/setup");
    }
  }

  function skip() {
    router.push("/setup");
  }

  const slide = slides[active];

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg btn-gradient">
              <MessageSquare className="size-4 text-primary-foreground" />
            </div>
            <span className="font-heading text-lg font-semibold">FigBack</span>
          </div>
          <button
            onClick={skip}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip intro
          </button>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= active ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="glass rounded-2xl p-8 shadow-xl shadow-primary/5">
          <div className={`inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br ${slide.color} shadow-lg`}>
            <slide.icon className="size-7 text-white" />
          </div>

          <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Step {slide.step} of {slides.length}
          </p>

          <h2 className="mt-2 font-heading text-2xl font-semibold leading-tight">
            {slide.title}
          </h2>

          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            {slide.description}
          </p>

          <div className="glass-tint mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-primary">
            <ChevronRight className="size-3" />
            {slide.detail}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <Button
              onClick={next}
              className="flex-1 btn-gradient rounded-xl py-3 text-sm shadow-lg shadow-primary/20"
            >
              {active < slides.length - 1 ? "Next" : "Get started"}
              <ArrowRight className="ml-2 size-4" />
            </Button>

            {active < slides.length - 1 && (
              <Button
                variant="ghost"
                onClick={skip}
                className="rounded-xl text-sm text-muted-foreground"
              >
                Skip all
              </Button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          You can always revisit setup from Settings.
        </p>
      </div>
    </div>
  );
}
