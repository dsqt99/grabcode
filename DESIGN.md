---
name: Emerald Mobility Marketplace
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3d4a3d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6d7b6c'
  outline-variant: '#bccbb9'
  surface-tint: '#006e2e'
  primary: '#006e2e'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#003a15'
  inverse-primary: '#52e078'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#855300'
  on-tertiary: '#ffffff'
  tertiary-container: '#d68900'
  on-tertiary-container: '#492b00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#71fe91'
  primary-fixed-dim: '#52e078'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system channels the frictionless, hyper-accessible utility of a premier Southeast Asian super-app into a modern technical marketplace. The visual tone balances rapid-dispatch efficiency with consumer-grade friendliness: direct, reliable, and unmistakably energetic.

The style fuses modern consumer tech minimalism with high-utility tactile affordances:
- **Crisp utility:** Dense, scannable data layouts that respect user momentum.
- **Friendly tactile geometries:** Soft pill containers, generous tap targets, and clear affordances.
- **Micro-delights:** Subtle spring-physics responses on active cards, badges, and progress milestones that instill certainty.

## Colors

The palette establishes immediate familiarity using high-visibility emerald tones grounded by dense slate neutrals and functional accent alerts:

- **Primary (`#4F46E5` / Dark Hover `#4338CA`):** Anchors core actions, conversion paths, and positive states.
- **Mint Surface (`#EEF2FF`):** Acts as the sub-primary tinted surface for tags, highlight chips, active route markers, and selected states without introducing eye fatigue.
- **Neutral Dark (`#0F172A` / `#1E293B`):** Delivers sharp, legible typography and high-contrast structural frame contrast.
- **Neutral Surface (`#F8FAFC` base, `#FFFFFF` cards, `#E2E8F0` borders):** Clean, crisp backdrop layers that keep content dominant.
- **Accent Amber (`#F59E0B`):** Reserved for marketplace rating stars, surge notices, and real-time status warnings.

## Typography

The type hierarchy pairs the rounded geometry of Plus Jakarta Sans for titles and navigation labels with the neutral, engineered clarity of Inter for dense listings, code snippets, and operational tables.

- **Headlines & Badges:** Utilize Plus Jakarta Sans to maintain an optimistic, approachable, consumer-grade personality.
- **Data & Microcopy:** Rendered with Inter for crisp character disambiguation, particularly in dense tracking sequences, monetary amounts, and tabular data.

## Layout & Spacing

A modular 12-column fluid grid system on desktop shifts to a 6-column grid on tablets and a 4-column layout on mobile devices.

- **Mobile (<768px):** 16px lateral margin, 16px column gutter. Views default to a single-column stacked format with persistent bottom action sheets.
- **Tablet (768px - 1024px):** 32px lateral margin, 24px column gutter. 2-column card arrays for service and tier browsing.
- **Desktop (>1024px):** Capped at 1280px max-width, 48px outer canvas margin, 24px column gutter. Split-view displays support real-time status feeds side-by-side with marketplace catalogs.

## Elevation & Depth

Visual hierarchy uses clean surface separation combined with emerald-tinted and neutral ambient drops:

- **Level 0 (Flat / Canvas):** `#F8FAFC` base background.
- **Level 1 (Cards & Static Containers):** `#FFFFFF` surface bordered by a crisp `1px solid #E2E8F0` border. Zero shadow to prevent clutter across large lists.
- **Level 2 (Interactive Cards / Floating Controls):** `0px 4px 16px -2px rgba(15, 23, 42, 0.06), 0px 2px 6px -1px rgba(79, 70, 229, 0.04)`.
- **Level 3 (Modals / Sticky Booking Bottom Bar):** `0px 12px 32px -4px rgba(15, 23, 42, 0.12), 0px 4px 12px -2px rgba(15, 23, 42, 0.04)`.
- **Level 4 (Toasts / Critical Overlays):** `0px 20px 40px -8px rgba(15, 23, 42, 0.16)`.

## Shapes

The roundedness level 2 sets a 8px (0.5rem) baseline curve across interactive components, scaling upward for tactile friendliness:

- **Base Inputs & Metric Tiles:** 8px (`rounded-md`).
- **Cards & Modal Containers:** 16px (`rounded-lg`).
- **Surface Panels & Floating Drawers:** 24px (`rounded-xl`).
- **Buttons, Badges, & Status Chips:** 9999px (full pill roundedness) to preserve the signature consumer-service identity.

## Components

### Buttons
- **Primary:** Background `#4F46E5`, text `#FFFFFF`, full pill geometry (`rounded-full`), font `Plus Jakarta Sans` semi-bold. Hover: `#4338CA`. Active: slight inset scale (`scale(0.98)`).
- **Secondary:** Surface `#EEF2FF`, text `#4338CA`, zero border, full pill geometry. Hover: `#E0E7FF`.
- **Tertiary / Ghost:** Surface transparent, text `#0F172A`, hover `#F1F5F9`.

### Chips & Pill Badges
- **Status Indicators:** Full pill shape, padding `4px 12px`.
  - *Active / Ready:* `#EEF2FF` background with `#4338CA` text.
  - *Pending / Transit:* Amber tinted (`#FEF3C7` background with `#B45309` text).
  - *Dark Neutral:* `#0F172A` background with `#F8FAFC` text.

### Cards
- Surface `#FFFFFF`, border `1px solid #E2E8F0`, border-radius 16px, padding 20px.
- **Hover State:** Translate-Y `-2px` with Level 2 elevation shadow and an optional subtle border tint to `#4F46E5`.

### Form Controls & Inputs
- **Inputs:** Height 48px, background `#F8FAFC`, border `1px solid #CBD5E1`, border-radius 8px. Focus: border `#4F46E5` with a soft emerald focus ring (`0 0 0 3px rgba(79, 70, 229, 0.15)`).
- **Checkboxes & Radios:** Primary `#4F46E5` checked state with crisp white glyph. Unchecked: `1.5px solid #94A3B8`.

### Specialized Marketplace Elements
- **Rating Badges:** Compact pill displaying star icon in `#F59E0B`, paired with dark slate numeric score (`13px Plus Jakarta Sans bold`).
- **Tracking Stepper:** Horizontal & vertical line indicators (`2px solid #E2E8F0`). Completed/active steps display emerald `#4F46E5` circular nodes with white icons; incomplete nodes display hollow rings.
- **Currency Switcher (VND/USD):** Segmented pill toggle control. Background `#F1F5F9`, active segment `#FFFFFF` with Level 1 shadow and emerald text.