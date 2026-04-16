"use client";

import { useRouter } from "next/navigation";
import { useTransaction } from "@/context/TransactionContext";
import { STEPS } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

export default function Header() {
  const { transaction, goToStep } = useTransaction();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }
  const currentStepIndex = STEPS.findIndex(
    (s) => s.key === transaction.current_step
  );

  return (
    <header className="border-b border-[var(--border)] px-6 py-4">
      <div className="max-w-[680px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-[var(--foreground-muted)] uppercase tracking-widest mb-0.5">
              Step {currentStepIndex + 1} of {STEPS.length}
            </p>
            <p className="text-white font-semibold">
              {STEPS[currentStepIndex].label}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--foreground-muted)]">
              {transaction.vehicle.year} {transaction.vehicle.make}{" "}
              {transaction.vehicle.model}
            </p>
            <div className="flex items-center justify-end gap-4 mt-0.5">
              <p className="text-xs text-[var(--foreground-muted)]">
                {transaction.checklist_progress}% complete
              </p>
              <button
                onClick={handleLogout}
                className="text-xs text-white hover:underline cursor-pointer transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex-1">
              <div
                className={`h-1 w-full rounded-full transition-colors duration-300 ${
                  i <= currentStepIndex
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--border)]"
                }`}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-1.5">
          {STEPS.map((step, i) => {
            const isCompleted = i < currentStepIndex;
            const isCurrent = i === currentStepIndex;
            return isCompleted ? (
              <button
                key={step.key}
                onClick={() => goToStep(step.key)}
                className="text-[10px] uppercase tracking-wider transition-colors duration-300 text-[var(--foreground-muted)] hover:text-white cursor-pointer"
              >
                {step.label}
              </button>
            ) : (
              <p
                key={step.key}
                className={`text-[10px] uppercase tracking-wider transition-colors duration-300 ${
                  isCurrent ? "text-[var(--accent)]" : "text-[var(--border)]"
                }`}
              >
                {step.label}
              </p>
            );
          })}
        </div>
      </div>
    </header>
  );
}
