"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Edge case for hydration mismatch
    setMounted(true);
  }, []);

  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      setTheme(checked ? "dark" : "light");
    },
    [setTheme]
  );

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Light</span>
      {/* Avoid hydration mismatch: render switch uncontrolled until mounted */}
      <Switch
        checked={mounted ? resolvedTheme === "dark" : undefined}
        onCheckedChange={handleCheckedChange}
      />
      <span className="text-xs text-muted-foreground">Dark</span>
    </div>
  );
}
