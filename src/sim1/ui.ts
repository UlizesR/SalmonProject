// Importing necessary classes from other modules.
// These classes handle the core simulation logic, rendering, and the behavior of a "Salmon" entity within the simulation.
import { LBMSimulation } from "./LBMSimulation";
import { Renderer } from "./Renderer";
import { Salmon } from "./Salmon";

/**
 * UIController Class
 * 
 * This class manages the user interface interactions for the Lattice-Boltzmann simulation.
 * It connects DOM elements (like sliders, buttons, and checkboxes) to the simulation's functionalities,
 * handles user inputs (mouse, touch, keyboard), and updates the simulation and renderer accordingly.
 */
export class UIController {
    // Core simulation components
    sim: LBMSimulation;      // Instance of the Lattice-Boltzmann simulation
    renderer: Renderer;      // Renderer responsible for drawing the simulation on the canvas
    salmon: Salmon;          // Instance of the Salmon entity within the simulation

    // DOM elements: Sliders for adjusting simulation parameters
    stepsSlider = document.getElementById('stepsSlider') as HTMLInputElement;       // Slider to control steps per frame
    speedSlider = document.getElementById('speedSlider') as HTMLInputElement;       // Slider to control simulation speed
    viscSlider = document.getElementById('viscSlider') as HTMLInputElement;         // Slider to adjust viscosity
    contrastSlider = document.getElementById('contrastSlider') as HTMLInputElement; // Slider to adjust rendering contrast

    // DOM elements: Display values for sliders
    speedValue = document.getElementById('speedValue') as HTMLSpanElement;         // Span to display current speed value
    viscValue = document.getElementById('viscValue') as HTMLSpanElement;           // Span to display current viscosity value

    // DOM elements: Select dropdowns for various options
    sizeSelect = document.getElementById('sizeSelect') as HTMLSelectElement;       // Dropdown to select canvas/grid size
    mouseSelect = document.getElementById('mouseSelect') as HTMLSelectElement;     // Dropdown to select mouse interaction mode
    barrierSelect = document.getElementById('barrierSelect') as HTMLSelectElement; // Dropdown to select predefined barrier shapes
    plotSelect = document.getElementById('plotSelect') as HTMLSelectElement;       // Dropdown to select plot type

    // DOM elements: Checkboxes for toggling features
    tracerCheck = document.getElementById('tracerCheck') as HTMLInputElement;       // Checkbox to toggle tracer particles
    flowlineCheck = document.getElementById('flowlineCheck') as HTMLInputElement; // Checkbox to toggle flowlines
    forceCheck = document.getElementById('forceCheck') as HTMLInputElement;       // Checkbox to toggle force visualization
    sensorCheck = document.getElementById('sensorCheck') as HTMLInputElement;     // Checkbox to toggle sensor visualization
    dataCheck = document.getElementById('dataCheck') as HTMLInputElement;         // Checkbox to toggle data display
    rafCheck = document.getElementById('rafCheck') as HTMLInputElement;           // Checkbox to toggle requestAnimationFrame for simulation loop

    // DOM elements: Readouts and data sections
    speedReadout = document.getElementById('speedReadout') as HTMLSpanElement;     // Span to display simulation speed readout
    dataSection = document.getElementById('dataSection') as HTMLDivElement;       // Div to contain data display area
    dataArea = document.getElementById('dataArea') as HTMLTextAreaElement;         // Text area to display collected data

    // DOM elements: Buttons for various controls
    startButton = document.getElementById('startButton') as HTMLInputElement;                   // Button to start/pause simulation
    dataButton = document.getElementById('dataButton') as HTMLInputElement;                     // Button to start/stop data collection
    periodButton = document.getElementById('periodButton') as HTMLInputElement;                 // Button to toggle period view
    resetFluidButton = document.getElementById('resetFluidButton') as HTMLInputElement;         // Button to reset fluid properties
    stepButton = document.getElementById('stepButton') as HTMLInputElement;                     // Button to perform a single simulation step
    clearButton = document.getElementById('clearButton') as HTMLInputElement;                   // Button to clear all barriers
    barrierDataButton = document.getElementById('barrierDataButton') as HTMLInputElement;       // Button to display barrier locations

