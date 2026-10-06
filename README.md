# Maiben Herring Co.

Static site on the shared luxury base. Serve with `npx serve maiben`.

## 3D hero
`js/hero-3d.js` (Three.js): the four tub photos sit on a ring of curved cards with floating spice flecks.
- **Drag** to spin (with flick and snap), **hover** to tilt, **arrow keys** when focused, flavour buttons to jump.
- **Scroll** steps through Mustard, Chilli, Schmaltz, 7 Spiced using 0.085 damping; text is never faded.
- No WebGL or reduced motion: static photo, buttons and scroll still switch the flavour.

## Content
Flavours, prices, phone and Instagram come from the original Maiben site. Orders are not sent anywhere: the order form shows a summary to confirm by phone/text. Add a real order endpoint or email before relying on it.
