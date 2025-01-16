import { LBMSimulation } from "./LBMSimulation";
import { Salmon } from "./Salmon";

// Interface for color maps.
// Defines the structure for storing red, green, and blue color components.
interface ColorMaps {
  redList: Uint8Array;
  greenList: Uint8Array;
  blueList: Uint8Array;
}

/**
 * Renderer Class
 * 
 * This class is responsible for rendering the Lattice-Boltzmann simulation onto an HTML canvas.
 * It handles the visualization of different simulation aspects such as density, velocity fields,
 * tracers, flowlines, forces, sensors, and entities like the Salmon.
 */
export class Renderer {
    // Canvas rendering context used for drawing.
    context: CanvasRenderingContext2D; 
    
    // The HTML canvas element where the simulation is rendered.
    canvas: HTMLCanvasElement; 
    
    // Instance of the Lattice-Boltzmann simulation.
    sim: LBMSimulation; 
    
    // Optional instance of the Salmon entity within the simulation.
    salmon?: Salmon; 
    
    // Number of colors available in the color maps.
    nColors = 400; 
    
    // Arrays storing the red, green, and blue components for each color index.
    redList: Uint8Array; 
    greenList: Uint8Array; 
    blueList: Uint8Array; 

    /**
     * Constructor for the Renderer class.
     * Initializes the renderer with the provided canvas context, canvas element, and simulation instance.
     * Also generates the color maps used for visualizing different simulation parameters.
     * 
     * @param context - The 2D rendering context of the canvas.
     * @param canvas - The HTML canvas element where the simulation is drawn.
     * @param sim - The Lattice-Boltzmann simulation instance.
     */
    constructor(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, sim: LBMSimulation) {
        this.context = context;
        this.canvas = canvas;
        this.sim = sim;
        const {redList, greenList, blueList} = this.createColorMaps(this.nColors);
        this.redList = redList; 
        this.greenList = greenList; 
        this.blueList = blueList;
    }

    /**
     * Creates color maps for rendering the simulation.
     * Generates red, green, and blue color components based on the number of colors specified.
     * The color maps are used to map simulation data (like density or velocity) to specific colors.
     * 
     * @param nColors - The number of distinct colors to generate.
     * @returns An object containing redList, greenList, and blueList arrays.
     */
    createColorMaps(nColors: number): ColorMaps {
        const redList = new Uint8Array(nColors + 2);
        const greenList = new Uint8Array(nColors + 2);
        const blueList = new Uint8Array(nColors + 2);

        // Generate color maps based on the number of colors.
        for (let c = 0; c <= nColors; c++) {
            let r, g, b;
            if (c < nColors / 8) {
                // Transition from blue to cyan.
                r = 0; 
                g = 0; 
                b = Math.round(255 * (c + nColors / 8) / (nColors / 4));
            } else if (c < 3 * nColors / 8) {
                // Transition from cyan to green.
                r = 0; 
                g = Math.round(255 * (c - nColors / 8) / (nColors / 4)); 
                b = 255;
            } else if (c < 5 * nColors / 8) {
                // Transition from green to yellow.
                r = Math.round(255 * (c - 3 * nColors / 8) / (nColors / 4)); 
                g = 255; 
                b = 255 - r;
            } else if (c < 7 * nColors / 8) {
                // Transition from yellow to red.
                r = 255; 
                g = Math.round(255 * (7 * nColors / 8 - c) / (nColors / 4)); 
                b = 0;
            } else {
                // Transition from red to dark red.
                r = Math.round(255 * (9 * nColors / 8 - c) / (nColors / 4)); 
                g = 0; 
                b = 0;
            }
            redList[c] = r; 
            greenList[c] = g; 
            blueList[c] = b;
        }

        // Set the last color to black, typically used for barriers or out-of-range values.
        redList[nColors + 1] = 0; 
        greenList[nColors + 1] = 0; 
        blueList[nColors + 1] = 0;
        return { redList, greenList, blueList };
    }

