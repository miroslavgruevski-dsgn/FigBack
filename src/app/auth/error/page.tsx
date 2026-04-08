import Link from "next/link";
import { ShieldX, Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AuthErrorPage() {
  return (
    <div className="glass w-full max-w-md rounded-2xl p-8 text-center shadow-xl shadow-destructive/5">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
        <ShieldX className="size-7 text-destructive" />
      </div>

      <h1 className="mt-5 font-heading text-2xl font-semibold">Access Denied</h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
        This instance of FigBack is restricted to the Symphony team.
        Only <span className="font-medium text-foreground">@symphony.is</span> email addresses can sign in.
      </p>

      <div className="glass-tint mt-6 rounded-xl px-4 py-3 text-left">
        <div className="flex items-start gap-3">
          <Mail className="size-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Need access?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reach out to your team lead or admin to get your Symphony Google
              account provisioned.
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/auth/signin"
        className={cn(buttonVariants(), "mt-6 w-full rounded-xl btn-gradient")}
      >
        Try with a different account
      </Link>
    </div>
  );
}
