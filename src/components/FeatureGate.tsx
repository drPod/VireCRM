import { ReactNode } from "react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  /** What to show when the feature is locked. Pass `null` to render nothing. */
  fallback?: ReactNode;
  /** Show a default "Upgrade required" card when locked. Defaults to `false`. */
  showUpgradeCard?: boolean;
  /** Custom heading on the upgrade card. */
  upgradeTitle?: string;
  /** Custom description on the upgrade card. */
  upgradeDescription?: string;
}

/**
 * Conditionally render UI based on whether the current org has a feature
 * enabled. Use this around any premium / custom-sold UI.
 *
 * @example
 *   <FeatureGate feature="custom_reports" showUpgradeCard>
 *     <CustomReportBuilder />
 *   </FeatureGate>
 */
export function FeatureGate({
  feature,
  children,
  fallback = null,
  showUpgradeCard = false,
  upgradeTitle = "Premium feature",
  upgradeDescription = "This feature is available on enterprise plans. Contact your account manager to enable it.",
}: FeatureGateProps) {
  const { enabled, loading } = useFeatureFlag(feature);

  // Avoid flashing locked UI while the first fetch is in flight.
  if (loading) return null;
  if (enabled) return <>{children}</>;
  if (fallback !== null && fallback !== undefined) return <>{fallback}</>;
  if (!showUpgradeCard) return null;

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center">
        <div className="rounded-full bg-muted p-3 mb-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="font-semibold">{upgradeTitle}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">{upgradeDescription}</p>
      </CardContent>
    </Card>
  );
}
