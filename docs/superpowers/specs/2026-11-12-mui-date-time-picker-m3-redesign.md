# Modern Material 3 Redesign: MuiDateTimePicker

## Intent and Why
`MuiDateTimePicker` is a core date and time selection component used across Spendorax (transactions, bills, loans, search filters, and notifications). While the underlying selection and validation logic is rock-solid, its current visual design suffers from:
- A heavy, monolithic solid green banner competing with underline tabs directly beneath it.
- Inconsistent dark mode styling where dialog containers and text colors are hardcoded to light-mode values (`#fff`, `#111827`, `#F3F4F6`).
- Clunky layout artifacts, notably year pagination buttons positioned with negative margins (`marginHorizontal: -12`) that clip on smaller screens, and boxy digital time inputs.

This redesign reworks the component's aesthetics to modern **Material 3 (M3 Expressive)** standards while leaving all existing business logic, validation rules, animations, and component APIs untouched.

---

## Goals
1. **Material 3 Container & Surface Polish:**
   - 28px continuous corner radius (`borderRadius: 28`) and multi-layer elevation shadows for a floating dialog appearance.
   - Dynamic surface coloring driven by `useTheme()` (`theme.cardBg`, `theme.border`, `theme.textPrimary`, `theme.textSecondary`).
2. **Unified M3 Header & Segmented Pill Switch:**
   - Replace the solid block banner with a clean, airy header showing:
     - Contextual micro-label ("SELECT DATE" / "SELECT TIME").
     - Elegant, large formatted date/time preview in `theme.textPrimary`.
     - Modern segmented pill switch (`[ 📅 Date | 🕒 Time ]`) smoothly integrated without conflicting underline tabs.
3. **Calendar Experience (Days, Months, Years):**
   - **Days Grid:** Refined circular touch targets. Selected day receives a solid `PRIMARY_COLOR` circle with subtle ambient elevation. "Today" receives a distinct accent outline ring and bold tint when unselected.
   - **Month & Year Selectors:** Interactive pill chips (`November ▾`, `2026 ▾`) with soft background states.
   - **Year Picker Navigation:** Replace negative-margin floating arrows with an intuitive in-header pagination bar (`< 2024 – 2035 >`).
4. **Time Picker Dial & Digital Controls:**
   - Modernized digital time capsules with soft tinted active states and rounded corners (`borderRadius: 16`).
   - Segmented AM / PM toggle pill with clear active state contrast.
   - Themed analog clock dial surface with crisp numeral typography and sleek SVG needle pointer.
5. **Polished Action Footer:**
   - Subtle top divider separator.
   - Clean spacing with optional "Clear" button on the left, and refined "Cancel" and "OK" pill buttons on the right.
6. **100% Logic & API Preservation:**
   - Exact prop preservation: `visible`, `initialDate`, `onClose`, `onSelect`, `disableFutureDates`, `minDate`, `maxDate`, `allowClear`, `onClear`, `hideTime`, `hideDate`.
   - Date clamping, bounds checking, and animations remain identical.

---

## Non-Goals & Anti-Goals
- **Non-Goals:**
  - Modifying callback signatures or prop types.
  - Changing how dates or timestamps are formatted upon `onSelect`.
  - Adding external dependencies (e.g., third-party date pickers).
- **Anti-Goals:**
  - Do not introduce horizontal clipping or layout overflow on small viewport devices.
  - Do not keep hardcoded background or font colors that break dark mode contrast.

---

## Approaches Considered
1. **Approach 1 (Chosen): Modern Material 3 (M3 Expressive)**
   - Elevated dialog card, integrated segmented pill navigation, refined typography, subtle "today" ring, clean year pagination bar, and full theme reactivity.
   - *Best alignment with Spendorax's clean, modern Android & iOS design language.*
2. **Approach 2: Heavy Solid Brand Banner (Current)**
   - Monolithic solid green header with underline tabs below.
   - *Rejected: Heavy visual weight, feels dated, wastes vertical card real estate.*
3. **Approach 3: Minimalist Monochromatic iOS Sheet**
   - Pure outline borders with monochrome dark/white surfaces and minimal color.
   - *Rejected: User specifically selected Modern Material 3.*

