'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

const ORDER = ['light', 'dark', 'system'] as const;
type Mode = (typeof ORDER)[number];

const ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL = { light: 'Light', dark: 'Dark', system: 'System' } as const;

/** Header control that cycles Light → Dark → System. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Standard next-themes hydration guard: the resolved theme is only known on
  // the client, so render a neutral icon until mounted to avoid a mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const current: Mode =
    mounted && theme && (ORDER as readonly string[]).includes(theme)
      ? (theme as Mode)
      : 'system';
  const Icon = ICON[current];
  const next: Mode =
    ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? 'system';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[current]} (click for ${LABEL[next]})`}
      title={`Theme: ${LABEL[current]}`}
      className="text-foreground-muted hover:bg-surface-raised hover:text-foreground cursor-pointer rounded-md p-2 transition-colors"
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
