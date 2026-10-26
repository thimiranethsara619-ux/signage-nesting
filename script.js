// SVGNest library එක load වෙලාද බලන්න
let nestLib = null;
try {
    // svgnest CDN එකේ global variable එක
    nestLib = window.SvgNest || null;
} catch(e) {
    console.log("SVGNest library not loaded yet");
}

const fileInput = document.getElementById('svgFile');
const calculateBtn = document.getElementById('calculateBtn');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');
const previewDiv = document.getElementById('preview');
const sheetWidthInput = document.getElementById('sheetWidth');
const sheetHeightInput = document.getElementById('sheetHeight');
const spacingInput = document.getElementById('spacing');
const rotationsSelect = document.getElementById('rotations');

let uploadedSVG = null;

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

    const sheetW = parseFloat(sheetWidthInput.value);
    const sheetH = parseFloat(sheetHeightInput.value);
    const spacing = parseFloat(spacingInput.value);
    const rotations = parseInt(rotationsSelect.value);

    if (!sheetW || !sheetH) {
        alert("Sheet size එක හරියට දාන්න!");
        return;
    }

    calculateBtn.disabled = true;
    statusDiv.textContent = "⏳ ගණනය කරමින්... (ටිකක් වෙලා ගන්නවා)";
    statusDiv.classList.add('active');
    resultDiv.classList.remove('active');
    previewDiv.classList.remove('active');

    try {
        // SVG එක parse කරන්න
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(uploadedSVG, "image/svg+xml");
        const svgRoot = svgDoc.documentElement;

        // Sheet එකේ rectangle එක හොයන්න (id="bin" හෝ id="sheet" තියෙන එක)
        let binElement = svgDoc.querySelector('#bin') || 
                         svgDoc.querySelector('#sheet') || 
                         svgDoc.querySelector('rect');

        if (!binElement) {
            // Rectangle එකක් නැත්නම්, අපි අලුතෙන් හදනවා
            binElement = svgDoc.createElementNS("http://www.w3.org/2000/svg", "rect");
            binElement.setAttribute("width", sheetW);
            binElement.setAttribute("height", sheetH);
            binElement.setAttribute("fill", "none");
            binElement.setAttribute("stroke", "black");
            binElement.setAttribute("id", "bin");
            svgRoot.appendChild(binElement);
        }

        // Bin එකේ size එක override කරන්න (user දුන්න size එකට)
        binElement.setAttribute("width", sheetW);
        binElement.setAttribute("height", sheetH);

        // SVGNest library එක load වෙලා නැත්නම් error
        if (!nestLib) {
            throw new Error("SVGNest library එක load වුණේ නෑ. Internet connection එක බලන්න.");
        }

        // SVGNest instance එකක් හදන්න
        const nest = new nestLib();

        // SVG එක parse කරන්න
        const root = nest.parseSvg(new XMLSerializer().serializeToString(svgDoc));

        // Bin එක set කරන්න
        const bin = root.querySelector('#bin');
        if (!bin) {
            throw new Error("Bin element එක හම්බුණේ නෑ. SVG එකේ id='bin' තියෙන rectangle එකක් තියෙන්න ඕන.");
        }
        nest.setBin(bin);

        // Config කරන්න
        nest.config({
            spacing: spacing,
            rotations: rotations,
            populationSize: 10,
            mutationRate: 10
        });

        // Nesting start කරන්න
        nest.start(
            (progress) => {
                statusDiv.textContent = `⏳ ගණනය කරමින්... ${Math.round(progress * 100)}%`;
            },
            (svgList, efficiency, placedCount, totalCount) => {
                if (!svgList || svgList.length === 0) {
                    statusDiv.textContent = "❌ Nesting එක fail වුණා. Sheet size එක මදි වෙන්න පුළුවන්.";
                    calculateBtn.disabled = false;
                    return;
                }

                // Result එක පෙන්නන්න
                const sheetsUsed = svgList.length;
                const totalArea = sheetW * sheetH * sheetsUsed;
                const usedArea = efficiency * totalArea;
                const wastePercent = ((1 - efficiency) * 100).toFixed(1);

                resultDiv.innerHTML = `
                    <h2>📊 ප්‍රතිඵලය</h2>
                    <p><strong>යන Sheet ගණන:</strong> ${sheetsUsed} sheets</p>
                    <p><strong>භාවිතය:</strong> ${(efficiency * 100).toFixed(1)}%</p>
                    <p><strong>නාස්තිය:</strong> ${wastePercent}%</p>
                    <p style="color: #666; font-size: 14px;">
                        Sheet size: ${sheetW}mm × ${sheetH}mm | 
                        අකුරු අතර පරතරය: ${spacing}mm | 
                        භ්‍රමණ: ${rotations} කෝණ
                    </p>
                `;
                resultDiv.classList.add('active');

                // Preview එක පෙන්නන්න
                previewDiv.innerHTML = '';
                svgList.forEach((svgEl, index) => {
                    const wrapper = document.createElement('div');
                    wrapper.style.marginBottom = '20px';
                    wrapper.style.borderBottom = '2px solid #ddd';
                    wrapper.style.paddingBottom = '10px';
                    
                    const title = document.createElement('h3');
                    title.textContent = `Sheet ${index + 1}`;
                    title.style.margin = '10px';
                    
                    wrapper.appendChild(title);
                    wrapper.appendChild(svgEl);
                    previewDiv.appendChild(wrapper);
                });
                previewDiv.classList.add('active');

                statusDiv.textContent = `✅ අවසන්! Sheet ${sheetsUsed}ක් යනවා.`;
                calculateBtn.disabled = false;
            }
        );

    } catch (error) {
        console.error(error);
        statusDiv.textContent = `❌ Error: ${error.message}`;
        calculateBtn.disabled = false;
    }
});
