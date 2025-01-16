/**
 * Salmon Class
 * 
 * This class represents a Salmon entity within the Lattice-Boltzmann simulation.
 * The Salmon can move within the simulation grid, controlled by user inputs (arrow keys),
 * interact with the fluid flow, and manage its stamina based on active swimming and flow conditions.
 */
export class Salmon {
    // Position coordinates of the Salmon on the simulation grid
    x: number;            // Current x-coordinate (floating-point for sub-grid precision)
    y: number;            // Current y-coordinate (floating-point for sub-grid precision)

    // Physical properties of the Salmon
    length: number;      // Length of the Salmon (could be used for rendering or collision detection)

    // Stamina management
    stamina: number;         // Current stamina level of the Salmon
    maxStamina: number;      // Maximum stamina the Salmon can have

    // Movement properties
    maxSpeed: number;        // Maximum speed the Salmon can achieve when actively swimming

    // Stamina consumption and recovery rates
    staminaUsage: number;    // Rate at which stamina is consumed per active movement
    staminaRecovery: number; // Rate at which stamina recovers when not actively swimming

    // Threshold for flow speed below which the Salmon can recover stamina without active movement
    lowSpeedThreshold: number; // Flow speed below this value allows stamina recovery if not moving

    /**
     * Constructor for the Salmon class.
     * Initializes the Salmon's position, physical properties, and stamina-related attributes.
     * 
     * @param x - Initial x-coordinate of the Salmon on the grid
     * @param y - Initial y-coordinate of the Salmon on the grid
     * @param length - Length of the Salmon
     * @param maxSpeed - Maximum speed the Salmon can achieve when swimming
     * @param maxStamina - Maximum stamina the Salmon can have
     */
    constructor(x: number, y: number, length: number, maxSpeed: number, maxStamina: number) {
        this.x = x;                   // Set initial x-position
        this.y = y;                   // Set initial y-position
        this.length = length;         // Set Salmon's length
        this.maxSpeed = maxSpeed;     // Set Salmon's maximum speed
        this.maxStamina = maxStamina; // Set Salmon's maximum stamina
        this.stamina = maxStamina;    // Initialize current stamina to maximum

        // Initialize stamina consumption and recovery rates
        this.staminaUsage = 0.05;     // Set stamina usage per active movement
        this.staminaRecovery = 0.01;  // Set stamina recovery rate when not swimming

        // Set the flow speed threshold for stamina recovery
        this.lowSpeedThreshold = 0.05; // Flow speed below this value allows stamina recovery if not moving
    }