---

## Detailed Component Specifications

### 1. Modal Shell & Surface
- **Overlay:** `backgroundColor: 'rgba(0,0,0,0.6)'` with backdrop blur feel.
- **Card:**
  - `backgroundColor: theme.cardBg`
  - `borderRadius: 28`
  - `borderWidth: 1`, `borderColor: theme.border`
  - `width: '92%'`, `maxWidth: 360`
  - `overflow: 'hidden'`

### 2. Header Area
- **Container:**
  - Gentle top padding (20px), horizontal padding (20px), bottom padding (16px).
  - Background: `theme.cardBg` with a subtle bottom divider line (`theme.borderSubtle` / `theme.border`).
- **Top Row:**
  - Left: Micro-label ("SELECT DATE" / "SELECT TIME") in `theme.textSecondary`, `fontSize: 12`, `fontWeight: '700'`, `letterSpacing: 1.1`.
  - Right: When both Date and Time are enabled (`!hideTime && !hideDate`), an elegant pill segmented control with icons (`calendar-month`, `clock-outline`).
- **Hero Value:**
  - Formatted active value (e.g., `Wed, Nov 12` or `10:30 AM`) in `theme.textPrimary`, `fontSize: 24`, `fontWeight: '800'`.

### 3. Date View
- **Month/Year Bar:**
  - Month and Year selector pills: `paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20`, with soft background `isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'`.
  - Left/Right Month arrows: circular icon buttons with subtle hover feedback and opacity for disabled states.
- **Weekday Header:**
  - Clean row of 7 days (`S`, `M`, `T`, `W`, `T`, `F`, `S`) with `theme.textMuted`, `fontSize: 12`, `fontWeight: '700'`.
- **Day Cells:**
  - `width: '14.28%'`, `aspectRatio: 1`.
  - Active: solid `PRIMARY_COLOR` (`#3F8F6B`), white text, elevation shadow.
  - Today (unselected): border ring `borderWidth: 1.5, borderColor: PRIMARY_COLOR`, text in `PRIMARY_COLOR`.
  - Idle: text in `theme.textPrimary`, `fontWeight: '500'`.
  - Disabled: text in `theme.textMuted`, opacity 0.35.

### 4. Month & Year Views
- **Months Grid:**
  - 3 columns x 4 rows.
  - Item height: 44px, `borderRadius: 14`.
  - Idle: `backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC'`, text `theme.textPrimary`.
  - Selected: `backgroundColor: PRIMARY_COLOR`, text `#FFFFFF`.
- **Years View:**
  - Dedicated pagination header: `<` `2024 – 2035` `>` using clean icon buttons and centered year range label.
  - 3x4 grid inside matching the month grid style, with zero negative margins.

### 5. Time View
- **Digital Display:**
  - Hours and Minutes capsules: `borderRadius: 16`, `paddingVertical: 10`, `paddingHorizontal: 16`.
  - Idle: `backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9'`.
  - Active: `backgroundColor: `${PRIMARY_COLOR}18``, `borderWidth: 1.5`, `borderColor: PRIMARY_COLOR`.
  - Colon `:` between capsules in `theme.textSecondary`.
  - AM/PM Switch: Segmented pill container (`borderRadius: 12`, `borderWidth: 1`, `borderColor: theme.border`), active segment highlighted in `PRIMARY_COLOR`.
- **Clock Dial:**
  - Dial size: 220px, radius 82px.
  - Face: `backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9'`.
  - SVG center pin and needle: `#3F8F6B` stroke and fill with selected circular tip.
  - Dial numbers: 36x36 touch targets, `fontSize: 15`, `fontWeight: '600'`, white on selected, `theme.textPrimary` on idle.

### 6. Action Footer
- Height ~60px, padding horizontal 20px.
- Left: Optional "Clear" text button with red tone (`#EF4444`).
- Right: "Cancel" button with `theme.textSecondary` and "OK" contained pill button with `PRIMARY_COLOR` and rounded corners (`borderRadius: 20`).
