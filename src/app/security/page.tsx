import { Shield, Database, Image, Brain, Share2 } from "lucide-react";

export const metadata = { title: "Security" };

const sections = [
  {
    icon: Database,
    title: "Comment Data",
    description:
      "Stored in Neon Postgres with AES-256 encryption at rest. SOC 2 Type 2 certified. Data isolated per deployment.",
  },
  {
    icon: Image,
    title: "Design Screenshots",
    description:
      "Stored in Vercel Blob with private access. No public URLs. Served via HMAC-signed, time-limited tokens that expire after 48 hours.",
  },
  {
    icon: Brain,
    title: "LLM Processing",
    description:
      "Comment text and cropped images are sent to your configured LLM provider for classification. Google, OpenAI, and Anthropic do not train on API data by default. Skip-LLM mode available for strict compliance.",
  },
  {
    icon: Share2,
    title: "Sharing",
    description:
      "Data is only shared to Slack or Confluence when explicitly triggered by a team member. Shareable links are time-limited and signed.",
  },
];

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-semibold">Security & Privacy</h1>
          <p className="text-sm text-muted-foreground">
            How FigBack handles your design data.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {sections.map((s) => (
          <div key={s.title} className="glass rounded-lg p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <s.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h2 className="font-heading text-base font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {s.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass mt-8 rounded-lg p-5">
        <h2 className="font-heading text-base font-semibold">Data Retention</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Configure how long a project can stay idle before it is soft-archived (Settings, default 90 days).
          Archiving hides projects from the main list; it does not delete Figma or database rows.
        </p>
      </div>

      <div className="mt-8 text-xs text-muted-foreground">
        <p>Provider compliance documentation:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <a href="https://vercel.com/security" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
              Vercel Security
            </a>
          </li>
          <li>
            <a href="https://neon.tech/docs/security" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
              Neon Security
            </a>
          </li>
          <li>
            <a href="https://ai.google.dev/terms" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
              Google AI API Terms
            </a>
          </li>
          <li>
            <a href="https://openai.com/enterprise-privacy" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
              OpenAI Enterprise Privacy
            </a>
          </li>
          <li>
            <a href="https://www.anthropic.com/policies" className="underline hover:text-foreground" target="_blank" rel="noopener noreferrer">
              Anthropic Policies
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