    /**
     * Paints the entire canvas based on the current state of the simulation and user-selected options.
     * It visualizes different aspects like density, velocity fields, tracers, flowlines, forces, sensors, and the Salmon.
     * 
     * @param plotType - Determines which simulation parameter to visualize (e.g., density, velocity).
     * @param contrast - Scaling factor for adjusting the contrast of the visualization.
     * @param doTracers - Flag indicating whether to draw tracer particles.
     * @param doFlowlines - Flag indicating whether to draw flowlines.
     * @param doForce - Flag indicating whether to visualize forces.
     * @param doSensor - Flag indicating whether to visualize the sensor.
     */
    paintCanvas(
        plotType: number, 
        contrast: number,
        doTracers: boolean, 
        doFlowlines: boolean, 
        doForce: boolean, 
        doSensor: boolean
    ): void {
        // If the plot type is 4, compute the curl of the velocity field for visualization.
        if (plotType === 4) this.sim.computeCurl();

        // Create an ImageData object to manipulate pixel data directly.
        const image = this.context.createImageData(this.canvas.width, this.canvas.height);
        const data = image.data;
        const {xdim, ydim, barrier} = this.sim;

        // Iterate through each grid cell in the simulation.
        for (let y = 0; y < ydim; y++) {
            for (let x = 0; x < xdim; x++) {
                const i = x + y * xdim; // Linear index for the current grid cell.
                let cIndex: number;
                if (barrier[i]) {
                    // If the current cell is a barrier, use the last color (black).
                    cIndex = this.nColors + 1;
                } else {
                    // Otherwise, compute the color index based on the simulation data.
                    cIndex = this.computeColorIndex(x, y, plotType, contrast);
                }
                // Color the corresponding pixels for the current grid cell.
                this.colorSquare(x, y, this.redList[cIndex], this.greenList[cIndex], this.blueList[cIndex], data, image.width);
            }
        }

        // Render the ImageData onto the canvas.
        this.context.putImageData(image, 0, 0);

        // Draw additional simulation elements based on user preferences.
        if (doTracers) this.drawTracersOnCanvas();      // Draw tracer particles if enabled.
        if (doFlowlines) this.drawFlowlines();          // Draw flowlines if enabled.
        if (doForce && this.sim.barrierCount > 0) {    // Draw force arrows if enabled and barriers exist.
            this.drawForceArrow(
                this.sim.barrierxSum / this.sim.barrierCount, 
                this.sim.barrierySum / this.sim.barrierCount, 
                this.sim.barrierFx, 
                this.sim.barrierFy
            );
        }
        if (doSensor) this.drawSensor();               // Draw the sensor if enabled.

        // Draw the Salmon entity on top of the simulation if it exists.
        if (this.salmon) this.drawSalmon(this.salmon);
    }

    /**
     * Computes the color index for a given grid cell based on the selected plot type and contrast.
     * The color index is used to map simulation data to specific colors in the color maps.
     * 
     * @param x - The x-coordinate of the grid cell.
     * @param y - The y-coordinate of the grid cell.
     * @param plotType - The type of data to visualize (e.g., density, velocity).
     * @param contrast - The contrast scaling factor for the visualization.
     * @returns The computed color index corresponding to the simulation data.
     */
    computeColorIndex(x: number, y: number, plotType: number, contrast: number): number {
        const i = x + y * this.sim.xdim; // Linear index for the current grid cell.
        const {rho, ux, uy, curl} = this.sim; // Extract simulation data arrays.
        let cIndex: number;

        // Determine the color index based on the selected plot type.
        switch (plotType) {
            case 0:
                // Plot Type 0: Density visualization.
                cIndex = Math.round(this.nColors * ((rho[i] - 1) * 6 * contrast + 0.5));
                break;
            case 1:
                // Plot Type 1: Velocity in x-direction visualization.
                cIndex = Math.round(this.nColors * (ux[i] * 2 * contrast + 0.5));
                break;
            case 2:
                // Plot Type 2: Velocity in y-direction visualization.
                cIndex = Math.round(this.nColors * (uy[i] * 2 * contrast + 0.5));
                break;
            case 3: {
                // Plot Type 3: Speed (magnitude of velocity) visualization.
                const speed = Math.sqrt(ux[i] * ux[i] + uy[i] * uy[i]);
                cIndex = Math.round(this.nColors * (speed * 4 * contrast));
                break;
            }
            case 4:
                // Plot Type 4: Curl of the velocity field visualization.
                cIndex = Math.round(this.nColors * (curl[i] * 5 * contrast + 0.5));
                break;
            default:
                // Default to the first color if an unknown plot type is selected.
                cIndex = 0;
        }

        // Clamp the color index to ensure it stays within valid bounds.
        if (cIndex < 0) cIndex = 0; 
        if (cIndex > this.nColors) cIndex = this.nColors;
        return cIndex;
    }