    /**
     * Updates the Salmon's state based on the simulation's current conditions and user inputs.
     * This includes movement influenced by the fluid flow, active swimming controlled by user inputs,
     * stamina management, and collision with barriers.
     * 
     * @param sim - The simulation object containing the current state of the fluid and barriers
     * @param input - An object representing the state of directional arrow keys (up, down, left, right)
     */
    update(sim: any, input: { up: boolean; down: boolean; left: boolean; right: boolean }): void {
        // Calculate the linear index for the Salmon's current grid position
        const i = Math.round(this.x) + Math.round(this.y) * sim.xdim;

        // Retrieve the local fluid velocity components at the Salmon's position
        const flowUx = sim.ux[i]; // Velocity component in the x-direction from the fluid flow
        const flowUy = sim.uy[i]; // Velocity component in the y-direction from the fluid flow

        // Calculate the magnitude of the fluid flow at the Salmon's position
        const flowSpeed = Math.sqrt(flowUx * flowUx + flowUy * flowUy);

        // Initialize the Salmon's own velocity components
        let salmonUx = 0; // Velocity in the x-direction due to active swimming
        let salmonUy = 0; // Velocity in the y-direction due to active swimming

        // Determine if any directional arrow keys are currently pressed
        const keysPressed = input.up || input.down || input.left || input.right;

        if (this.stamina <= 0) {
            // Scenario: Salmon has exhausted its stamina
            // Behavior: Move passively with the fluid flow without attempting to swim
            salmonUx = 0; // No additional movement in x-direction
            salmonUy = 0; // No additional movement in y-direction

            // Optional Behavior:
            // If the fluid flow is slow enough, allow the Salmon to recover some stamina
            if (flowSpeed < this.lowSpeedThreshold) {
                // Recover a small amount of stamina
                this.stamina += this.staminaRecovery;
                // Ensure stamina does not exceed its maximum limit
                if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
            }

        } else {
            // Scenario: Salmon has sufficient stamina to potentially swim actively
            if (keysPressed) {
                // Behavior: Salmon attempts to swim in the direction indicated by the pressed arrow keys

                // Determine the desired direction based on pressed keys
                let desiredUx = 0; // Desired velocity in x-direction
                let desiredUy = 0; // Desired velocity in y-direction
                if (input.left) desiredUx -= 1;    // Pressing left arrow decreases x-velocity
                if (input.right) desiredUx += 1;   // Pressing right arrow increases x-velocity
                if (input.up) desiredUy -= 1;      // Pressing up arrow decreases y-velocity (assuming y increases downward)
                if (input.down) desiredUy += 1;    // Pressing down arrow increases y-velocity

                // Normalize the desired direction vector to ensure consistent speed
                const mag = Math.sqrt(desiredUx * desiredUx + desiredUy * desiredUy); // Magnitude of the desired direction
                if (mag > 0) {
                    desiredUx /= mag; // Normalize x-component
                    desiredUy /= mag; // Normalize y-component

                    // Scale the normalized direction by the Salmon's maximum speed
                    salmonUx = desiredUx * this.maxSpeed; // Active x-velocity
                    salmonUy = desiredUy * this.maxSpeed; // Active y-velocity

                    // Consume stamina based on active movement
                    this.stamina -= this.staminaUsage;
                    // Prevent stamina from dropping below zero
                    if (this.stamina < 0) this.stamina = 0;
                } else {
                    // Edge Case: No directional input after normalization (mag == 0)
                    // Behavior: Salmon does not move actively but may recover stamina if flow is low
                    this.handleNoKeyLowFlowRecovery(flowSpeed);
                }

            } else {
                // Scenario: Salmon has stamina but no directional keys are pressed
                // Behavior: Salmon moves passively with the fluid flow without active swimming

                salmonUx = 0; // No additional movement in x-direction
                salmonUy = 0; // No additional movement in y-direction

                // Attempt to recover stamina if the fluid flow is slow enough
                this.handleNoKeyLowFlowRecovery(flowSpeed);
            }
        }

        // Calculate the proposed new position based on fluid flow and Salmon's active movement
        let proposedX = this.x + flowUx + salmonUx; // New x-coordinate
        let proposedY = this.y + flowUy + salmonUy; // New y-coordinate

        // Ensure the proposed position stays within the simulation grid boundaries
        proposedX = Math.max(0, Math.min(sim.xdim - 1, proposedX)); // Clamp x-coordinate
        proposedY = Math.max(0, Math.min(sim.ydim - 1, proposedY)); // Clamp y-coordinate

        // Check for collisions with barriers at the proposed new position
        const ix = Math.round(proposedX);                // Rounded x-coordinate for grid indexing
        const iy = Math.round(proposedY);                // Rounded y-coordinate for grid indexing
        const barrierIndex = ix + iy * sim.xdim;        // Linear index for the grid cell

        if (sim.barrier[barrierIndex] === 1) {
            // Scenario: Proposed position collides with a barrier
            // Behavior: Salmon remains in its current position without moving into the barrier

            proposedX = this.x; // Revert to current x-position
            proposedY = this.y; // Revert to current y-position
        }

        // Update Salmon's position to the proposed new position
        this.x = proposedX;
        this.y = proposedY;
    }

    /**
     * Handles stamina recovery when the Salmon is not actively swimming and the fluid flow is below a certain threshold.
     * 
     * @param flowSpeed - The current speed of the fluid flow at the Salmon's position
     */
    private handleNoKeyLowFlowRecovery(flowSpeed: number): void {
        // Check if the fluid flow is slow enough to allow stamina recovery
        if (flowSpeed < this.lowSpeedThreshold) {
            // Recover a small amount of stamina
            this.stamina += this.staminaRecovery;
            // Ensure stamina does not exceed its maximum limit
            if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
        }
    }
}