    // DOM element: Canvas for rendering the simulation
    canvas = document.getElementById('theCanvas') as HTMLCanvasElement;                           // Canvas element where the simulation is drawn

    // State variables
    running = false;         // Flag indicating whether the simulation is running
    stepCount = 0;           // Counter for the number of simulation steps executed
    startTime = 0;           // Timestamp marking when the simulation started

    collectingData = false;  // Flag indicating whether data collection is active
    timeStep = 0;            // Current time step in the simulation
    showingPeriod = false;   // Flag indicating whether period view is active
    lastBarrierFy = 1;       // Stores the last recorded force in the y-direction on barriers
    lastFyOscTime = 0;       // Stores the last time step when a Fy oscillation was detected

    // Mouse interaction state variables
    mouseIsDown = false;     // Flag indicating whether the mouse button is pressed
    draggingSensor = false;  // Flag indicating whether the sensor is being dragged
    mouseX = 0; mouseY = 0;  // Current mouse coordinates
    oldMouseX = -1; oldMouseY = -1; // Previous mouse coordinates

    // Keyboard interaction state variables for controlling the Salmon
    upPressed = false;       // Flag indicating if the 'Up' arrow key is pressed
    downPressed = false;     // Flag indicating if the 'Down' arrow key is pressed
    leftPressed = false;     // Flag indicating if the 'Left' arrow key is pressed
    rightPressed = false;    // Flag indicating if the 'Right' arrow key is pressed

    /**
     * Constructor for the UIController class.
     * 
     * @param sim - Instance of the Lattice-Boltzmann simulation
     * @param renderer - Renderer instance for drawing the simulation
     * @param salmon - Salmon entity within the simulation
     */
    constructor(sim: LBMSimulation, renderer: Renderer, salmon: Salmon) {
        this.sim = sim;
        this.renderer = renderer;
        this.salmon = salmon;
        this.setupEventListeners(); // Initialize event listeners for UI interactions
    }

