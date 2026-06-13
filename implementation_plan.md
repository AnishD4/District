# Goal Description

The goal is to refactor the React application to transition from a "terrain editor" mode to a "city viewer" mode. We will utilize the user-provided polygon coordinates to procedurally generate basic 3D buildings on top of the existing 3D base map (`city_infrastructure_base_map.glb`). The Editor UI will be removed, and the focus will be on rendering a visually appealing, interactive 3D city scene.

## User Review Required

> [!IMPORTANT]
> Since we are moving away from the editor mode, the `EditorUI` and polygon-drawing capabilities will be removed from the main view. Please confirm if you want to keep the editor on a separate route, or completely replace it with the viewer. The proposed plan replaces it completely.

## Open Questions

> [!WARNING]
> 1. **Building Styles:** Currently, the plan is to extrude the provided polygons upwards to create flat-roofed, blocky buildings. Would you like randomized heights or specific colors/textures for these buildings?
> 2. **Camera Positioning:** What should be the initial camera position? Should it be an isometric overview or closer to the ground?

## Proposed Changes

### `src/data` (New Directory)

#### [NEW] `src/data/plots.json`
- Create a JSON file to store the 29 manually mapped plot polygons provided in the prompt.

### `src/components`

#### [NEW] `src/components/CityScene.jsx`
- This component will replace `TerrainEditor.jsx`.
- It will load and render the `city_infrastructure_base_map.glb`.
- It will import `plots.json`.
- For each polygon in the data, it will create a `THREE.Shape` using the (x, z) coordinates, and use `ExtrudeGeometry` to generate a 3D building mesh. The buildings will be randomly colored or use a specific palette (e.g., modern glass/concrete colors) and given a randomized or fixed height.

#### [DELETE] `src/components/TerrainEditor.jsx`
- Remove the terrain drawing logic since we have the final plots.

#### [DELETE] `src/components/EditorUI.jsx`
- Remove the overlay UI used for drawing polygons.

### `src`

#### [MODIFY] `src/App.jsx`
- Update the main entry point to render the `CityScene` inside the Three.js `<Canvas>`.
- Configure lights, environment, and `OrbitControls` for an optimal viewing experience.
- Add modern CSS styling (e.g., full screen, maybe a sleek UI overlay for title/info if desired).

## Verification Plan

### Manual Verification
- Start the Vite development server (`npm run dev`).
- Verify that the base map loads correctly.
- Verify that 3D buildings are extruded exactly on the designated plot coordinates.
- Ensure the scene is interactive (pan, zoom, rotate).
