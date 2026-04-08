import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4">
      <div className="glass max-w-sm rounded-lg p-8 text-center">
        <p className="text-6xl font-heading font-semibold text-primary/30">404</p>
        <h1 className="mt-4 font-heading text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className={cn(buttonVariants(), "mt-6 rounded-lg")}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
