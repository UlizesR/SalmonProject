import { barrierList } from "./barrierdata";

// Defining constants used in the simulation for equilibrium distribution calculations.
// These constants represent fractions used in the Lattice-Boltzmann Method (LBM) equations.
const four9ths = 4.0 / 9.0;
const one9th = 1.0 / 9.0;
const one36th = 1.0 / 36.0;

// Lattice-Boltzmann simulation class
// This class encapsulates the entire LBM simulation, managing the grid, fluid properties,
// barriers, tracers, and the simulation steps (collision and streaming).
class LBMSimulation {
    // Dimensions of the simulation grid
    xdim: number;   // Width of the simulation grid
    ydim: number;   // Height of the simulation grid
    pxPerSquare: number;    // Number of pixels per grid square (for rendering purposes)

    // Distribution functions
    // These arrays represent the distribution of particles in various directions at each grid point.
    n0: Float32Array;    // Rest (no movement) distribution
    nN: Float32Array;    // North distribution
    nS: Float32Array;    // South distribution
    nE: Float32Array;    // East distribution
    nW: Float32Array;    // West distribution
    nNE: Float32Array;   // Northeast distribution
    nSE: Float32Array;   // Southeast distribution
    nNW: Float32Array;   // Northwest distribution
    nSW: Float32Array;   // Southwest distribution

    // Macroscopic fields
    // These arrays store macroscopic properties derived from the distribution functions.
    rho: Float32Array;     // Density at each grid point
    ux: Float32Array;      // Velocity component in the x-direction
    uy: Float32Array;      // Velocity component in the y-direction
    curl: Float32Array;    // Curl of the velocity field (useful for visualizing vortices)
    barrier: Uint8Array;   // Barrier map indicating the presence of barriers (1) or not (0)

    // Flow parameters related to barriers
    barrierCount = 0;      // Number of barrier points
    barrierxSum = 0;       // Sum of x-coordinates of barrier points (for calculating center of barriers)
    barrierySum = 0;       // Sum of y-coordinates of barrier points
    barrierFx = 0.0;       // Force in the x-direction due to barriers
    barrierFy = 0.0;       // Force in the y-direction due to barriers

    // Sensor position in the grid
    sensorX = 0;           // X-coordinate of the sensor
    sensorY = 0;           // Y-coordinate of the sensor

    // Tracer particles
    nTracers = 144;        // Number of tracer particles
    tracerX: Float32Array; // X-coordinates of tracers
    tracerY: Float32Array; // Y-coordinates of tracers

    /**
     * Constructor to initialize the simulation grid and all related arrays.
     * @param xdim - Width of the simulation grid
     * @param ydim - Height of the simulation grid
     * @param pxPerSquare - Number of pixels per grid square for rendering
     */
    constructor(xdim: number, ydim: number, pxPerSquare: number) {
        this.xdim = xdim;
        this.ydim = ydim;
        this.pxPerSquare = pxPerSquare;

        const size = xdim * ydim; // Total number of grid points

        // Initializing distribution function arrays with zero values.
        this.n0 = new Float32Array(size);
        this.nN = new Float32Array(size);
        this.nS = new Float32Array(size);
        this.nE = new Float32Array(size);
        this.nW = new Float32Array(size);
        this.nNE = new Float32Array(size);
        this.nSE = new Float32Array(size);
        this.nNW = new Float32Array(size);
        this.nSW = new Float32Array(size);

        // Initializing macroscopic field arrays.
        this.rho = new Float32Array(size);
        this.ux = new Float32Array(size);
        this.uy = new Float32Array(size);
        this.curl = new Float32Array(size);
        this.barrier = new Uint8Array(size);

        // Initializing tracer position arrays.
        this.tracerX = new Float32Array(this.nTracers);
        this.tracerY = new Float32Array(this.nTracers);
    }

    /**
     * Initializes the fluid in the simulation with a uniform velocity.
     * @param u0 - Initial velocity magnitude in the x-direction
     */
    initFluid(u0: number): void {
        // Iterate over each grid point to set the initial equilibrium distribution.
        for (let y = 0; y < this.ydim; y++) {
            for (let x = 0; x < this.xdim; x++) {
                // Set equilibrium distribution at (x, y) with velocity (u0, 0).
                this.setEquil(x, y, u0, 0, 1);
                // Initialize curl to zero.
                this.curl[x + y * this.xdim] = 0.0;
            }
        }
        // Position the sensor at the center of the grid.
        this.sensorX = Math.floor(this.xdim / 2);
        this.sensorY = Math.floor(this.ydim / 2);
    }

