UPDATE public.app_settings
SET chat_backgrounds = '[
  {"id": "none", "name": "None"},
  {"id": "dusk", "name": "Dusk", "css": "linear-gradient(160deg, oklch(0.62 0.17 32), oklch(0.42 0.16 300))"},
  {"id": "signal", "name": "Signal", "css": "radial-gradient(120% 90% at 20% 0%, oklch(0.75 0.15 55), transparent 60%), linear-gradient(200deg, oklch(0.55 0.13 220), oklch(0.30 0.09 265))"},
  {"id": "mint", "name": "Mint", "css": "linear-gradient(150deg, oklch(0.85 0.12 165), oklch(0.62 0.11 205))"},
  {"id": "ember", "name": "Ember", "css": "radial-gradient(100% 80% at 80% 10%, oklch(0.72 0.19 25), transparent 65%), linear-gradient(180deg, oklch(0.35 0.08 20), oklch(0.20 0.04 300))"},
  {"id": "grid", "name": "Night grid", "css": "repeating-linear-gradient(0deg, oklch(0.30 0.03 250 / 0.6) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, oklch(0.30 0.03 250 / 0.6) 0 1px, transparent 1px 28px), linear-gradient(160deg, oklch(0.28 0.05 265), oklch(0.18 0.03 280))"}
]'::jsonb
WHERE id = 'global'
  AND (chat_backgrounds IS NULL OR chat_backgrounds = '[]'::jsonb);