    /**
     * Colors a square on the canvas corresponding to a grid cell.
     * Each grid cell may cover multiple pixels based on the simulation's pixel density.
     * 
     * @param x - The x-coordinate of the grid cell.
     * @param y - The y-coordinate of the grid cell.
     * @param r - Red component of the color.
     * @param g - Green component of the color.
     * @param b - Blue component of the color.
     * @param data - The ImageData's data array where pixel colors are stored.
     * @param imgWidth - The width of the ImageData, used to calculate pixel positions.
     */
    colorSquare(x: number, y: number, r: number, g: number, b: number, data: Uint8ClampedArray, imgWidth: number): void {
        const {pxPerSquare, xdim, ydim} = this.sim; // Extract simulation parameters.
        const flippedy = y; // No flipping of the y-axis.

        // Calculate the pixel boundaries for the current grid cell.
        const startY = flippedy * pxPerSquare;
        const endY = (flippedy + 1) * pxPerSquare;
        const startX = x * pxPerSquare;
        const endX = (x + 1) * pxPerSquare;

        // Iterate through each pixel within the grid cell's area.
        for (let py = startY; py < endY; py++) {
            for (let px = startX; px < endX; px++) {
                const index = (px + py * imgWidth) * 4; // Calculate the starting index for RGBA.
                data[index] = r;       // Set red component.
                data[index + 1] = g;   // Set green component.
                data[index + 2] = b;   // Set blue component.
                data[index + 3] = 255; // Set alpha component to fully opaque.
            }
        }
    }

    /**
     * Draws tracer particles on the canvas.
     * Tracers are small squares that move with the fluid flow, helping visualize the flow patterns.
     */
    drawTracersOnCanvas(): void {
        const { tracerX, tracerY, nTracers, pxPerSquare, xdim, ydim } = this.sim;
        this.context.fillStyle = "rgb(150,150,150)"; // Set tracer color to gray.

        // Iterate through each tracer particle.
        for (let t = 0; t < nTracers; t++) {
            // Calculate the canvas coordinates for the tracer.
            const canvasX = (tracerX[t] + 0.5) * pxPerSquare;
            const canvasY = (tracerY[t] + 0.5) * pxPerSquare;

            // Draw a small 2x2 pixel square for each tracer.
            this.context.fillRect(canvasX - 1, canvasY - 1, 2, 2);
        }
    }

    /**
     * Draws flowlines on the canvas.
     * Flowlines represent the direction and magnitude of the fluid flow, providing a visual understanding of flow patterns.
     */
    drawFlowlines(): void {
        const pxPerFlowline = this.getPxPerFlowline(); // Determine pixel density for flowlines.
        const { pxPerSquare, xdim, ydim, ux, uy } = this.sim;
        const sitesPerFlowline = pxPerFlowline / pxPerSquare; // Calculate grid cells per flowline.
        const xLines = this.canvas.width / pxPerFlowline;    // Number of flowlines horizontally.
        const yLines = this.canvas.height / pxPerFlowline;   // Number of flowlines vertically.
        const transBlackArray = this.createTransBlackArray(50); // Array for transparent black colors used in flowlines.

        // Iterate through each flowline position.
        for (let yCount = 0; yCount < yLines; yCount++) {
            for (let xCount = 0; xCount < xLines; xCount++) {
                // Calculate the grid coordinates for the current flowline.
                const x = Math.round((xCount + 0.5) * sitesPerFlowline);
                const y = Math.round((yCount + 0.5) * sitesPerFlowline);
                const thisUx = ux[x + y * xdim]; // Fluid velocity in x-direction at the flowline.
                const thisUy = uy[x + y * xdim]; // Fluid velocity in y-direction at the flowline.
                const speed = Math.sqrt(thisUx * thisUx + thisUy * thisUy); // Speed of the fluid at the flowline.

                if (speed > 0.0001) { // Only draw flowlines where the speed is significant.
                    const px = (xCount + 0.5) * pxPerFlowline; // Canvas x-coordinate for the flowline.
                    const py = (yCount + 0.5) * pxPerFlowline; // Canvas y-coordinate for the flowline.

                    const scale = 0.5 * pxPerFlowline / speed; // Scale factor for the flowline based on speed.
                    this.context.beginPath();
                    // Draw a line representing the flow direction and magnitude.
                    this.context.moveTo(px - thisUx * scale, py + thisUy * scale);
                    this.context.lineTo(px + thisUx * scale, py - thisUy * scale);

                    // Determine the color index based on the flow speed.
                    let cIndex = Math.round(speed * transBlackArray.length / 0.3);
                    if (cIndex >= transBlackArray.length) cIndex = transBlackArray.length - 1;

                    // Set the stroke style with transparency based on speed.
                    this.context.strokeStyle = transBlackArray[cIndex];
                    this.context.stroke();
                }
            }
        }
    }