    /**
     * Initializes tracer particles within the simulation grid.
     * @param enableTracers - Flag to enable or disable tracers
     */
    initTracers(enableTracers: boolean): void {
        if (!enableTracers) return; // Exit if tracers are not enabled.

        // Calculate the number of rows and spacing between tracers.
        const nRows = Math.ceil(Math.sqrt(this.nTracers));
        const dx = this.xdim / nRows;
        const dy = this.ydim / nRows;
        let nextX = dx / 2; // Starting x-position for the first tracer.
        let nextY = dy / 2; // Starting y-position for the first tracer.

        // Position tracers in a grid pattern.
        for (let t = 0; t < this.nTracers; t++) {
            this.tracerX[t] = nextX;
            this.tracerY[t] = nextY;
            nextX += dx; // Move to the next position in the x-direction.
            if (nextX > this.xdim) { // If x exceeds grid width, reset and move down.
                nextX = dx / 2;
                nextY += dy;
            }
        }
    }

    /**
     * Adds a barrier at the specified grid coordinates.
     * @param x - X-coordinate where the barrier is to be added
     * @param y - Y-coordinate where the barrier is to be added
     */
    addBarrier(x: number, y: number): void {
        // Ensure barriers are not placed too close to the grid edges.
        if (x > 1 && x < this.xdim - 2 && y > 1 && y < this.ydim - 2) {
            this.barrier[x + y * this.xdim] = 1; // Mark the grid point as a barrier.
        }
    }

    /**
     * Removes a barrier from the specified grid coordinates.
     * @param x - X-coordinate where the barrier is to be removed
     * @param y - Y-coordinate where the barrier is to be removed
     */
    removeBarrier(x: number, y: number): void {
        if (this.barrier[x + y * this.xdim]) {
            this.barrier[x + y * this.xdim] = 0; // Unmark the barrier.
        }
    }

    /**
     * Clears all barriers from the simulation grid.
     */
    clearBarriers(): void {
        this.barrier.fill(0); // Reset all barrier flags to 0 (no barriers).
    }

    /**
     * Places a predefined barrier shape based on the provided index.
     * @param index - Index of the barrier shape to be placed from `barrierList`
     */
    placeBarrierShape(index: number): void {
        const selectedBarrier = barrierList[index - 1]; // Select barrier shape.
        if (!selectedBarrier) return; // Exit if the barrier shape does not exist.

        this.clearBarriers(); // Clear existing barriers.

        const locs = selectedBarrier.locations; // Get barrier locations.
        // Iterate over the locations in pairs (x, y) to add barriers.
        for (let i = 0; i < locs.length; i += 2) {
            this.addBarrier(locs[i], locs[i + 1]);
        }
    }

    /**
     * Sets the boundary conditions for the simulation grid.
     * Typically, boundary conditions are used to simulate walls or inflow/outflow.
     * @param u0 - Boundary velocity magnitude
     */
    setBoundaries(u0: number): void {
        // Set top and bottom boundaries.
        for (let x = 0; x < this.xdim; x++) {
            this.setEquil(x, 0, u0, 0, 1); // Top boundary (y = 0)
            this.setEquil(x, this.ydim - 1, u0, 0, 1); // Bottom boundary (y = ydim - 1)
        }
        // Set left and right boundaries.
        for (let y = 1; y < this.ydim - 1; y++) {
            this.setEquil(0, y, u0, 0, 1); // Left boundary (x = 0)
            this.setEquil(this.xdim - 1, y, u0, 0, 1); // Right boundary (x = xdim - 1)
        }
    }

