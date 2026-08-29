"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

const PLANS: { id: "pro" | "pro_plus"; name: string; price: string }[] = [
  { id: "pro", name: "Pro", price: "$19/mo" },
  { id: "pro_plus", name: "Pro+", price: "$49/mo" },
];

export function BillingSection({ currentPlan }: { currentPlan: "free" | "pro" | "pro_plus" }) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade(plan: "pro" | "pro_plus") {
    setLoadingPlan(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoadingPlan(null);
    }
  }

  async function handleManageBilling() {
    setLoadingPlan("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open the billing portal.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoadingPlan(null);
    }
  }

  if (currentPlan !== "free") {
    return (
      <div className="mt-3">
        <button
          onClick={handleManageBilling}
          disabled={loadingPlan !== null}
          className="flex items-center gap-2 rounded-full border border-ink-line px-4 py-2 text-sm hover:bg-ink disabled:opacity-60"
        >
          {loadingPlan === "portal" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Manage billing
        </button>
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => handleUpgrade(plan.id)}
            disabled={loadingPlan !== null}
            className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {loadingPlan === plan.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Upgrade to {plan.name} — {plan.price}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