    /**
     * Determines the pixel density for flowlines based on the simulation's pixel per square value.
     * This helps in adjusting the spacing between flowlines for different simulation resolutions.
     * 
     * @returns The number of pixels per flowline.
     */
    getPxPerFlowline(): number {
        const p = this.sim.pxPerSquare; // Pixels per simulation grid square.
        switch (p) {
            case 1: return 6;
            case 2: return 8;
            case 5: return 12;
            case 6:
            case 8: return 15;
            case 10: return 20;
            default: return 10;
        }
    }

    /**
     * Creates an array of transparent black colors.
     * These colors are used to vary the transparency of flowlines based on flow speed.
     * 
     * @param size - The number of transparent shades to generate.
     * @returns An array of RGBA color strings with varying transparency.
     */
    createTransBlackArray(size: number): string[] {
        const array: string[] = [];
        for (let i = 0; i < size; i++) {
            // Generate RGBA strings with increasing transparency.
            array[i] = `rgba(0,0,0,${(i / size).toFixed(2)})`;
        }
        return array;
    }

    /**
     * Draws a force arrow on the canvas to represent the net force acting on the barriers.
     * The arrow's direction and length correspond to the force's direction and magnitude.
     * 
     * @param x - The x-coordinate of the force's origin point on the grid.
     * @param y - The y-coordinate of the force's origin point on the grid.
     * @param Fx - The force component in the x-direction.
     * @param Fy - The force component in the y-direction.
     */
    drawForceArrow(x: number, y: number, Fx: number, Fy: number): void {
        const { pxPerSquare } = this.sim; // Pixels per simulation grid square.

        // Set the fill style for the force arrow.
        this.context.fillStyle = "rgba(100,100,100,0.7)";
        
        // Save the current context state before transformations.
        this.context.save();
        
        // Translate the context to the origin point of the force arrow.
        this.context.translate((x + 0.5) * pxPerSquare, (y + 0.5) * pxPerSquare);

        // Calculate the magnitude of the force vector.
        const magF = Math.sqrt(Fx * Fx + Fy * Fy);
        
        // Scale the arrow based on the magnitude of the force to visually represent its strength.
        this.context.scale(4 * magF, 4 * magF);
        
        // Rotate the context to align the arrow with the direction of the force.
        this.context.rotate(Math.atan2(-Fy, Fx));
        
        // Define the shape of the arrow.
        this.context.beginPath();
        this.context.moveTo(0, 3); 
        this.context.lineTo(100, 3); 
        this.context.lineTo(100, 12);
        this.context.lineTo(130, 0); 
        this.context.lineTo(100, -12); 
        this.context.lineTo(100, -3);
        this.context.lineTo(0, -3); 
        this.context.lineTo(0, 3);
        
        // Fill the arrow shape.
        this.context.fill();
        
        // Restore the context to its original state.
        this.context.restore();
    }