    /**
     * Performs the collision step of the Lattice-Boltzmann Method.
     * This step relaxes the distribution functions towards equilibrium.
     * @param omega - Relaxation parameter controlling the rate of collision
     */
    collide(omega: number): void {
        // Iterate over internal grid points (excluding boundaries).
        for (let y = 1; y < this.ydim - 1; y++) {
            for (let x = 1; x < this.xdim - 1; x++) {
                const i = x + y * this.xdim; // Linear index for 2D grid.

                // Compute macroscopic density by summing all distribution functions.
                const thisrho = this.n0[i] + this.nN[i] + this.nS[i] + this.nE[i] + this.nW[i] +
                                this.nNW[i] + this.nNE[i] + this.nSW[i] + this.nSE[i];
                this.rho[i] = thisrho; // Store density.

                // Compute macroscopic velocity components.
                const thisux = (this.nE[i] + this.nNE[i] + this.nSE[i] - this.nW[i] - this.nNW[i] - this.nSW[i]) / thisrho;
                const thisuy = (this.nN[i] + this.nNE[i] + this.nNW[i] - this.nS[i] - this.nSE[i] - this.nSW[i]) / thisrho;
                this.ux[i] = thisux;
                this.uy[i] = thisuy;

                // Precompute commonly used terms for efficiency.
                const ux2 = thisux * thisux;          // Square of velocity in x
                const uy2 = thisuy * thisuy;          // Square of velocity in y
                const u2 = ux2 + uy2;                 // Magnitude squared of velocity
                const u215 = 1.5 * u2;                // 1.5 * |u|^2
                const one9thrho = one9th * thisrho;   // (1/9) * rho
                const one36thrho = one36th * thisrho; // (1/36) * rho
                const ux3 = 3 * thisux;                // 3 * u_x
                const uy3 = 3 * thisuy;                // 3 * u_y
                const uxuy2 = 2 * thisux * thisuy;     // 2 * u_x * u_y

                // Relaxation towards equilibrium for each distribution function.
                // The equilibrium distributions are based on the velocity and density.
                this.n0[i] += omega * (four9ths * thisrho * (1 - u215) - this.n0[i]);
                this.nE[i] += omega * (one9thrho * (1 + ux3 + 4.5 * ux2 - u215) - this.nE[i]);
                this.nW[i] += omega * (one9thrho * (1 - ux3 + 4.5 * ux2 - u215) - this.nW[i]);
                this.nN[i] += omega * (one9thrho * (1 + uy3 + 4.5 * uy2 - u215) - this.nN[i]);
                this.nS[i] += omega * (one9thrho * (1 - uy3 + 4.5 * uy2 - u215) - this.nS[i]);
                this.nNE[i] += omega * (one36thrho * (1 + ux3 + uy3 + 4.5 * (u2 + uxuy2) - u215) - this.nNE[i]);
                this.nSE[i] += omega * (one36thrho * (1 + ux3 - uy3 + 4.5 * (u2 - uxuy2) - u215) - this.nSE[i]);
                this.nNW[i] += omega * (one36thrho * (1 - ux3 + uy3 + 4.5 * (u2 - uxuy2) - u215) - this.nNW[i]);
                this.nSW[i] += omega * (one36thrho * (1 - ux3 - uy3 + 4.5 * (u2 + uxuy2) - u215) - this.nSW[i]);
            }
        }

        // Handle East boundary separately to apply boundary conditions.
        for (let y = 1; y < this.ydim - 2; y++) {
            const i = this.xdim - 1 + y * this.xdim; // Index at the East boundary.
            const im1 = i - 1; // Index of the adjacent cell to the West.
            this.nW[i] = this.nW[im1];     // Reflect West distribution to East boundary.
            this.nNW[i] = this.nNW[im1];   // Reflect Northwest distribution.
            this.nSW[i] = this.nSW[im1];   // Reflect Southwest distribution.
        }
    }

