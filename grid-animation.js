class BioGrid {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = [];
        this.connections = [];
        this.mouse = { x: -1000, y: -1000 };
        this.time = 0;
        
        this.init();
        this.bindEvents();
        this.animate();
    }

    init() {
        this.resize();
    }

    bindEvents() {
        window.addEventListener('resize', () => this.resize());
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mousedown', (e) => {
            this.pulse(e.clientX, e.clientY);
        });

        window.addEventListener('touchmove', (e) => {
            this.mouse.x = e.touches[0].clientX;
            this.mouse.y = e.touches[0].clientY;
        }, { passive: true });
        
        window.addEventListener('touchstart', (e) => {
            this.mouse.x = e.touches[0].clientX;
            this.mouse.y = e.touches[0].clientY;
            this.pulse(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.createGrid();
    }

    createGrid() {
        this.nodes = [];
        this.connections = [];
        
        const spacing = 60; 
        const jitter = 0.5; 
        
        const cols = Math.ceil(this.width / spacing) + 1;
        const rows = Math.ceil(this.height / spacing) + 1;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let px = x * spacing;
                let py = y * spacing;
                
                px += (Math.random() - 0.5) * spacing * jitter;
                py += (Math.random() - 0.5) * spacing * jitter;

                this.nodes.push({
                    x: px,
                    y: py,
                    baseX: px, 
                    baseY: py,
                    phase: Math.random() * Math.PI * 2,
                    speed: 0.002 + Math.random() * 0.003,
                    charge: 0,
                    lifeCheck: Math.random(), 
                    size: Math.random() * 2 + 1
                });
            }
        }

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            for (let j = i + 1; j < this.nodes.length; j++) {
                const other = this.nodes[j];
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                
                const threshold = spacing * 1.5;
                if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) continue;

                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < threshold) {
                    this.connections.push({
                        a: node,
                        b: other,
                        length: dist,
                        curvePhase: Math.random() * Math.PI * 2,
                        curveStrength: (Math.random() - 0.5) * 20
                    });
                }
            }
        }
    }

    pulse(x, y) {
        const pulseRadius = 400;
        this.nodes.forEach(node => {
            const dx = x - node.x;
            const dy = y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < pulseRadius) {
                const intensity = 1 - (dist / pulseRadius);
                node.charge = Math.min(node.charge + intensity, 1);
            }
        });
    }

    update() {
        this.time += 1;
        const chargeRadius = 200; 
        const chargeAmount = 0.15; 
        const decay = 0.985;

        this.nodes.forEach(node => {
            node.x = node.baseX + Math.cos(this.time * node.speed + node.phase) * 15;
            node.y = node.baseY + Math.sin(this.time * node.speed + node.phase) * 15;

            const dx = this.mouse.x - node.x;
            const dy = this.mouse.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < chargeRadius) {
                const intensity = 1 - (dist / chargeRadius);
                node.charge = Math.min(node.charge + (intensity * chargeAmount), 1);
            }

            if (Math.random() < 0.00002) { 
                node.charge = Math.min(node.charge + 0.5, 1); 
            }

            node.charge *= decay;
            
            const idleLevel = 0.05 + Math.sin(this.time * 0.002 + node.phase) * 0.02; 
            if (node.charge < idleLevel) node.charge = idleLevel;
        });
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.lineWidth = 1;

        // OPTIMIZATION: Batch connection drawing by opacity to reduce draw calls
        // Opacity buckets from 0 to 10 (opacity 0.0 to 0.35)
        const buckets = Array(10).fill(null).map(() => []); 
        
        this.connections.forEach(conn => {
            const avgCharge = (conn.a.charge + conn.b.charge) / 2;
            if (avgCharge <= 0.08) return;

            // Check distance
            const dx = conn.b.x - conn.a.x;
            const dy = conn.b.y - conn.a.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > (conn.length * 1.5) ** 2) return;

            // Determine bucket index (0-9)
            // Max opacity is ~0.35 (avgCharge 1.0 * 0.35)
            // We map avgCharge (0.08 to 1.0) to buckets
            const bucketIndex = Math.min(Math.floor(avgCharge * 10), 9);
            buckets[bucketIndex].push({ conn, dx, dy, distSq });
        });

        // Render buckets
        buckets.forEach((bucket, index) => {
            if (bucket.length === 0) return;

            // Calculate opacity for this bucket
            // index 0 is charge 0.0-0.1, index 9 is charge 0.9-1.0
            // Approximate charge as mid-bucket value
            const chargeLevel = (index + 0.5) / 10;
            const opacity = chargeLevel * 0.5; // Increased opacity for light mode

            this.ctx.beginPath();
            this.ctx.strokeStyle = `rgba(76, 122, 40, ${opacity})`; // Darker green for light mode

            bucket.forEach(item => {
                const { conn, dx, dy, distSq } = item;
                
                this.ctx.moveTo(conn.a.x, conn.a.y);

                const midX = (conn.a.x + conn.b.x) / 2;
                const midY = (conn.a.y + conn.b.y) / 2;

                const dist = Math.sqrt(distSq);
                const normalX = -dy / dist;
                const normalY = dx / dist;

                const flex = Math.sin(this.time * 0.005 + conn.curvePhase) * 5;
                const offsetMagnitude = conn.curveStrength + flex;
                
                const cpX = midX + normalX * offsetMagnitude;
                const cpY = midY + normalY * offsetMagnitude;

                this.ctx.quadraticCurveTo(cpX, cpY, conn.b.x, conn.b.y);
            });
            
            this.ctx.stroke();
        });

        // Draw Nodes
        this.nodes.forEach(node => {
            // OPTIMIZATION: Skip drawing very faint nodes if performance needed
            // But visual consistency matters.
            
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, node.size + (node.charge * 2), 0, Math.PI * 2);
            
            if (node.charge > 0.3) {
                this.ctx.fillStyle = `rgba(143, 209, 79, ${node.charge})`; 
            } else {
                this.ctx.fillStyle = `rgba(76, 122, 40, ${node.charge + 0.2})`; // Darker green base
            }
            this.ctx.fill();

            if (node.charge > 0.5) {
                const glowSize = node.charge * 12;
                // Standard alpha blend for light mode
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, glowSize, 0, Math.PI * 2);
                this.ctx.fillStyle = `rgba(143, 209, 79, ${node.charge * 0.2})`;
                this.ctx.fill();
            }
        });
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none'; 
    document.body.prepend(canvas);

    new BioGrid(canvas);
});
