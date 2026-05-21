import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useActionLock } from "@/hooks/useActionLock";
import type { TestResult } from "@/components/crm/TestResultPanel";
import type { ProviderStatus } from "@/types/integrations";

export type TestOutcome = { ok: boolean; reason?: string; verifiedAt?: string } | null;

export interface UseProviderTestFlowResult {
  testResult: TestResult | null;
  testing: boolean;
  locked: boolean;
  handleTest: () => Promise<void>;
}

/**
 * Wraps the provider Test button's single-flight lock + the inline result
 * panel state. Hydrates from `status.lastVerifiedAt` on mount and when it
 * advances past the local result, so the card reflects the most recent
 * known state across tabs.
 */
export function useProviderTestFlow(
  status: ProviderStatus,
  providerName: string,
  onTest: () => Promise<TestOutcome>,
): UseProviderTestFlowResult {
  // Test button uses a single-flight lock — see useActionLock for rationale.
  const testLock = useActionLock();
  // Latest Test result, kept inline on the card until the next Test run replaces it.
  const [testResult, setTestResult] = useState<TestResult | null>(() =>
    status.lastVerifiedAt ? { ok: true, verifiedAt: status.lastVerifiedAt } : null,
  );

  // If the saved `lastVerifiedAt` changes (e.g. after refresh from another
  // tab) and we don't already have a fresher local result, hydrate from it
  // so the card shows the most recent known state on mount.
  useEffect(() => {
    if (!status.lastVerifiedAt) return;
    setTestResult((prev) => {
      if (
        prev &&
        new Date(prev.verifiedAt).getTime() >= new Date(status.lastVerifiedAt!).getTime()
      ) {
        return prev;
      }
      return { ok: true, verifiedAt: status.lastVerifiedAt! };
    });
  }, [status.lastVerifiedAt]);

  const handleTest = async () => {
    await testLock.run(async () => {
      const ranAt = new Date().toISOString();
      try {
        const res = await onTest();
        if (res?.ok) {
          setTestResult({ ok: true, verifiedAt: res.verifiedAt ?? ranAt });
          toast.success(`${providerName} is working`, {
            description: "Credentials verified successfully.",
          });
        } else {
          const reason = res?.reason ?? "No response from provider.";
          setTestResult({ ok: false, reason, verifiedAt: ranAt });
          toast.error(`${providerName} test failed`, { description: reason });
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Unknown error";
        setTestResult({ ok: false, reason, verifiedAt: ranAt });
        toast.error("Test failed", { description: reason });
      }
    });
  };

  return {
    testResult,
    testing: testLock.loading,
    locked: testLock.locked,
    handleTest,
  };
}
