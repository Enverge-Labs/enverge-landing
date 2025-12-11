class CO2Forest {
    constructor(container) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.trees = [];
        this.particles = [];
        this.mouse = { x: 0, y: 0 };
        this.co2Value = 0;
        this.kwhValue = 0;
        this.gpuCount = 1;
        this.targetTreeCount = 0;
        this.time = 0;
        
        this.setupCanvas();
        this.bindEvents();
        this.animate();
    }

    setupCanvas() {
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.pointerEvents = 'none';
        this.container.style.position = 'relative';
        this.container.insertBefore(this.canvas, this.container.firstChild);
        this.resize();
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        this.container.addEventListener('mousemove', (e) => {
            const rect = this.container.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;
        this.canvas.width = this.width * window.devicePixelRatio;
        this.canvas.height = this.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    updateValues(co2, kwh, gpuCount, hours) {
        this.co2Value = co2;
        this.kwhValue = kwh;
        this.gpuCount = gpuCount;
        this.hours = hours;
        
        // Calculate target tree count based on CO2 (1 tree per 5kg CO2, min 1)
        this.targetTreeCount = Math.max(1, Math.min(Math.floor(co2 / 5) + gpuCount, 40));
        
        // Grow trees to match target
        while (this.trees.length < this.targetTreeCount) {
            this.addTree();
        }
        // Shrink trees smoothly (mark for removal rather than instant pop)
        while (this.trees.length > this.targetTreeCount && this.trees.length > 1) {
            this.trees.pop();
        }
        
        // Update tree heights based on hours (more hours = taller trees)
        const heightMultiplier = 0.3 + Math.min(hours / 150, 1.2);
        this.trees.forEach(tree => {
            tree.targetHeight = tree.baseHeight * heightMultiplier;
        });
        
        // Update seasonal colors based on kWh
        this.updateSeasonalColors();
    }

    updateSeasonalColors() {
        // Spring green → Deep forest green based on kWh
        const intensity = Math.min(this.kwhValue / 500, 1);
        this.trees.forEach(tree => {
            tree.colorIntensity = intensity;
        });
    }

    addTree() {
        const x = 20 + Math.random() * (this.width - 40);
        const baseHeight = 40 + Math.random() * 60;
        
        this.trees.push({
            x: x,
            y: this.height - 5, // Slight offset from bottom
            baseHeight: baseHeight,
            targetHeight: baseHeight,
            currentHeight: 0,
            width: 10 + Math.random() * 10,
            phase: Math.random() * Math.PI * 2,
            swaySpeed: 0.5 + Math.random() * 0.5,
            layers: 3 + Math.floor(Math.random() * 2),
            colorIntensity: 0,
            growthProgress: 0,
            type: Math.floor(Math.random() * 3), // Different tree styles
            isSeed: true // Start as seed
        });
    }
    
    addSeed() {
        if (this.trees.length >= 5) return; // Max 5 seeds initially
        
        const x = 30 + Math.random() * (this.width - 60);
        this.trees.push({
            x: x,
            y: this.height - 5,
            baseHeight: 15,
            targetHeight: 15,
            currentHeight: 0,
            width: 6,
            phase: Math.random() * Math.PI * 2,
            swaySpeed: 1,
            layers: 1,
            colorIntensity: 0,
            growthProgress: 0,
            type: 0,
            isSeed: true
        });
    }

    addParticle(x, y) {
        if (this.particles.length > 100) return;
        
        this.particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -Math.random() * 1 - 0.5,
            life: 1,
            size: 2 + Math.random() * 3,
            hue: 80 + Math.random() * 40 // Green-yellow range
        });
    }

    update() {
        this.time += 0.016;
        
        // Update trees
        this.trees.forEach(tree => {
            // Grow animation
            if (tree.growthProgress < 1) {
                tree.growthProgress = Math.min(tree.growthProgress + 0.02, 1);
            }
            
            // Smooth height transition
            tree.currentHeight += (tree.targetHeight - tree.currentHeight) * 0.05;
            
            // Calculate mouse influence for sway
            const dx = this.mouse.x - tree.x;
            const dy = this.mouse.y - (tree.y - tree.currentHeight / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const influence = Math.max(0, 1 - dist / 200);
            
            tree.mouseInfluence = influence;
            
            // Spawn photosynthesis particles
            if (Math.random() < 0.02 * tree.growthProgress && this.co2Value > 0) {
                const particleY = tree.y - tree.currentHeight * (0.3 + Math.random() * 0.6);
                this.addParticle(tree.x + (Math.random() - 0.5) * tree.width * 2, particleY);
            }
        });
        
        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy -= 0.01; // Slight upward drift
            p.life -= 0.015;
            return p.life > 0;
        });
    }

    drawTree(tree) {
        const ctx = this.ctx;
        const progress = this.easeOutElastic(tree.growthProgress);
        const height = tree.currentHeight * progress;
        
        if (height < 1) return;
        
        // Calculate sway
        const baseSway = Math.sin(this.time * tree.swaySpeed + tree.phase) * 3;
        const mouseSway = (tree.mouseInfluence || 0) * (this.mouse.x - tree.x) * 0.05;
        const totalSway = baseSway + mouseSway;
        
        // Color based on seasonal intensity
        const baseHue = 95 + tree.colorIntensity * 35; // 95 (spring) to 130 (deep green)
        const saturation = 55 + tree.colorIntensity * 25;
        const lightness = 48 - tree.colorIntensity * 12;
        
        ctx.save();
        ctx.translate(tree.x, tree.y);
        
        // Draw as seed/sprout if very small
        if (tree.isSeed && height < 20) {
            this.drawSprout(ctx, height, totalSway, baseHue, saturation, lightness);
            ctx.restore();
            return;
        }
        
        // Transition from seed to tree
        tree.isSeed = false;
        
        // Draw trunk
        const trunkHeight = height * 0.25;
        const trunkGradient = ctx.createLinearGradient(0, 0, 0, -trunkHeight);
        trunkGradient.addColorStop(0, `hsl(25, 35%, ${30 + tree.colorIntensity * 8}%)`);
        trunkGradient.addColorStop(1, `hsl(30, 30%, ${22 + tree.colorIntensity * 5}%)`);
        ctx.fillStyle = trunkGradient;
        ctx.beginPath();
        ctx.moveTo(-tree.width * 0.12, 0);
        ctx.lineTo(-tree.width * 0.08 + totalSway * 0.1, -trunkHeight);
        ctx.lineTo(tree.width * 0.08 + totalSway * 0.1, -trunkHeight);
        ctx.lineTo(tree.width * 0.12, 0);
        ctx.closePath();
        ctx.fill();
        
        // Draw geometric foliage layers
        const foliageHeight = height * 0.85;
        const layerHeight = foliageHeight / tree.layers;
        
        for (let i = 0; i < tree.layers; i++) {
            const layerY = -trunkHeight - (i * layerHeight * 0.65);
            const layerWidth = tree.width * (1.1 - i * 0.18);
            const layerSway = totalSway * (1 + i * 0.35);
            
            // Gradient color per layer (darker at bottom, lighter at top)
            const layerLightness = lightness + i * 6;
            const layerSaturation = saturation - i * 5;
            
            ctx.fillStyle = `hsl(${baseHue}, ${layerSaturation}%, ${layerLightness}%)`;
            
            ctx.beginPath();
            if (tree.type === 0) {
                // Triangle tree (pine style)
                ctx.moveTo(layerSway, layerY - layerHeight);
                ctx.lineTo(-layerWidth + layerSway * 0.5, layerY);
                ctx.lineTo(layerWidth + layerSway * 0.5, layerY);
            } else if (tree.type === 1) {
                // Diamond/geometric tree
                ctx.moveTo(layerSway, layerY - layerHeight);
                ctx.lineTo(-layerWidth * 0.7 + layerSway * 0.5, layerY - layerHeight * 0.45);
                ctx.lineTo(-layerWidth + layerSway * 0.3, layerY);
                ctx.lineTo(layerWidth + layerSway * 0.3, layerY);
                ctx.lineTo(layerWidth * 0.7 + layerSway * 0.5, layerY - layerHeight * 0.45);
            } else {
                // Rounded organic
                const cp = layerHeight * 0.35;
                ctx.moveTo(layerSway, layerY - layerHeight);
                ctx.bezierCurveTo(
                    -layerWidth * 0.3 + layerSway * 0.7, layerY - layerHeight * 0.8,
                    -layerWidth * 0.8 + layerSway * 0.4, layerY - cp,
                    -layerWidth + layerSway * 0.3, layerY
                );
                ctx.lineTo(layerWidth + layerSway * 0.3, layerY);
                ctx.bezierCurveTo(
                    layerWidth * 0.8 + layerSway * 0.4, layerY - cp,
                    layerWidth * 0.3 + layerSway * 0.7, layerY - layerHeight * 0.8,
                    layerSway, layerY - layerHeight
                );
            }
            ctx.closePath();
            ctx.fill();
            
            // Add subtle inner highlight
            ctx.fillStyle = `hsla(${baseHue + 15}, ${layerSaturation + 10}%, ${layerLightness + 15}%, 0.25)`;
            ctx.beginPath();
            ctx.ellipse(layerSway * 0.4, layerY - layerHeight * 0.55, layerWidth * 0.25, layerHeight * 0.2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    drawSprout(ctx, height, sway, hue, sat, light) {
        // Draw stem
        ctx.strokeStyle = `hsl(${hue + 10}, ${sat - 10}%, ${light + 5}%)`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(sway * 0.5, -height * 0.5, sway, -height);
        ctx.stroke();
        
        // Draw small leaves
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        
        // Left leaf
        ctx.beginPath();
        ctx.ellipse(sway - 4, -height * 0.7, 5, 3, -0.5 + sway * 0.05, 0, Math.PI * 2);
        ctx.fill();
        
        // Right leaf
        ctx.beginPath();
        ctx.ellipse(sway + 4, -height * 0.8, 5, 3, 0.5 + sway * 0.05, 0, Math.PI * 2);
        ctx.fill();
        
        // Tip bud
        ctx.fillStyle = `hsl(${hue + 20}, ${sat + 10}%, ${light + 10}%)`;
        ctx.beginPath();
        ctx.arc(sway, -height, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawParticle(p) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${p.life * 0.6})`;
        ctx.fill();
        
        // Subtle glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life * 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 70%, ${p.life * 0.2})`;
        ctx.fill();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw ground first
        this.drawGround();
        
        // Sort trees by x position for slight depth variation
        const sortedTrees = [...this.trees].sort((a, b) => a.x - b.x);
        
        // Draw trees
        sortedTrees.forEach(tree => this.drawTree(tree));
        
        // Draw particles on top
        this.particles.forEach(p => this.drawParticle(p));
    }
    
    drawGround() {
        const ctx = this.ctx;
        const groundY = this.height - 8;
        
        // Ground gradient
        const gradient = ctx.createLinearGradient(0, groundY - 15, 0, this.height);
        gradient.addColorStop(0, 'rgba(139, 195, 74, 0)');
        gradient.addColorStop(0.5, 'rgba(139, 195, 74, 0.08)');
        gradient.addColorStop(1, 'rgba(101, 163, 13, 0.15)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, groundY - 15, this.width, 23);
        
        // Draw grass blades
        ctx.strokeStyle = 'rgba(139, 195, 74, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        
        for (let i = 0; i < this.width; i += 8) {
            const grassHeight = 6 + Math.sin(i * 0.1 + this.time * 0.5) * 3;
            const grassSway = Math.sin(this.time * 0.8 + i * 0.05) * 2;
            
            ctx.beginPath();
            ctx.moveTo(i, groundY);
            ctx.quadraticCurveTo(i + grassSway * 0.5, groundY - grassHeight * 0.5, i + grassSway, groundY - grassHeight);
            ctx.stroke();
        }
    }

    easeOutElastic(t) {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// Stats tooltip functionality
class ForestStats {
    constructor(forest) {
        this.forest = forest;
        this.tooltip = null;
        this.createTooltip();
        this.bindEvents();
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'forest-tooltip';
        this.tooltip.style.cssText = `
            position: absolute;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(139, 195, 74, 0.3);
            border-radius: 12px;
            padding: 12px 16px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 100;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            min-width: 180px;
        `;
        this.forest.container.appendChild(this.tooltip);
    }

    bindEvents() {
        this.forest.canvas.style.pointerEvents = 'auto';
        
        this.forest.container.addEventListener('mousemove', (e) => {
            const rect = this.forest.container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Find clicked tree
            const tree = this.findTreeAt(x, y);
            if (tree) {
                this.showTooltip(e.clientX - rect.left, e.clientY - rect.top, tree);
            } else {
                this.hideTooltip();
            }
        });

        this.forest.container.addEventListener('mouseleave', () => {
            this.hideTooltip();
        });
    }

    findTreeAt(x, y) {
        return this.forest.trees.find(tree => {
            const dx = Math.abs(x - tree.x);
            const dy = tree.y - y;
            return dx < tree.width * 2 && dy > 0 && dy < tree.currentHeight;
        });
    }

    showTooltip(x, y, tree) {
        const co2PerTree = (this.forest.co2Value / Math.max(this.forest.trees.length, 1)).toFixed(2);
        const kwhPerTree = (this.forest.kwhValue / Math.max(this.forest.trees.length, 1)).toFixed(2);
        
        // Lucide tree-deciduous icon
        this.tooltip.innerHTML = `
            <div style="font-weight: 600; color: #166534; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/></svg>
                Tree Impact
            </div>
            <div style="color: #15803d; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8BC34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
                <strong>${co2PerTree} kg</strong> CO₂ absorbed
            </div>
            <div style="color: #15803d; display: flex; align-items: center; gap: 4px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8BC34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                <strong>${kwhPerTree} kWh</strong> clean energy
            </div>
        `;
        
        this.tooltip.style.left = `${Math.min(x + 10, this.forest.width - 200)}px`;
        this.tooltip.style.top = `${Math.max(y - 90, 10)}px`;
        this.tooltip.style.opacity = '1';
    }

    hideTooltip() {
        this.tooltip.style.opacity = '0';
    }
}

// Initialize when DOM is ready
let forestInstance = null;
let forestStats = null;

function initForest() {
    const forestContainer = document.getElementById('forest-visualization');
    if (!forestContainer) return;
    
    forestInstance = new CO2Forest(forestContainer);
    forestStats = new ForestStats(forestInstance);
    
    // Initial render with default values
    forestInstance.updateValues(0.15, 0.3, 1, 1);
}

function updateForest(co2, kwh, gpuCount, hours) {
    if (!forestInstance) {
        initForest();
    }
    if (forestInstance) {
        forestInstance.updateValues(co2, kwh, gpuCount, hours);
    }
}

document.addEventListener('DOMContentLoaded', initForest);
