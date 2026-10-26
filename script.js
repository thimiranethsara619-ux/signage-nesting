let uploadedSVG = null;

const fileInput = document.getElementById('svgFile');
const calculateBtn = document.getElementById('calculateBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const previewDiv = document.getElementById('preview');
const sheetWidthInput = document.getElementById('sheetWidth');
const sheetHeightInput = document.getElementById('sheetHeight');
const spacingInput = document.getElementById('spacing');
const unitSelect = document.getElementById('unitSelect');

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        uploadedSVG = event.target.result;
        statusDiv.textContent = `✅ File එක load වුණා: ${file.name}`;
        statusDiv.classList.add('active');
    };
    reader.readAsText(file);
});

calculateBtn.addEventListener('click', async () => {
    if (!uploadedSVG) {
        alert("මුලින්ම SVG file එකක් උඩුගත කරන්න!");
        return;
    }

    const multiplier = parseFloat(unitSelect.value);
    const unitText = unitSelect.options[unitSelect.selectedIndex].text;

    // තහඩුවේ ප්‍රමාණය mm වලට හරවනවා
    const sheetW = parseFloat(sheetWidthInput.value) * multiplier;
    const sheetH = parseFloat(sheetHeightInput.value) * multiplier;
    const spacing = parseFloat(spacingInput.value); 

    if (!sheetW || !sheetH) {
        alert("Sheet size එක හරියට දාන්න!");
        return;
    }

    calculateBtn.disabled = true;
    statusDiv.textContent = "⏳ ගණනය කරමින්...";
    statusDiv.classList.add('active');
    resultDiv.classList.remove('active');
    previewDiv.classList.remove('active');

    try {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(uploadedSVG, "image/svg+xml");
        
        // 1. මුලින්ම SVG එකේ සම්පූර්ණ ප්‍රමාණය (ViewBox) එක ගන්නවා
        const svgRoot = svgDoc.documentElement;
        const viewBox = svgRoot.getAttribute('viewBox');
        let svgW = 1000, svgH = 1000;
        
        if (viewBox) {
            const parts = viewBox.split(' ').map(Number);
            svgW = parts[2];
            svgH = parts[3];
        } else {
            svgW = parseFloat(svgRoot.getAttribute('width')) || 1000;
            svgH = parseFloat(svgRoot.getAttribute('height')) || 1000;
        }

        // 2. අපේ තහඩුවට ගැලපෙන්න කී ගුණයක් වැඩි කරන්න ඕනද කියලා හදනවා
        const scaleX = sheetW / svgW;
        const scaleY = sheetH / svgH;
        const scale = Math.min(scaleX, scaleY); // තහඩුවට ඇතුලත් වෙන්න ඕන නිසා අඩුම එක ගන්නවා

        // 3. අකුරු ටික ගන්නවා
        let shapes = Array.from(svgDoc.querySelectorAll('path, rect, circle, polygon, text'));
        
        // Sheet එකේ රාමුව (bin) අයින් කරනවා
        let binElement = svgDoc.querySelector('#bin') || svgDoc.querySelector('#sheet');
        if(binElement) shapes = shapes.filter(s => s !== binElement);

        if(shapes.length === 0) throw new Error("SVG එකේ අකුරු හම්බුණේ නෑ.");

        const items = [];

        shapes.forEach(shape => {
            // අකුරේ ප්‍රමාණය ගන්නවා
            const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            tempSvg.appendChild(shape.cloneNode(true));
            document.body.appendChild(tempSvg);
            const bbox = tempSvg.firstChild.getBBox(); 
            document.body.removeChild(tempSvg);

            if(bbox.width > 0 && bbox.height > 0) {
                // අපි අකුරේ ප්‍රමාණය තහඩුවේ ප්‍රමාණයට ගැලපෙන විදිහට වැඩි කරනවා
                let actualW = bbox.width * scale;
                let actualH = bbox.height * scale;

                items.push({
                    w: actualW + spacing, 
                    h: actualH + spacing,
                    origShape: shape,
                    origW: actualW,
                    origH: actualH,
                    scale: scale,
                    origX: bbox.x * scale,
                    origY: bbox.y * scale
                });
            }
        });

        // 4. Potpack එකෙන් හොඳම තැබීම හොයනවා
        const result = potpack(items);

        // 5. කීයක් Sheet යනවද ගණනය කරනවා
        const usedW = Math.ceil(result.w);
        const usedH = Math.ceil(result.h);
        
        const sheetsWise = Math.ceil(usedW / sheetW);
        const sheetsHigh = Math.ceil(usedH / sheetH);
        const totalSheets = Math.max(1, sheetsWise * sheetsHigh);

        resultDiv.innerHTML = `
            <h2>📊 ප්‍රතිඵලය</h2>
            <p><strong>යන Sheet ගණන:</strong> ${totalSheets} sheets</p>
            <p><strong>මුළු භාවිතා වූ ප්‍රමාණය:</strong> ${usedW.toFixed(0)} x ${usedH.toFixed(0)} (mm)</p>
            <p style="color: #666; font-size: 14px; margin-top: 15px;">
                Sheet size: ${sheetWidthInput.value} × ${sheetHeightInput.value} (${unitText}) <br>
                අකුරු අතර පරතරය: ${spacing} mm
            </p>
        `;
        resultDiv.classList.add('active');

        // 6. පින්තූරය අඳිනවා (Canvas)
        previewDiv.innerHTML = '';
        const canvas = document.createElement('canvas');
        
        // පින්තූරය ලස්සනට පේන්න ප්‍රමාණය හදනවා (Max 800px)
        const displayScale = Math.min(800 / usedW, 600 / usedH, 1);
        canvas.width = usedW * displayScale;
        canvas.height = usedH * displayScale;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        
        // තහඩු මායිම් අඳිනවා
        for(let i=0; i<=totalSheets; i++) {
            ctx.strokeRect(0, 0, sheetW * displayScale, sheetH * displayScale); 
        }

        // අකුරු අඳිනවා
        items.forEach(item => {
            const shape = item.origShape;
            ctx.save();
            
            // අකුරු හරි ප්‍රමාණයට ලොකු කරනවා
            ctx.scale(displayScale * item.scale, displayScale * item.scale);
            
            // අකුරු හරි තැනට තියනවා
            ctx.translate((item.x / item.scale) - (item.origX / item.scale), (item.y / item.scale) - (item.origY / item.scale));
            
            if (shape.tagName === 'path') {
                const path2d = new Path2D(shape.getAttribute('d'));
                ctx.fillStyle = '#000000'; 
                ctx.fill(path2d);
            } else if (shape.tagName === 'rect') {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, item.origW / item.scale, item.origH / item.scale);
            }
            ctx.restore();
        });

        previewDiv.appendChild(canvas);
        previewDiv.classList.add('active');
        
        statusDiv.textContent = `✅ අවසන්! Sheet ${totalSheets}ක් යනවා.`;
        calculateBtn.disabled = false;

    } catch (error) {
        console.error(error);
        statusDiv.textContent = `❌ Error: ${error.message}`;
        calculateBtn.disabled = false;
    }
});