    /**
     * Draws the sensor on the canvas.
     * The sensor is represented as a circle with cross lines and an information box displaying sensor data.
     */
    drawSensor(): void {
        const { pxPerSquare, sensorX, sensorY, xdim, rho, ux, uy } = this.sim;
        const canvasX = (sensorX + 0.5) * pxPerSquare; // Calculate canvas x-coordinate for the sensor.
        const canvasY = (sensorY + 0.5) * pxPerSquare; // Calculate canvas y-coordinate for the sensor.

        // Draw the sensor as a semi-transparent gray circle.
        this.context.fillStyle = "rgba(180,180,180,0.7)";
        this.context.beginPath();
        this.context.arc(canvasX, canvasY, 7, 0, 2 * Math.PI);
        this.context.fill();

        // Draw cross lines over the sensor for better visibility.
        this.context.strokeStyle = "#404040"; // Set stroke color to dark gray.
        this.context.lineWidth = 1;           // Set line width.
        this.context.beginPath();
        this.context.moveTo(canvasX, canvasY - 10); // Vertical line upwards.
        this.context.lineTo(canvasX, canvasY + 10); // Vertical line downwards.
        this.context.moveTo(canvasX - 10, canvasY); // Horizontal line to the left.
        this.context.lineTo(canvasX + 10, canvasY); // Horizontal line to the right.
        this.context.stroke(); // Render the cross lines.

        // Draw the information box displaying sensor data.
        this.context.fillStyle = "rgba(255,255,255,0.5)"; // Semi-transparent white background.
        this.context.font = "12px Monospace";            // Set font for text.
        const rectWidth = this.context.measureText("00000000000").width + 6; // Calculate width based on text.
        const rectHeight = 58; // Fixed height for the information box.
        let tx = canvasX + 10; 
        let ty = canvasY;

        // Adjust the position of the information box if it goes beyond the canvas boundaries.
        if (tx + rectWidth > this.canvas.width) tx -= (rectWidth + 20);
        if (ty + rectHeight > this.canvas.height) ty = this.canvas.height - rectHeight;
        this.context.fillRect(tx, ty, rectWidth, rectHeight); // Draw the rectangle.

        // Set text color to black for readability.
        this.context.fillStyle = "#000000";
        tx += 3; 
        ty += 12;

        // Calculate the linear index for the sensor's grid position.
        const i = sensorX + sensorY * xdim;

        // Display the sensor's coordinates.
        const rhoSymbol = String.fromCharCode(parseInt('03C1', 16)); // Greek letter rho (ρ).
        this.context.fillText(" (" + sensorX + "," + sensorY + ")", tx, ty);
        ty += 14;

        // Display the density (rho) at the sensor's location.
        this.context.fillText(" " + rhoSymbol + " = " + Number(rho[i]).toFixed(3), tx, ty);
        ty += 14;

        // Display the velocity components (ux and uy) at the sensor's location.
        let digitString = Number(ux[i]).toFixed(3);
        if (ux[i] >= 0) digitString = " " + digitString; // Add space for alignment if positive.
        this.context.fillText("ux = " + digitString, tx, ty);
        ty += 14;
        digitString = Number(uy[i]).toFixed(3);
        if (uy[i] >= 0) digitString = " " + digitString; // Add space for alignment if positive.
        this.context.fillText("uy = " + digitString, tx, ty);
    }

    /**
     * Draws the Salmon entity on the canvas.
     * The Salmon is represented as a red circle with a stamina bar above it.
     * 
     * @param salmon - The Salmon instance to be drawn.
     */
    drawSalmon(salmon: Salmon): void {
        const { pxPerSquare } = this.sim; // Pixels per simulation grid square.
        const canvasX = (salmon.x + 0.5) * pxPerSquare; // Calculate canvas x-coordinate for the Salmon.
        const canvasY = (salmon.y + 0.5) * pxPerSquare; // Calculate canvas y-coordinate for the Salmon.

        // Draw the Salmon as a red circle.
        this.context.fillStyle = "red";
        this.context.beginPath();
        this.context.arc(canvasX, canvasY, salmon.length / 2, 0, 2 * Math.PI);
        this.context.fill();

        // Draw the stamina bar above the Salmon.
        const barWidth = 20; // Width of the stamina bar in pixels.
        const barHeight = 4; // Height of the stamina bar in pixels.
        const staminaRatio = salmon.stamina / salmon.maxStamina; // Calculate stamina as a ratio.

        // Draw the background of the stamina bar (black).
        this.context.fillStyle = "black";
        this.context.fillRect(canvasX - barWidth / 2, canvasY - salmon.length - 10, barWidth, barHeight);
        
        // Draw the current stamina level (green).
        this.context.fillStyle = "green";
        this.context.fillRect(canvasX - barWidth / 2, canvasY - salmon.length - 10, barWidth * staminaRatio, barHeight);
    }
}
