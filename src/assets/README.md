# Elemental character atlases

The original twenty characters derive from the user's six original concepts: Water's
wave-haired knight, Dark's masked ninja, Fire's living flame, Air's silver crown,
Earth's reptilian brawler, and Light's white hood and spear.

The runtime atlases are transparent, lossless WebP files encoded from the
image-generation outputs. The original level-I PNG remains as the design source.
JSON files record each frame's source rectangle, foot anchor and reference height.
Each atlas loads independently; failed identity images use the procedural avatar,
and failed running images use the loaded idle poses. There are no runtime calls
to an external image service.

## Identity atlases

All identity atlases use six columns: front, right, back, front attack, right
attack, back attack. Left views mirror right views.

- `origins`: Water, Dark, Fire, Air, Earth, Light.
- `fusions-grounded`: Mud, Mirror, Sun, Smoke, Gravity, Multi-Dimensional, Invincible.
- `fusions-airborne`: Spirit, Blaze, Cloud, Apparition, Demonic, Divine, Lightning.

Mud combines water hair and reptile armor; Mirror combines white hood and silver
scales; Sun combines white cloak and golden flames; Smoke combines ninja blades
and embers; Gravity uses purple reptilian ninja armor; Multi-Dimensional combines
white hood, violet mask and crystal blades; Invincible combines reptile bulk,
flames and a paladin's mantle. Flying fusions inherit Air's crown and floating
silhouette alongside the other components. Divine's atlas is fully visible;
combat visibility is applied by the renderer, including to its glow and effects.

## Running atlases

Six columns: two opposing front strides, two right-facing strides, two back
strides. `running-origins` rows are Water, Dark, Fire, Earth, Light;
`running-fusions` rows match `fusions-grounded`. Running alternates those strides
with contact poses from the identity atlas. The cycle follows voluntary movement
and speed; grounded fighters do not run in place when blocked. Attacks and paired
clashes override running. Air-based forms retain hovering motion.

The normal strike uses the existing 110ms windup and 220ms swing. A contested
strike uses its contact pose plus a paired weapon effect for 300ms. These visual
states do not add attack damage, range or cooldowns. Level-II shines and level-III
glows are composited in the renderer so the transparency rules remain consistent.

## v0.9 replacement atlases

`revised-characters.webp` overrides Divine, Invincible, Lightning and
Multi-Dimensional (four rows, the same six identity/attack columns).
Divine has a featureless white-light face under its hood; Invincible has an
uncovered human head, human arms and golden scales; Lightning's hair is gold;
Multi-Dimensional's hood has no head spikes.

`revised-running.webp` overrides Earth, Mud, Invincible and Multi-Dimensional
(four rows, six running columns). Earth and Mud use a continuous all-fours gait
rendered at a lower height, never alternating back to an upright idle sprite.
The other two rows carry their revised anatomy/head details into running.
Both atlases were generated from the existing concepts and encoded losslessly;
JSON frame bounds and foot anchors do not modify the art. Summon/revival body
flashes are white silhouettes composited from the loaded atlas at runtime.

## v0.10 combat poses

`tuned-identities` replaces Mud's idle/attack art (tan hair, white eyes) and
Divine's idle/attack stance (levitating, with the same faceless light hood).
`tuned-running.json` reads Mud's six quadruped running cells from the same image.

`combat-origins`, `combat-grounded`, and `combat-airborne` provide guarded
sidestepping poses. Per-character correction atlases preserve the established
Gravity, Sun, Lightning and Mud designs. Runtime metadata maps front/right/back
A/B pairs; left mirrors right. Some poses use the same art with alternating
lateral weight transfer, rather than playing the forward running sequence.

`hurt-origins`, `hurt-grounded`, and `hurt-airborne` contain front/right/back
flinches; the individual correction atlases include their own hurt row. These
frames accompany the existing recoil transform. Attack, clash, charge, shield,
dash and teleport priority remains governed by combat state. All effects still
respect Divine concealment. Generated PNG sources remain in the workspace;
only encoded WebP assets and frame metadata ship with the game.

## v0.17 fusion replacements

`new-fusions.webp` replaces the temporary procedural Phoenix, Terraformer and
Sanctuary figures with detailed sprite art matching the existing character
atlases. The six columns are front/right/back idle and front/right/back strikes.
Phoenix has flame feather wings and talon gauntlets, Terraformer has a stone
reptilian silhouette with violet scarf and claws, and Sanctuary has emerald
scaled armor, a white hood and a crystal water spear.

`new-fusions-motion.webp` contains paired motion rows for each character, with
front/right/back columns. JSON remaps them to the six-frame movement format.
All three use guarded sidesteps; Sanctuary also uses these alternating grounded
strides, while Phoenix and Terraformer hover during ordinary movement.

`new-fusions-reactions.webp` provides directional hurt frames and victory poses.
These PNG-generated originals were encoded as lossless WebP without modifying
the artwork. Frame bounds and anatomical anchors are metadata only. Runtime
loading, fallback, flashing, facing, attack timing and hit reactions use the
same renderer as the rest of the roster. The procedural block figures were removed.
