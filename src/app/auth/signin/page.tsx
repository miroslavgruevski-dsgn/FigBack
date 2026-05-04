import { signIn } from "@/lib/auth";
import { MessageSquare, Sparkles, BarChart3, Bell, ShieldCheck } from "lucide-react";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  return (
    <div className="w-full max-w-4xl">
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-0">
        <div className="flex flex-col justify-center lg:pr-12">
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-lg btn-gradient">
              <MessageSquare className="size-5 text-primary-foreground" />
            </div>
            <span className="font-heading text-2xl font-semibold">FigBack</span>
          </div>

          <h1 className="mt-6 font-heading text-3xl font-semibold leading-tight sm:text-4xl">
            Turn Figma comments into
            <span className="bg-gradient-to-r from-primary to-[oklch(0.6_0.2_300)] bg-clip-text text-transparent"> actionable feedback</span>
          </h1>

          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Auto-watch your design files, classify comments automatically, and generate visual digests your team can act on.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <FeatureChip icon={Sparkles} label="LLM classification" description="Gemini, GPT, or Claude" />
            <FeatureChip icon={BarChart3} label="Visual digests" description="Priority-sorted reports" />
            <FeatureChip icon={Bell} label="Real-time alerts" description="Slack + push notifications" />
            <FeatureChip icon={ShieldCheck} label="Team-only access" description="Restricted to @symphony.is" />
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="glass w-full max-w-sm rounded-2xl p-8 shadow-xl shadow-primary/5">
            <div className="text-center">
              <h2 className="font-heading text-xl font-semibold">Welcome back</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in with your Symphony Google account.
              </p>
            </div>

            <SignInForm searchParams={searchParams} />

            <div className="mt-6 rounded-lg bg-primary/5 px-3 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">
                <ShieldCheck className="inline size-3 mr-1 -mt-0.5" />
                Only <span className="font-medium text-foreground">@symphony.is</span> emails are authorized.
                Contact your team lead if you need access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureChip({ icon: Icon, label, description }: { icon: typeof Sparkles; label: string; description: string }) {
  return (
    <div className="glass-tint flex items-start gap-3 rounded-xl px-3.5 py-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

async function SignInForm({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <form
      className="mt-6"
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: params.callbackUrl || "/" });
      }}
    >
      {params.error && (
        <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {params.error === "AccessDenied"
            ? "Access restricted. Only @symphony.is emails are allowed."
            : "Something went wrong. Please try again."}
        </p>
      )}
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-3 rounded-xl btn-gradient px-4 py-3.5 text-sm font-medium shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
      >
        <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        By signing in, you agree to our internal usage policies.
      </p>
    </form>
  );
}
