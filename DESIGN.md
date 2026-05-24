# ExtBrew — Design Tokens

## Palette
- Background: #FAFAFA
- Surface (cards, panels): #FFFFFF
- Border: #E5E5E5
- Border (hover): #D4D4D4
- Text primary: #0A0A0A
- Text muted: #737373
- Text subtle: #A3A3A3
- Accent: #2563EB (blue-600)
- Accent hover: #1D4ED8 (blue-700)
- Accent foreground: #FFFFFF

## Semantic
- Success: #10B981
- Warning: #F59E0B
- Error: #EF4444

## Typography
- Font: Geist Sans (UI), Geist Mono (code, file paths, monospace UI bits)
- Sizes follow Tailwind defaults

## Layout
- Pane structure: Chat (left) | Editor (middle) | Preview (right)
- Chat pane: 320px default, resizable, min 280px, max 500px
- Editor pane: flex-1 (takes remaining space)
- Preview pane: 400px default, resizable, min 320px, max 600px
- Header: 48px tall, sticky top
- Border radius: 8px on cards, 6px on inputs/buttons
- Spacing: generous — minimum 24px between major sections

## Empty state
- Headline: "Let's cook an extension!"
- Subtitle: "Describe what you want to build"
- Placeholder: "Block Twitter 9–5 on weekdays"