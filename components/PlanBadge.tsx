"use client";

import { usePathname } from "next/navigation";
import { stepEngineCopy } from "@/lib/i18n/stepEngine";

export default function PlanBadge({ plan }: { plan: "39" | "69" | null }) {
  const pathname = usePathname();
  const lang = (pathname.startsWith('/es') ? 'es' : 'en') as 'en' | 'es';
  const t = stepEngineCopy[lang];
  return (
    <div className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-4">
      {plan === "69" ? t.panels.planFull : t.panels.planBasic}
    </div>
  );
}
