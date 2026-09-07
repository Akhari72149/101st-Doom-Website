# Customiser model assets

The current page uses a clearly labelled UV calibration rig because the repository does not yet contain an approved production model.

Place production GLB files in this directory, then add a `ModelDefinition` in `src/data/model-customiser/config.ts` with:

- `source: "gltf"`
- the public `modelPath`, for example `/models/customiser/clone-armour.glb`
- the exact paintable mesh names inspected from the GLB
- one paint zone per independent texture canvas
- optional UV mask paths after approved mask images are supplied
- supported logo zones and scale limits

Every paintable mesh must contain a usable `uv` attribute. Shared or overlapping UV islands intentionally mirror paint; models that should not mirror markings need non-overlapping UVs. Verify material and texture orientation before approving a model for production use.

