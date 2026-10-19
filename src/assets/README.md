# Origin characters

`origins.png` is a transparent atlas created for this game from the user's six
character concepts: Water's wave-haired knight, Dark's masked ninja, Fire's living
flame, Air's silver-crowned fighter, Earth's reptilian brawler and Light's hooded
spearfighter. All six are interpreted in the same pixel-art style.

Rows: Water, Dark, Fire, Air, Earth, Light.
Columns: front, right, back, front strike, right strike, back strike.
Left views mirror right views. `origins.json` records source rectangles and foot
anchors, so hair, capes and extended weapons do not shift the fighter's position.

The renderer uses the existing 220ms swing: 110ms windup followed by contact and
recovery. Character-specific effects are cosmetic and do not add damage,
projectiles, burn, range or cooldowns. Walking adds a subtle rocking gait.

Generated with OpenAI image generation, then integrated as a local asset. The
game serves the atlas through Vite's versioned asset URLs; no image service is
called at runtime. Fused characters retain the existing blended-color avatar,
shine and glow. The procedural avatar is also the image-load failure fallback.