    /**
     * Performs the streaming step of the Lattice-Boltzmann Method.
     * This step moves the distribution functions to neighboring grid points.
     * Also handles bounce-back at barriers to simulate solid boundaries.
     */
    stream(): void {
        // Reset barrier-related accumulators.
        this.barrierCount = 0;
        this.barrierxSum = 0;
        this.barrierySum = 0;
        this.barrierFx = 0.0;
        this.barrierFy = 0.0;

        const xdim = this.xdim;
        const ydim = this.ydim;

        // Stream North and Northwest distribution functions.
        for (let y = ydim - 2; y > 0; y--) {
            for (let x = 1; x < xdim - 1; x++) {
                this.nN[x + y * xdim] = this.nN[x + (y - 1) * xdim]; // Move North distribution up.
                this.nNW[x + y * xdim] = this.nNW[x + 1 + (y - 1) * xdim]; // Move Northwest distribution diagonally.
            }
        }

        // Stream East and Northeast distribution functions.
        for (let y = ydim - 2; y > 0; y--) {
            for (let x = xdim - 2; x > 0; x--) {
                this.nE[x + y * xdim] = this.nE[x - 1 + y * xdim]; // Move East distribution to the right.
                this.nNE[x + y * xdim] = this.nNE[x - 1 + (y - 1) * xdim]; // Move Northeast distribution diagonally.
            }
        }

        // Stream South and Southeast distribution functions.
        for (let y = 1; y < ydim - 1; y++) {
            for (let x = xdim - 2; x > 0; x--) {
                this.nS[x + y * xdim] = this.nS[x + (y + 1) * xdim]; // Move South distribution down.
                this.nSE[x + y * xdim] = this.nSE[x - 1 + (y + 1) * xdim]; // Move Southeast distribution diagonally.
            }
        }

        // Stream West and Southwest distribution functions.
        for (let y = 1; y < ydim - 1; y++) {
            for (let x = 1; x < xdim - 1; x++) {
                this.nW[x + y * xdim] = this.nW[x + 1 + y * xdim]; // Move West distribution to the left.
                this.nSW[x + y * xdim] = this.nSW[x + 1 + (y + 1) * xdim]; // Move Southwest distribution diagonally.
            }
        }

        // Handle bounce-back at barriers to simulate solid boundaries.
        for (let y = 1; y < ydim - 1; y++) {
            for (let x = 1; x < xdim - 1; x++) {
                if (this.barrier[x + y * xdim]) { // If current grid point is a barrier.
                    const i = x + y * xdim;

                    // Store incoming distribution functions.
                    const E = this.nE[i], W = this.nW[i], N = this.nN[i], S = this.nS[i],
                          NE = this.nNE[i], NW = this.nNW[i], SE = this.nSE[i], SW = this.nSW[i];

                    // Perform bounce-back: reverse the direction of incoming distributions.
                    this.nE[x + 1 + y * xdim] = W;    // East distribution becomes West.
                    this.nW[x - 1 + y * xdim] = E;    // West distribution becomes East.
                    this.nN[x + (y + 1) * xdim] = S;  // North distribution becomes South.
                    this.nS[x + (y - 1) * xdim] = N;  // South distribution becomes North.
                    this.nNE[x + 1 + (y + 1) * xdim] = SW; // Northeast becomes Southwest.
                    this.nNW[x - 1 + (y + 1) * xdim] = SE; // Northwest becomes Southeast.
                    this.nSE[x + 1 + (y - 1) * xdim] = NW; // Southeast becomes Northwest.
                    this.nSW[x - 1 + (y - 1) * xdim] = NE; // Southwest becomes Northeast.

                    // Update barrier statistics for potential analysis or force calculations.
                    this.barrierCount++;
                    this.barrierxSum += x;
                    this.barrierySum += y;
                    this.barrierFx += E + NE + SE - W - NW - SW; // Net force in x-direction.
                    this.barrierFy += N + NE + NW - S - SE - SW; // Net force in y-direction.
                }
            }
        }
    }

    /**
     * Moves tracer particles based on the current velocity field.
     * Tracers help visualize the flow within the simulation.
     * @param enabled - Flag to enable or disable tracer movement
     */
    moveTracers(enabled: boolean): void {
        if (!enabled) return; // Exit if tracers are not enabled.

        const xdim = this.xdim;
        const ydim = this.ydim;

        // Iterate over each tracer particle.
        for (let t = 0; t < this.nTracers; t++) {
            // Determine the current grid cell of the tracer by rounding its position.
            const ix = Math.round(this.tracerX[t]);
            const iy = Math.round(this.tracerY[t]);
            const i = ix + iy * xdim; // Linear index for the current grid cell.

            // Update tracer position based on the local velocity.
            this.tracerX[t] += this.ux[i];
            this.tracerY[t] += this.uy[i];

            // Handle tracer wrapping if it moves beyond the grid boundaries.
            if (this.tracerX[t] > xdim - 1) {
                this.tracerX[t] = 0; // Wrap to the left side.
                this.tracerY[t] = Math.random() * ydim; // Assign a random y-position.
            }
        }
    }

