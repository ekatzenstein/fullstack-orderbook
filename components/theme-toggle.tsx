"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const animationTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Edge case for hydration mismatch
    setMounted(true);
  }, []);

  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      // Add a temporary class to enable smooth transitions
      const root = document.documentElement;
      root.classList.add("theme-animate");

      // Ensure removal after the animation duration
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = window.setTimeout(() => {
        root.classList.remove("theme-animate");
        animationTimeoutRef.current = null;
      }, 250);

      setTheme(checked ? "dark" : "light");
    },
    [setTheme]
  );

  React.useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

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