    /**
     * Sets up all necessary event listeners for UI elements and user interactions.
     */
    setupEventListeners(): void {
        // Window resize event to adjust the canvas size dynamically
        window.addEventListener('resize', () => { this.adjustCanvasSize(); });

        // Button click events
        this.startButton.addEventListener('click', () => this.startStop());                   // Start/Pause simulation
        this.dataButton.addEventListener('click', () => this.startOrStopData());               // Start/Stop data collection
        this.periodButton.addEventListener('click', () => this.togglePeriodView());            // Toggle period view

        // Slider input events
        this.speedSlider.addEventListener('input', () => this.adjustSpeed());                  // Adjust simulation speed
        this.viscSlider.addEventListener('input', () => this.adjustViscosity());               // Adjust viscosity

        // Checkbox change events
        this.dataCheck.addEventListener('change', () => this.showData());                      // Toggle data display

        // Select dropdown change events
        this.sizeSelect.addEventListener('change', () => this.adjustCanvasSize());             // Adjust canvas/grid size
        this.resetFluidButton.addEventListener('click', () => {                                // Reset fluid properties
            this.sim.initFluid(Number(this.speedSlider.value)); 
            this.repaint(); 
        });
        this.stepButton.addEventListener('click', () => {                                      // Perform a single simulation step
            this.collideStreamAndPaint(); 
        });
        this.clearButton.addEventListener('click', () => {                                     // Clear all barriers
            this.sim.clearBarriers(); 
            this.repaint(); 
        });
        this.barrierDataButton.addEventListener('click', () => this.showBarrierLocations());   // Display barrier locations

        // Barrier shape selection
        this.barrierSelect.addEventListener('change', () => {
            const selectedIndex = this.barrierSelect.selectedIndex;
            if (selectedIndex === 0) return; // Do nothing if no barrier is selected
            this.sim.placeBarrierShape(selectedIndex); // Place the selected barrier shape
            this.repaint();                           // Update the rendering
        });

        // Mouse and touch events for interacting with the canvas
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));           // Handle mouse down on canvas
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));           // Handle mouse move on canvas
        document.body.addEventListener('mouseup', () => this.handleMouseUp());                // Handle mouse up anywhere on the page
        this.canvas.addEventListener('touchstart', (e) => this.handleMouseDown(e));          // Handle touch start on canvas
        this.canvas.addEventListener('touchmove', (e) => this.handleMouseMove(e));           // Handle touch move on canvas
        document.body.addEventListener('touchend', () => this.handleMouseUp());               // Handle touch end anywhere on the page

        // Keyboard events for controlling the Salmon entity
        window.addEventListener('keydown', (e) => {                                         // Key down events
            if (e.key === "ArrowUp") this.upPressed = true;
            if (e.key === "ArrowDown") this.downPressed = true;
            if (e.key === "ArrowLeft") this.leftPressed = true;
            if (e.key === "ArrowRight") this.rightPressed = true;
        });

        window.addEventListener('keyup', (e) => {                                           // Key up events
            if (e.key === "ArrowUp") this.upPressed = false;
            if (e.key === "ArrowDown") this.downPressed = false;
            if (e.key === "ArrowLeft") this.leftPressed = false;
            if (e.key === "ArrowRight") this.rightPressed = false;
        });
    }

    /**
     * Toggles the simulation between running and paused states.
     * Updates the start button label accordingly and initiates the simulation loop if running.
     */
    startStop(): void {
        this.running = !this.running; // Toggle the running state
        this.startButton.value = this.running ? "Pause" : "Run"; // Update button label

        if (this.running) { // If simulation is now running
            this.resetTimer(); // Reset the step counter and start time
            this.simulate();    // Begin the simulation loop
        }
    }

    /**
     * Resets the simulation timer and step counter.
     */
    resetTimer(): void {
        this.stepCount = 0;                                  // Reset step count
        this.startTime = (new Date()).getTime();             // Record the current time as the start time
    }

    /**
     * Updates the displayed simulation speed value based on the speed slider.
     */
    adjustSpeed(): void {
        this.speedValue.innerHTML = Number(this.speedSlider.value).toFixed(3); // Display the current speed with 3 decimal places
    }

    /**
     * Updates the displayed viscosity value based on the viscosity slider.
     */
    adjustViscosity(): void {
        this.viscValue.innerHTML = Number(this.viscSlider.value).toFixed(3);   // Display the current viscosity with 3 decimal places
    }

    /**
     * Shows or hides the data section based on the state of the data checkbox.
     */
    showData(): void {
        this.dataSection.style.display = this.dataCheck.checked ? "block" : "none"; // Toggle display of data section
    }

    /**
     * Starts or stops data collection based on the current state.
     * Initializes data structures and UI elements accordingly.
     */
    startOrStopData(): void {
        this.collectingData = !this.collectingData; // Toggle data collection state

        if (this.collectingData) { // If data collection is now active
            this.timeStep = 0;                                        // Reset the time step counter
            // Initialize the data area with column headers
            this.dataArea.value = "Time \tDensity\tVel_x \tVel_y \tForce_x\tForce_y\n";
            this.writeData();                                         // Write initial data
            this.dataButton.value = "Stop data collection";          // Update button label
            this.showingPeriod = false;                              // Reset period view flag
            this.periodButton.value = "Show F_y period";             // Reset period button label
        } else { // If data collection is now inactive
            this.dataButton.value = "Start data collection";         // Update button label
        }
    }

    /**
     * Writes the current simulation data to the data area text box.
     * This includes time step, density, velocity components, and forces.
     */
    writeData(): void {
        // Format the current time step with leading zeros
        let timeString = String(this.timeStep).padStart(5, '0');

        // Calculate the linear index of the sensor location
        const i = this.sim.sensorX + this.sim.sensorY * this.sim.xdim;

        // Append the current data to the data area in tab-separated format
        this.dataArea.value += timeString + "\t" + 
            Number(this.sim.rho[i]).toFixed(4) + "\t" + 
            Number(this.sim.ux[i]).toFixed(4) + "\t" + 
            Number(this.sim.uy[i]).toFixed(4) + "\t" + 
            Number(this.sim.barrierFx).toFixed(4) + "\t" + 
            Number(this.sim.barrierFy).toFixed(4) + "\n";

        // Scroll to the bottom of the data area to show the latest entry
        this.dataArea.scrollTop = this.dataArea.scrollHeight;
    }

    /**
     * Displays the locations of all barriers within the simulation grid in the data area.
     * The data is formatted as a JavaScript object with a list of (x, y) coordinates.
     */
    showBarrierLocations(): void {
        // Initialize the data area with the beginning of a JavaScript object
        this.dataArea.value = '{name:"Barrier locations",\nlocations:[\n';

        // Iterate over the simulation grid to find barrier points
        for (let y = 1; y < this.sim.ydim - 1; y++) {
            for (let x = 1; x < this.sim.xdim - 1; x++) {
                if (this.sim.barrier[x + y * this.sim.xdim]) { // If a barrier exists at (x, y)
                    this.dataArea.value += x + "," + y + ",\n"; // Append the coordinates
                }
            }
        }

        // Remove the trailing comma and newline, then close the object
        this.dataArea.value = this.dataArea.value.slice(0, -2) + "\n]},\n";
    }

    /**
     * Toggles the visibility of the force in the y-direction's period view.
     * Updates the period button label accordingly.
     */
    togglePeriodView(): void {
        this.showingPeriod = !this.showingPeriod; // Toggle the period view flag
        this.periodButton.value = this.showingPeriod ? "Hide F_y period" : "Show F_y period"; // Update button label
    }

    /**
     * Adjusts the size of the canvas and simulation grid based on user selection.
     * Reinitializes the simulation and renderer to match the new size.
     */
    adjustCanvasSize(): void {
        // Update canvas dimensions to match its displayed size
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        // Update simulation parameters based on user selection
        this.sim.pxPerSquare = Number(this.sizeSelect.value); // Pixels per grid square
        this.sim.xdim = Math.floor(this.canvas.width / this.sim.pxPerSquare); // New grid width
        this.sim.ydim = Math.floor(this.canvas.height / this.sim.pxPerSquare); // New grid height

        // Create a new simulation instance with updated dimensions
        const newSim = new LBMSimulation(this.sim.xdim, this.sim.ydim, this.sim.pxPerSquare);

        // Copy relevant properties from the old simulation to the new one
        const u0 = Number(this.speedSlider.value); // Current speed value
        newSim.initFluid(u0);                      // Initialize fluid with the current speed
        newSim.initTracers(this.tracerCheck.checked); // Initialize tracers if enabled

        this.sim = newSim; // Replace the old simulation with the new one

        // Recreate the renderer with the new simulation instance
        this.renderer = new Renderer(this.renderer.context, this.canvas, this.sim);

        this.repaint(); // Update the rendering to reflect changes
    }

    /**
     * Handles mouse down events on the canvas or touch start events on touch devices.
     * Determines if the sensor is being dragged or if barriers are being drawn/erased/pushed.
     * 
     * @param e - The mouse or touch event
     */
    handleMouseDown(e: MouseEvent | TouchEvent): void {
        let pageX: number, pageY: number;

        // Determine the type of event and extract coordinates
        if (e instanceof MouseEvent) {
            pageX = e.clientX;
            pageY = e.clientY;
        } else {
            const touch = e.touches[0];
            pageX = touch.clientX;
            pageY = touch.clientY;
        }

        // Check if the sensor is being interacted with
        if (this.sensorCheck.checked) {
            const canvasLoc = this.pageToCanvas(pageX, pageY);                   // Convert page coordinates to canvas coordinates
            const gridLoc = this.canvasToGrid(canvasLoc.x, canvasLoc.y);         // Convert canvas coordinates to grid coordinates
            const dx = (gridLoc.x - this.sim.sensorX) * this.sim.pxPerSquare;    // Distance in x from sensor
            const dy = (gridLoc.y - this.sim.sensorY) * this.sim.pxPerSquare;    // Distance in y from sensor
            if (Math.sqrt(dx * dx + dy * dy) <= 8) {                             // If within dragging radius
                this.draggingSensor = true;                                       // Enable sensor dragging
            }
        }

        // Handle drawing, erasing, or pushing barriers based on mouse interaction
        this.mousePressDrag(e);
    }

    /**
     * Handles mouse move events on the canvas or touch move events on touch devices.
     * Updates barrier placement or sensor position based on user interaction.
     * 
     * @param e - The mouse or touch event
     */
    handleMouseMove(e: MouseEvent | TouchEvent): void {
        if (this.mouseIsDown) { // Only process if the mouse button is pressed or touch is active
            this.mousePressDrag(e); // Delegate to the mousePressDrag handler
        }
    }

    /**
     * Handles mouse up events anywhere on the page or touch end events on touch devices.
     * Resets interaction flags to stop dragging or drawing.
     */
    handleMouseUp(): void {
        this.mouseIsDown = false;     // Stop processing mouse movements
        this.draggingSensor = false;  // Stop sensor dragging
    }

    /**
     * Handles the logic for mouse press and drag interactions.
     * Depending on the selected mouse mode, it can draw, erase, or push barriers.
     * It can also move the sensor if dragging is active.
     * 
     * @param e - The mouse or touch event
     */
    mousePressDrag(e: MouseEvent | TouchEvent): void {
        e.preventDefault(); // Prevent default browser behavior (like scrolling)

        this.mouseIsDown = true; // Flag that the mouse is pressed

        let pageX: number, pageY: number;

        // Determine the type of event and extract coordinates
        if (e instanceof MouseEvent) {
            pageX = e.clientX;
            pageY = e.clientY;
        } else {
            const touch = e.touches[0];
            pageX = touch.clientX;
            pageY = touch.clientY;
        }

        // Convert page coordinates to canvas coordinates
        const canvasLoc = this.pageToCanvas(pageX, pageY);

        // If dragging the sensor, update its position
        if (this.draggingSensor) {
            const gridLoc = this.canvasToGrid(canvasLoc.x, canvasLoc.y); // Convert to grid coordinates
            this.sim.sensorX = gridLoc.x; // Update sensor X position
            this.sim.sensorY = gridLoc.y; // Update sensor Y position
            this.repaint();               // Redraw the simulation
            return;                       // Exit early since sensor is being moved
        }

        // Determine the current mouse interaction mode: 0=draw, 1=erase, 2=push
        const mouseMode = this.mouseSelect.selectedIndex;

        if (mouseMode === 2) { // Push mode
            this.mouseX = canvasLoc.x; // Update current mouse X
            this.mouseY = canvasLoc.y; // Update current mouse Y
            return;                     // Exit early since pushing will be handled elsewhere
        }

        // Convert canvas coordinates to grid coordinates for barrier manipulation
        const gridLoc = this.canvasToGrid(canvasLoc.x, canvasLoc.y);

        // Perform drawing or erasing based on the selected mode
        if (mouseMode === 0) {
            this.sim.addBarrier(gridLoc.x, gridLoc.y); // Add a barrier at the specified grid location
        } else {
            this.sim.removeBarrier(gridLoc.x, gridLoc.y); // Remove a barrier at the specified grid location
        }

        this.repaint(); // Update the rendering to reflect changes
    }

    /**
     * Converts page (screen) coordinates to canvas-relative coordinates.
     * Useful for determining where on the canvas the user has interacted.
     * 
     * @param pageX - The X-coordinate relative to the page
     * @param pageY - The Y-coordinate relative to the page
     * @returns An object containing the X and Y coordinates relative to the canvas
     */
    pageToCanvas(pageX: number, pageY: number): { x: number, y: number } {
        const rect = this.canvas.getBoundingClientRect(); // Get the canvas's position and size relative to the viewport
        return { x: pageX - rect.left, y: pageY - rect.top }; // Calculate canvas-relative coordinates
    }

    /**
     * Converts canvas-relative coordinates to grid coordinates based on the simulation's pixel density.
     * Useful for mapping user interactions on the canvas to the simulation grid.
     * 
     * @param canvasX - The X-coordinate relative to the canvas
     * @param canvasY - The Y-coordinate relative to the canvas
     * @returns An object containing the grid X and Y coordinates
     */
    canvasToGrid(canvasX: number, canvasY: number): { x: number, y: number } {
        const gridX = Math.floor(canvasX / this.sim.pxPerSquare); // Calculate grid X index
        const gridY = Math.floor(canvasY / this.sim.pxPerSquare); // Calculate grid Y index
        return { x: gridX, y: gridY }; // Return grid coordinates
    }

    /**
     * The main simulation loop. Executes collision, streaming, tracer movement, and rendering steps.
     * Handles user interactions like pushing fluid and collecting data.
     * Updates the Salmon entity based on user inputs (arrow keys).
     * Checks for simulation stability and handles restarting if necessary.
     */
    simulate(): void {
        // Retrieve simulation parameters from UI controls
        const stepsPerFrame = Number(this.stepsSlider.value);             // Number of simulation steps to execute per frame
        const u0 = Number(this.speedSlider.value);                         // Current speed value from the slider
        const viscosity = Number(this.viscSlider.value);                   // Current viscosity value from the slider
        const omega = 1 / (3 * viscosity + 0.5);                          // Relaxation parameter for collision step

        // Flags to determine which features to enable
        const doTracers = this.tracerCheck.checked;                       // Whether to move tracer particles
        const doFlowlines = this.flowlineCheck.checked;                   // Whether to draw flowlines
        const doForce = this.forceCheck.checked;                           // Whether to visualize forces
        const doSensor = this.sensorCheck.checked;                         // Whether to visualize the sensor
        const doCollectData = this.collectingData;                        // Whether to collect simulation data
        const curPlotType = this.plotSelect.selectedIndex;                // Current plot type selected
        const curContrast = Math.pow(1.2, Number(this.contrastSlider.value)); // Current contrast scaling factor

        // Apply boundary conditions based on the current speed
        this.sim.setBoundaries(u0);

        // Handle pushing fluid if in push mode and mouse is dragging
        let pushing = false; // Flag indicating whether fluid is being pushed
        let pushX = 0, pushY = 0; // Grid coordinates where fluid is being pushed
        let pushUX = 0, pushUY = 0; // Velocity components for the pushed fluid

        if (this.mouseIsDown && this.mouseSelect.selectedIndex === 2) { // If in push mode and mouse is pressed
            if (this.oldMouseX >= 0 && this.oldMouseY >= 0) { // Ensure previous mouse positions are valid
                const gridLoc = this.canvasToGrid(this.mouseX, this.mouseY); // Convert current mouse position to grid coordinates
                pushX = gridLoc.x; // Set push X coordinate
                pushY = gridLoc.y; // Set push Y coordinate

                // Calculate velocity components based on mouse movement since the last step
                pushUX = (this.mouseX - this.oldMouseX) / this.sim.pxPerSquare / stepsPerFrame;
                pushUY = -(this.mouseY - this.oldMouseY) / this.sim.pxPerSquare / stepsPerFrame;

                // Limit the push speed to prevent excessive disturbances
                if (Math.abs(pushUX) > 0.1) pushUX = 0.1 * Math.sign(pushUX);
                if (Math.abs(pushUY) > 0.1) pushUY = 0.1 * Math.sign(pushUY);

                pushing = true; // Enable pushing flag
            }

            this.oldMouseX = this.mouseX; // Update previous mouse X position
            this.oldMouseY = this.mouseY; // Update previous mouse Y position
        } else {
            this.oldMouseX = -1; // Reset previous mouse X position
            this.oldMouseY = -1; // Reset previous mouse Y position
        }

        // Execute the simulation steps for the current frame
        for (let step = 0; step < stepsPerFrame; step++) {
            this.sim.collide(omega);                      // Perform the collision step
            this.sim.stream();                            // Perform the streaming step
            this.sim.moveTracers(doTracers);              // Move tracer particles if enabled

            if (pushing) {                                 // If pushing fluid is active
                this.sim.pushFluid(pushX, pushY, pushUX, pushUY); // Inject fluid into the simulation
            }

            this.timeStep++;                               // Increment the time step counter

            // Handle period view for F_y (force in y-direction) oscillations
            if (this.showingPeriod && (this.sim.barrierFy > 0) && (this.lastBarrierFy <= 0)) {
                const thisFyOscTime = this.timeStep - this.sim.barrierFy / (this.sim.barrierFy - this.lastBarrierFy);
                if (this.lastFyOscTime > 0) {
                    const period = thisFyOscTime - this.lastFyOscTime; // Calculate the period between oscillations
                    this.dataArea.value += Number(period).toFixed(2) + "\n"; // Append the period to data area
                    this.dataArea.scrollTop = this.dataArea.scrollHeight;     // Scroll to the latest entry
                }
                this.lastFyOscTime = thisFyOscTime; // Update the last oscillation time
            }
            this.lastBarrierFy = this.sim.barrierFy; // Update the last recorded F_y force
        }

        // Update the Salmon entity based on user input (arrow keys)
        // Pass the current state of arrow keys to the Salmon's update method
        this.salmon.update(this.sim, {
            up: this.upPressed,
            down: this.downPressed,
            left: this.leftPressed,
            right: this.rightPressed
        });

        // Update the stamina display for the Salmon, if the corresponding DOM element exists
        const staminaElement = document.getElementById('fishStamina');
        if (staminaElement) {
            const percent = (100 * this.salmon.stamina / this.salmon.maxStamina).toFixed(0) + '%'; // Calculate stamina percentage
            staminaElement.textContent = percent; // Display the stamina percentage
        }

        // Repaint the canvas with the current simulation state and user-selected options
        this.renderer.paintCanvas(curPlotType, curContrast, doTracers, doFlowlines, doForce, doSensor);

        // If data collection is active, write the current data and handle termination after a threshold
        if (doCollectData) {
            this.writeData();                                      // Write current data to the data area
            if (this.timeStep >= 10000) this.startOrStopData();   // Stop data collection after 10,000 time steps
        }

        // Update the simulation speed readout based on elapsed time and step count
        if (this.running) {
            this.stepCount += stepsPerFrame; // Increment the total step count
            const elapsedTime = ((new Date()).getTime() - this.startTime) / 1000; // Calculate elapsed time in seconds
            this.speedReadout.innerHTML = String(Number(this.stepCount / elapsedTime).toFixed(0)); // Display steps per second
        }

        // Check for simulation stability; if unstable, alert the user and reset the simulation
        if (!this.sim.checkStability()) {
            alert("Simulation unstable.");      // Notify the user of instability
            this.startStop();                   // Pause the simulation
            this.sim.initFluid(Number(this.speedSlider.value)); // Reinitialize the fluid with current speed
        }

        // Continue the simulation loop if running
        if (this.running) {
            if (this.rafCheck.checked) { // If requestAnimationFrame is enabled
                window.requestAnimationFrame(() => this.simulate()); // Schedule the next simulation step
            } else {
                setTimeout(() => this.simulate(), 1); // Use a timeout as an alternative to RAF
            }
        }
    }

    /**
     * Performs a single collision and streaming step, then repaints the canvas.
     * Useful for stepping through the simulation manually.
     */
    collideStreamAndPaint(): void {
        // Retrieve simulation parameters from UI controls
        const stepsPerFrame = Number(this.stepsSlider.value);             // Number of simulation steps to execute
        const u0 = Number(this.speedSlider.value);                         // Current speed value from the slider
        const viscosity = Number(this.viscSlider.value);                   // Current viscosity value from the slider
        const omega = 1 / (3 * viscosity + 0.5);                          // Relaxation parameter for collision step

        // Apply boundary conditions based on the current speed
        this.sim.setBoundaries(u0);

        // Execute the simulation steps
        for (let step = 0; step < stepsPerFrame; step++) {
            this.sim.collide(omega);  // Perform the collision step
            this.sim.stream();        // Perform the streaming step
        }

        this.sim.moveTracers(this.tracerCheck.checked); // Move tracer particles if enabled

        this.repaint(); // Update the rendering to reflect changes
    }

    /**
     * Repaints the simulation canvas based on the current simulation state and user-selected options.
     * Also draws the Salmon entity on top of the simulation.
     */
    repaint(): void {
        // Retrieve current plot type and contrast scaling from UI controls
        const curPlotType = this.plotSelect.selectedIndex;                     // Current plot type selected
        const curContrast = Math.pow(1.2, Number(this.contrastSlider.value)); // Current contrast scaling factor

        // Paint the simulation canvas with selected options
        this.renderer.paintCanvas(
            curPlotType, 
            curContrast,
            this.tracerCheck.checked,    // Whether to draw tracers
            this.flowlineCheck.checked,  // Whether to draw flowlines
            this.forceCheck.checked,     // Whether to visualize forces
            this.sensorCheck.checked     // Whether to visualize the sensor
        );

        // After painting the fluid field, draw the Salmon entity
        this.renderer.drawSalmon(this.salmon);
    }
}