    /**
     * Injects additional fluid into the simulation at a specified location.
     * This can simulate inflow or disturbances within the fluid.
     * @param pushX - X-coordinate where fluid is to be injected
     * @param pushY - Y-coordinate where fluid is to be injected
     * @param pushUX - Velocity component in the x-direction for injected fluid
     * @param pushUY - Velocity component in the y-direction for injected fluid
     */
    pushFluid(pushX: number, pushY: number, pushUX: number, pushUY: number): void {
        const xdim = this.xdim;
        const ydim = this.ydim;
        const margin = 3; // Margin to prevent injection too close to boundaries.

        // Ensure injection point is within the safe area.
        if (pushX > margin && pushX < xdim - 1 - margin && pushY > margin && pushY < ydim - 1 - margin) {
            // Inject fluid in a cross pattern (vertical and horizontal).
            for (let dx = -1; dx <= 1; dx++) {
                this.setEquil(pushX + dx, pushY + 2, pushUX, pushUY); // Above the center.
                this.setEquil(pushX + dx, pushY - 2, pushUX, pushUY); // Below the center.
            }
            // Inject fluid in a square pattern around the center.
            for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    this.setEquil(pushX + dx, pushY + dy, pushUX, pushUY);
                }
            }
        }
    }

    /**
     * Sets the equilibrium distribution functions at a specific grid point.
     * This is used to initialize or modify the distribution functions based on desired macroscopic properties.
     * @param x - X-coordinate of the grid point
     * @param y - Y-coordinate of the grid point
     * @param newux - New velocity component in the x-direction
     * @param newuy - New velocity component in the y-direction
     * @param newrho - (Optional) New density value. If undefined, current density is used.
     */
    setEquil(x: number, y: number, newux: number, newuy: number, newrho?: number): void {
        const i = x + y * this.xdim; // Linear index for the grid point.

        // If new density is not provided, use the current density.
        if (newrho === undefined) newrho = this.rho[i];

        // Precompute terms used in equilibrium distribution calculations.
        const ux3 = 3 * newux;
        const uy3 = 3 * newuy;
        const ux2 = newux * newux;
        const uy2 = newuy * newuy;
        const u2 = ux2 + uy2;
        const u215 = 1.5 * u2;
        const uxuy2 = 2 * newux * newuy;

        // Calculate equilibrium distribution functions based on the velocity and density.
        this.n0[i] = four9ths * newrho * (1 - u215);
        this.nE[i] = one9th * newrho * (1 + ux3 + 4.5 * ux2 - u215);
        this.nW[i] = one9th * newrho * (1 - ux3 + 4.5 * ux2 - u215);
        this.nN[i] = one9th * newrho * (1 + uy3 + 4.5 * uy2 - u215);
        this.nS[i] = one9th * newrho * (1 - uy3 + 4.5 * uy2 - u215);
        this.nNE[i] = one36th * newrho * (1 + ux3 + uy3 + 4.5 * (u2 + uxuy2) - u215);
        this.nSE[i] = one36th * newrho * (1 + ux3 - uy3 + 4.5 * (u2 - uxuy2) - u215);
        this.nNW[i] = one36th * newrho * (1 - ux3 + uy3 + 4.5 * (u2 - uxuy2) - u215);
        this.nSW[i] = one36th * newrho * (1 - ux3 - uy3 + 4.5 * (u2 + uxuy2) - u215);

        // Update macroscopic fields with new values.
        this.rho[i] = newrho;
        this.ux[i] = newux;
        this.uy[i] = newuy;
    }

    /**
     * Checks the stability of the simulation by ensuring that the density remains positive.
     * Negative densities can cause numerical instability and simulation failure.
     * @returns `true` if the simulation is stable, `false` otherwise
     */
    checkStability(): boolean {
        const mid = (this.ydim >> 1) * this.xdim; // Index of the middle row.

        // Iterate over the middle row to check densities.
        for (let x = 0; x < this.xdim; x++) {
            if (this.rho[x + mid] <= 0) return false; // Found non-positive density.
        }
        return true; // All densities in the middle row are positive.
    }

    /**
     * Computes the curl of the velocity field across the entire simulation grid.
     * The curl is useful for visualizing rotational aspects of the flow, such as vortices.
     */
    computeCurl(): void {
        const xdim = this.xdim;
        const ydim = this.ydim;

        // Iterate over internal grid points (excluding boundaries).
        for (let y = 1; y < ydim - 1; y++) {
            for (let x = 1; x < xdim - 1; x++) {
                // Calculate the discrete curl using central differences.
                // curl = d(uy)/dx - d(ux)/dy
                this.curl[x + y * xdim] = (this.uy[x + 1 + y * xdim] - this.uy[x - 1 + y * xdim]) 
                                         - (this.ux[x + (y + 1) * xdim] - this.ux[x + (y - 1) * xdim]);
            }
        }
    }
}

// Exporting the LBMSimulation class for use in other modules.
export { LBMSimulation };
