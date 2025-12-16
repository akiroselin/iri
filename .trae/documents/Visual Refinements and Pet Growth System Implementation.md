I have completed the requested changes.

### 1. Visual & Animation Fixes
- **Stop Pose**: Updated the animation loop to ensure animals return to a neutral standing pose when stopping.
    - Resets leg rotation, body height, body roll (Z-axis), and tail rotation.
    - Added specific tail pose handling for Cat vs Corgi/Rabbit.
    - Forces `leg.position.y` back to base height to prevent "floating" or "sunken" legs.
- **Flowers**: Increased the proportion of pink flowers in the scene generation logic.

### 2. Pet Selection & Growth System
- **Backend (`routes/auth.js`)**:
    - Updated user registration to include a `petGrowth` field (`level: 1`, `exp: 0`, `sizeMultiplier`).
- **Frontend (`index.html`)**:
    - **Initial Selection Modal**: Added a "Choose Your Partner" modal that appears for logged-in users who haven't selected a pet yet.
    - **Selection Logic**:
        - Users choose between Corgi, Cat, and Rabbit.
        - Upon confirmation, assigns a random initial size (0.8x - 1.2x) to the `petGrowth.sizeMultiplier`.
        - Saves the selection to the backend via `/api/user/update`.
    - **Growth Rendering**: Updated `rebuildPet()` to apply the `sizeMultiplier` from the user's growth data to the 3D model scale.
    - **UI Polish**: Automatically hides the manual pet switcher sidebar (`#pet-selector`) for users with a fixed pet to enforce the "one unique partner" concept.

The system is now ready for testing. New users will be prompted to select a pet, and that pet will persist with its specific size. Existing animations should feel more natural when stopping.