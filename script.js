
// ============ GLOBAL VARIABLES ============
let selectedFiles = [];
const maxFiles = 20;
const maxFileSize = 50 * 1024 * 1024; // 50MB

// Store conversion results
let conversionResults = {};
let isConverting = false;

// ============ WAIT FOR PAGE TO LOAD ============
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, initializing...');
    initApp();
});

// ============ INITIALIZE APP ============
function initApp() {
    // Setup file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/png';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // Setup event listeners
    setupEventListeners(fileInput);
    
    console.log('App initialized successfully!');
}

// ============ SETUP EVENT LISTENERS ============
function setupEventListeners(fileInput) {
    // Get elements
    const dropzone = document.getElementById('dropzone');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const convertBtn = document.getElementById('convertBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    
    // Check if elements exist
    if (!dropzone || !clearAllBtn || !convertBtn) {
        console.error('Some elements not found!');
        return;
    }
    
    // Click dropzone to open file selector
    dropzone.addEventListener('click', function() {
        fileInput.click();
    });
    
    // File selected
    fileInput.addEventListener('change', function(event) {
        handleFileSelect(event, fileInput);
    });
    
    // Clear all button
    clearAllBtn.addEventListener('click', clearAllFiles);
    
    // Convert button
    convertBtn.addEventListener('click', startBatchConversion);
    
    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', cancelAllConversions);
    }
    
    // Download all button
    if (downloadAllBtn) {
        downloadAllBtn.addEventListener('click', downloadAllConverted);
    }
    
    // Drag and drop
    setupDragAndDrop(dropzone, fileInput);
}

// ============ DRAG AND DROP ============
function setupDragAndDrop(dropzone, fileInput) {
    dropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropzone.classList.add('active-dropzone');
    });
    
    dropzone.addEventListener('dragleave', function() {
        dropzone.classList.remove('active-dropzone');
    });
    
    dropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropzone.classList.remove('active-dropzone');
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleNewFiles(files, fileInput);
        }
    });
}

// ============ FILE SELECTION HANDLER ============
function handleFileSelect(event, fileInput) {
    const files = Array.from(event.target.files);
    handleNewFiles(files, fileInput);
    fileInput.value = ''; // Reset input
}

// ============ HANDLE NEW FILES ============
function handleNewFiles(newFiles, fileInput) {
    let addedCount = 0;
    let duplicateCount = 0;
    let limitReachedCount = 0;

    // Process ALL dropped files one by one
    newFiles.forEach(file => {
        const result = validateFile(file);

        if (result.isValid) {
            // Only add if there is a physical slot available
            if (selectedFiles.length < maxFiles) {
                selectedFiles.push(file);
                addedCount++;
            } else {
                limitReachedCount++;
            }
        } else if (result.reason === 'duplicate') {
            duplicateCount++;
        }
    });
    
    // Update UI if files were added
    if (addedCount > 0) {
        updateFilePreviews();
        updateFileCount();
        showPreviewSection();
        updateDropzoneText();
        showMessage(addedCount === 1 ? `Added 1 file` : `Added ${addedCount} files`);
    }

    // Report Duplicates (ONE message for all of them)
    if (duplicateCount > 0) {
        showError(duplicateCount === 1 
            ? `1 duplicate file ignored` 
            : `${duplicateCount} duplicate files ignored`);
    }

    // Report Limit Overflow
    if (limitReachedCount > 0) {
        showError(`Limit reached: ${limitReachedCount} extra files ignored (max ${maxFiles})`);
    }
}

// ============ VALIDATE SINGLE FILE ============
function validateFile(file) {
    // Check file size - Still shows error immediately
    if (file.size > maxFileSize) {
        showError(`${file.name} is too large (max 50MB)`);
        return { isValid: false, reason: 'size' };
    }
    
    // Check file type - Still shows error immediately
    const validTypes = ['image/png'];
    const fileType = file.type.toLowerCase();
    if (!validTypes.some(type => fileType.includes(type.replace('image/', '')))) {
        showError(`${file.name} is not a supported image type`);
        return { isValid: false, reason: 'type' };
    }
    
    // Check for duplicates - Returns reason without showing error
    const isDuplicate = selectedFiles.some(f => 
        f.name === file.name && f.size === file.size
    );
    
    if (isDuplicate) {
        return { isValid: false, reason: 'duplicate' };
    }
    
    return { isValid: true };
}

// ============ UPDATE FILE PREVIEWS ============
function updateFilePreviews() {
    const previewGrid = document.getElementById('previewGrid');
    if (!previewGrid) return;
    
    previewGrid.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        previewGrid.innerHTML = `
            <div class="empty-preview">
                <div class="empty-preview-icon">📁</div>
                <p>No files selected</p>
                <p class="empty-preview-hint">Click the upload area to add files</p>
            </div>
        `;
        return;
    }
    
    selectedFiles.forEach((file, index) => {
        const card = createFileCard(file, index);
        previewGrid.appendChild(card);
    });
}

// ============ CREATE FILE CARD ============
function createFileCard(file, index) {
    const card = document.createElement('div');
    card.className = 'preview-card';
    card.dataset.index = index; 
    
    // Get status from the results array
    const result = conversionResults[index];
    const isDone = result && result.status === 'success';
    const isProcessing = result && result.status === 'processing';

    // Apply CSS Classes for your black/orange/green styling
    if (isDone) card.classList.add('completed');
    if (isProcessing) card.classList.add('processing');

    card.innerHTML = `
        <button class="remove-file" title="Remove file">×</button>
        <div class="thumbnail-container">
            <img src="" alt="${file.name}" class="preview-image" style="display: none;">
            <div class="thumb-loader">Loading...</div>
        </div>
        <div class="preview-info">
            <div class="file-name" title="${file.name}">${shortenFileName(file.name)}</div>
            <div class="file-size">${formatSize(file.size)}</div>
            <button class="convert-single-btn">
                ${isDone ? 'Download' : isProcessing ? 'Processing...' : 'Convert'}
            </button>
        </div>
    `;

    const imgElement = card.querySelector('.preview-image');
    const loader = card.querySelector('.thumb-loader');

    imgElement.onload = () => {
        imgElement.style.display = 'block';
        loader.style.display = 'none';
    };

    generatePreviewThumbnail(file, imgElement, loader);

    // --- FIX: Remove Logic ---
    card.querySelector('.remove-file').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        // Use the current index from the dataset at the moment of click
        const idx = parseInt(card.dataset.index);
        removeFile(idx);
    });
    
    // --- FIX: Convert/Download Logic ---
    card.querySelector('.convert-single-btn').addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const idx = parseInt(card.dataset.index);
        
        // Always check the LATEST status from the array using the current index
        const currentRes = conversionResults[idx];
        
        if (currentRes && currentRes.status === 'success') {
            downloadConvertedFile(idx);
        } else if (!isConverting && (!currentRes || currentRes.status !== 'processing')) {
            convertSingleFileStandalone(idx);
        }
    });
    
    return card;
}

async function generatePreviewThumbnail(file, imgElement, loaderElement) {
    try {
        // If the image is MASSIVE, we tell the browser to only decode 
        // a small portion of it into memory. This is the ultimate lag-fix.
        const bitmap = await createImageBitmap(file, { 
            resizeWidth: 300, 
            resizeQuality: 'low' 
        });

        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);

        imgElement.src = canvas.toDataURL('image/jpeg', 0.6); // Lower quality for preview
        imgElement.style.display = 'block';
        if (loaderElement) loaderElement.style.display = 'none';

        bitmap.close();
    } catch (err) {
        // Fallback for images that are TOO big for the browser's canvas limit
        loaderElement.textContent = "Preview unavailable (Image too large)";
    }
}

// ============ UPDATE FILE CARD STATUS ============
function updateFileCardStatus(index, status) {
    const previewGrid = document.getElementById('previewGrid');
    if (!previewGrid) return;
    
    // 1. Get the actual file object from our array using the index
    const file = selectedFiles[index];
    if (!file) return;

    // 2. THE FIX: Instead of looking for [data-index], find the card 
    // where the .file-name element's title matches our file.name
    const cards = Array.from(previewGrid.querySelectorAll('.preview-card'));
    const card = cards.find(c => {
        const nameEl = c.querySelector('.file-name');
        return nameEl && nameEl.title === file.name;
    });

    // If card isn't found (maybe it was deleted), just exit
    if (!card) return;
    
    // 3. Keep the data-index attribute in sync just in case
    card.dataset.index = index;

    // 4. Update the classes and button as usual
    card.classList.remove('processing', 'completed', 'failed');
    if (status !== 'pending') card.classList.add(status);
    
    const btn = card.querySelector('.convert-single-btn');
    if (btn) {
        switch(status) {
            case 'processing':
                btn.textContent = 'Processing...';
                btn.disabled = true;
                break;
            case 'completed':
                btn.textContent = 'Download';
                btn.disabled = false;
                break;
            case 'failed':
                btn.textContent = 'Failed';
                btn.disabled = true;
                break;
            default:
                btn.textContent = 'Convert';
                btn.disabled = false;
        }
    }
}

// ============ MAIN CONVERSION FUNCTIONS ============
async function startBatchConversion() {
    if (selectedFiles.length === 0) {
        showError('Please select files first');
        return;
    }

    const allDone = selectedFiles.length > 0 && selectedFiles.every((_, i) => 
        conversionResults[i] && conversionResults[i].status === 'success'
    );

    if (allDone) {
        showMessage('All files are already converted! ✨');
        return; // Stop here, don't run the conversion again
    }

    if (isConverting) return;

    isConverting = true;
    showProgressModal();

    // Update Main Button UI
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.disabled = true;
        convertBtn.textContent = 'Processing...';
    }

    for (let i = 0; i < selectedFiles.length; i++) {
        // BREAK if user pressed cancel
        if (!isConverting) break; 

        // FIX: Don't convert again if already successful!
        if (conversionResults[i] && conversionResults[i].status === 'success') {
            console.log(`Skipping ${selectedFiles[i].name} - already converted.`);
            updateProgress(); // Just update the bar
            continue; 
        }

        await convertSingleFile(i);
        await new Promise(r => setTimeout(r, 50)); // This prevents the UI from freezing
    }
    var downloadAllBtn=document.querySelector(".btn-download");
    if(downloadAllBtn){
        downloadAllBtn.style.display="block";
        downloadAllBtn.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
    });
    }
    finalizeConversion();
}

async function convertSingleFile(index) {
    const file = selectedFiles[index];
    if (!file) return;
    
    const originalFileName = file.name;
    
    updateFileCardStatus(index, 'processing');
    
    try {
        console.log(`Converting: ${file.name} (${formatSize(file.size)})`);
        
        const jpgBlob = await convertPngToJpgSimple(file);
        
        const currentIndex = selectedFiles.findIndex(f => f.name === originalFileName);
        if (currentIndex === -1) return;
        
        conversionResults[currentIndex] = {
            blob: jpgBlob,
            fileName: originalFileName.replace(/\.[^/.]+$/, "") + '.jpg',
            status: 'success'
        };
        
        updateFileCardStatus(currentIndex, 'completed');
        updateProgress();
        
    } catch (error) {
        console.error('Conversion failed:', error);
        
        const currentIndex = selectedFiles.findIndex(f => f.name === originalFileName);
        if (currentIndex !== -1) {
            conversionResults[currentIndex] = {
                error: error.message,
                status: 'failed'
            };
            updateFileCardStatus(currentIndex, 'failed');
        }
        
        updateProgress();
    }
}



// 1. Keep your worker pool variable global but empty at first
// ==========================================
// 1. ENGINE STATE & WORKER SETUP
// ==========================================
let pngJpgWorkers = [];
let jpgWorkerIndex = 0;
window.qualityMode = 'best'; // 'best' | 'optimized'


async function initConverter() {
    try {
        const numWorkers = Math.min(navigator.hardwareConcurrency || 4, 6);

        for (let i = 0; i < numWorkers; i++) {
            const workerCode = `
                self.onmessage = async (e) => {
                    try {
                        const { blob, mode } = e.data;

                        const bitmap = await createImageBitmap(blob);
                        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
                        const ctx = canvas.getContext("2d", { alpha: false });

                        // JPG has no transparency
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(bitmap, 0, 0);

                        const quality = mode === 'optimized' ? 0.75 : 0.92;

                        const jpgBlob = await canvas.convertToBlob({
                            type: "image/jpeg",
                            quality
                        });

                        bitmap.close();
                        self.postMessage(jpgBlob);
                        // ... after finalBlob is generated ...
                       // ADD THESE 3 LINES EXACTLY HERE:
                       ctx.clearRect(0, 0, canvas.width, canvas.height); 
                       canvas.width = 1; 
                       canvas.height = 1;
                    } catch (err) {
                        self.postMessage({ error: err.message });
                    }
                };
            `;

            const worker = new Worker(
                URL.createObjectURL(
                    new Blob([workerCode], { type: "application/javascript" })
                )
            );

            pngJpgWorkers.push(worker);
        }

        console.log("Converter Engine Ready (PNG → JPG)");
    } catch (err) {
        console.error("Failed to start converter:", err);
    }
}

initConverter();


// ==========================================
// 2. UI SELECTORS & SWITCH LOGIC
// ==========================================
const cp_btnBest = document.getElementById('optionBest');
const cp_btnOptimized = document.getElementById('optionOptimized');
const cp_slider = document.getElementById('qualitySlider');
const cp_labelCurrent = document.getElementById('currentSetting');
const cp_labelSize = document.getElementById('fileSizeEstimate');
const cp_labelComp = document.getElementById('compressionLevel');
const cp_labelUse = document.getElementById('bestForUse');

function cp_updateUI(mode) {
    window.qualityMode = mode; 

    if (mode === 'best') {
        cp_slider.style.transform = 'translateX(0%)';
        cp_btnBest.classList.add('active');
        cp_btnBest.classList.remove('inactive');
        cp_btnOptimized.classList.add('inactive');
        cp_btnOptimized.classList.remove('active');

        // SHOW % BUT CALL IT "MAXIMUM"
        cp_labelCurrent.textContent = 'Maximum Quality';
        cp_labelCurrent.className = 'quality-value best';
        cp_labelSize.textContent = 'Excellent quality, 80-90% smaller than PNG';
        cp_labelComp.textContent = 'Near-lossless JPG compression';
        cp_labelUse.textContent = 'Print, portfolios, professional use';
    } else {
        cp_slider.style.transform = 'translateX(100%)';
        cp_btnOptimized.classList.add('active');
        cp_btnOptimized.classList.remove('inactive');
        cp_btnBest.classList.add('inactive');
        cp_btnBest.classList.remove('active');

        // SHOW % BUT CALL IT "OPTIMIZED"
        cp_labelCurrent.textContent = 'Optimized Size';
        cp_labelCurrent.className = 'quality-value good';
        cp_labelSize.textContent = 'Web-ready, 90-95% smaller than PNG';
        cp_labelComp.textContent = 'Balanced quality & file size';
        cp_labelUse.textContent = 'Websites, email, social media, fast loading';
    }
}


// Event Listeners
cp_btnBest.addEventListener('click', () => {
    cp_updateUI('best');
    if (typeof showAlert === "function") showAlert('🎯 Best quality mode selected', 'success');
});

cp_btnOptimized.addEventListener('click', () => {
    cp_updateUI('optimized');
    if (typeof showAlert === "function") showAlert('⚡ Optimized size mode selected', 'success');
});

// Initialize UI
cp_updateUI('best');

// ==========================================
// 3. THE FINAL CONVERSION CALL
// ==========================================
function convertPngToJpgSimple(jpgBlob) {
    return new Promise((resolve, reject) => {
        if (pngJpgWorkers.length === 0)
            return reject("Engine loading...");

        const worker = pngJpgWorkers[jpgWorkerIndex];
        jpgWorkerIndex = (jpgWorkerIndex + 1) % pngJpgWorkers.length;

        worker.onmessage = (e) => {
            if (e.data?.error) reject(e.data.error);
            else resolve(e.data);
        };

        worker.postMessage({
            blob: jpgBlob,
            mode: window.qualityMode
        });
    });
}



// ============ CONVERT SINGLE FILE (STANDALONE) ============
async function convertSingleFileStandalone(index) {
    // 1. Force reset if a previous batch was cancelled/hidden
    const modal = document.getElementById('progressModal');
    const isModalVisible = modal && modal.style.display === 'flex';
    
    if (isConverting && !isModalVisible) {
        console.log("Forcing state reset - no active batch visible.");
        isConverting = false; 
    }

    // 2. True safety check
    if (isConverting) {
        showError('A batch conversion is in progress. Please wait.');
        return;
    }

    // Capture the specific file and its name IMMEDIATELY
    const file = selectedFiles[index];
    if (!file) return;
    const originalName = file.name; 

    // 3. Start Conversion
    isConverting = true;
    updateFileCardStatus(index, 'processing');

    try {
        // Core conversion logic
        const pngBlob = await convertPngToJpgSimple(file);
        
        // --- THE FIX: Find the FRESH index right now ---
        // If the user deleted a file while we were waiting for the blob, 
        // the original 'index' is now wrong. We find where the file is NOW.
        const currentIndex = selectedFiles.findIndex(f => f.name === originalName);
        
        // If the file was deleted entirely during conversion, stop here.
        if (currentIndex === -1) {
            console.log("File removed during conversion, discarding result.");
            return;
        }

        // Store the result at the CORRECT current index
        conversionResults[currentIndex] = {
            blob: pngBlob,
            fileName: originalName.replace(/\.[^/.]+$/, "") + '.jpg',
            status: 'success'
        };

        // Update the UI at the CORRECT current index
        updateFileCardStatus(currentIndex, 'completed');   
        
    } catch (error) {
        if (!isConverting && !isModalVisible) return;
        
        console.error('Conversion failed:', error);
        
        // Find fresh index for error handling too
        const currentIndex = selectedFiles.findIndex(f => f.name === originalName);
        if (currentIndex !== -1) {
            updateFileCardStatus(currentIndex, 'failed');
            showError(`Failed to convert ${originalName}`);
        }
    } finally {
        isConverting = false;
        const hasSuccess = Object.values(conversionResults).some(r => r.status === 'success');
        
        // 2. Find the Download All button (make sure the ID matches your HTML)
        const downloadAllBtn = document.querySelector('.btn-download'); 
        
        if (downloadAllBtn && hasSuccess) {
            downloadAllBtn.style.display = 'block'; // Show it!
        }
    }
}

// ============ DOWNLOAD FUNCTIONS ============
function downloadConvertedFile(index) {
    const card = document.querySelector(`.preview-card[data-index="${index}"]`);
    if (!card) return;

    const fileNameEl = card.querySelector('.file-name');
    const originalFileName = fileNameEl ? fileNameEl.title : '';
    
    if (!originalFileName) return;
    
    const fileIndex = selectedFiles.findIndex(f => f.name === originalFileName);
    if (fileIndex === -1) {
        showError('File not found');
        return;
    }
    
    const result = conversionResults[fileIndex];
    
    if (!result || result.status !== 'success') {
        showError('File not available for download');
        return;
    }

    const btn = card.querySelector('.convert-single-btn');
    if (btn) {
        btn.textContent = 'Downloading...';
        btn.style.opacity = '0.7';
        btn.style.pointerEvents = 'none';
    }
    
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(result.blob);
    link.download = result.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
        URL.revokeObjectURL(link.href);
        if (btn) {
            btn.textContent = 'Download';
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        }
    }, 1500);
}

var downloadAllBtn=document.querySelector(".btn-download");
downloadAllBtn.addEventListener("click",downloadAllConverted);

function downloadAllConverted() {
    let downloaded = 0;
    
    selectedFiles.forEach((file, index) => {
        const result = conversionResults[index];
        if (result && result.status === 'success') {
            setTimeout(() => {
                downloadConvertedFile(index);
            }, downloaded * 300);
            downloaded++;
        }
    });
    
    if (downloaded > 0) {
        showMessage(`Downloading ${downloaded} file${downloaded > 1 ? 's' : ''}...`);
    }
}

// ============ PROGRESS MANAGEMENT ============
function showProgressModal() {
    const progressModal = document.getElementById('progressModal');
    if (progressModal) {
        progressModal.style.display = 'flex';
        
        // Reset progress
        const progressBar = document.getElementById('progressBar');
        if (progressBar) progressBar.style.width = '0%';
        
        const progressText = document.getElementById('progressText');
        if (progressText) progressText.textContent = `Processing 0 of ${selectedFiles.length}`;
        
        const progressPercent = document.getElementById('progressPercent');
        if (progressPercent) progressPercent.textContent = '0%';
        
        const completedCount = document.getElementById('completedCount');
        if (completedCount) completedCount.textContent = '0';
        
        const failedCount = document.getElementById('failedCount');
        if (failedCount) failedCount.textContent = '0';
        
        const remainingCount = document.getElementById('remainingCount');
        if (remainingCount) remainingCount.textContent = selectedFiles.length.toString();
        
        // Show cancel button, hide download button
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) cancelBtn.style.display = 'block';
        
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        if (downloadAllBtn) downloadAllBtn.style.display = 'none';
    }
}

function hideProgressModal() {
    const progressModal = document.getElementById('progressModal');
    if (progressModal) {
        progressModal.style.display = 'none';
    }
}

function updateProgress() {
    const total = selectedFiles.length;
    const completed = Object.values(conversionResults).filter(r => r.status === 'success').length;
    const failed = Object.values(conversionResults).filter(r => r.status === 'failed').length;
    const processed = completed + failed;
    const percent = Math.round((processed / total) * 100);
    
    // Update progress bar
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
        progressBar.setAttribute('aria-valuenow', percent);
    }
    
    // Update text
    const progressText = document.getElementById('progressText');
    if (progressText) {
        progressText.textContent = `Processing ${processed} of ${total}`;
    }
    
    const progressPercent = document.getElementById('progressPercent');
    if (progressPercent) {
        progressPercent.textContent = `${percent}%`;
    }
    
    // Update counts
    const completedCount = document.getElementById('completedCount');
    if (completedCount) completedCount.textContent = completed;
    
    const failedCount = document.getElementById('failedCount');
    if (failedCount) failedCount.textContent = failed;
    
    const remainingCount = document.getElementById('remainingCount');
    if (remainingCount) remainingCount.textContent = total - processed;
}

var cancelAllBtn=document.querySelector(".btn-cancel");
cancelAllBtn.addEventListener("click",cancelAllConversions);

function cancelAllConversions() {
    isConverting = false; // Stops the loop in startBatchConversion
    
    hideProgressModal();
    
    // Reset Main Button
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.disabled = false;
        convertBtn.textContent = 'Convert All';
        convertBtn.classList.remove('processing');
    }

    // Reset UI cards but KEEP existing success results
    selectedFiles.forEach((_, index) => {
        const result = conversionResults[index];
        // If it wasn't finished, set it back to 'pending'
        if (!result || result.status !== 'success') {
            updateFileCardStatus(index, 'pending');
        }
    });
    
    showMessage('Process stopped');
}

function finalizeConversion() {
    // Only hide modal if we actually finished or stopped
    hideProgressModal();
    isConverting = false;

    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.disabled = false;
        convertBtn.textContent = 'Convert All';
    }

    // Show "Download All" only if there is at least one success
    const hasSuccess = Object.values(conversionResults).some(r => r.status === 'success');
    const downloadAllBtn = document.getElementById('downloadAllBtn'); // Main UI one
    if (downloadAllBtn) {
        downloadAllBtn.style.display = hasSuccess ? 'block' : 'none';
    }
}

// ============ FILE MANAGEMENT ============
function removeFile(index) {
    const targetIndex = parseInt(index);
    
    // 1. Remove from data array
    selectedFiles.splice(targetIndex, 1);
    
    // 2. RE-INDEX the results object (Keep your original logic here)
    const newResults = {};
    for (let i = 0; i < selectedFiles.length; i++) {
        let oldIndex = (i >= targetIndex) ? i + 1 : i;
        if (conversionResults[oldIndex]) {
            newResults[i] = conversionResults[oldIndex];
        }
    }
    conversionResults = newResults;

    // 3. UI SYNC: Remove the specific card and update IDs of the rest
    const previewGrid = document.getElementById('previewGrid');
    const cardToRemove = previewGrid.querySelector(`.preview-card[data-index="${targetIndex}"]`);
    
    if (cardToRemove) {
        cardToRemove.remove(); // Visual removal
        
        // Update all following cards so their buttons work with the new array order
        const remainingCards = previewGrid.querySelectorAll('.preview-card');
        remainingCards.forEach((card, i) => {
            card.dataset.index = i; // This updates what the buttons see when clicked
        });
    }

    // 4. Update Global UI Elements
    updateFileCount();      
    updateDropzoneText();   
    
    if (selectedFiles.length === 0) {
        hidePreviewSection();
        updateFilePreviews(); // Show empty state
    }
    
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        convertBtn.textContent = `Convert All`;
    }
}

function clearAllFiles() {
    if (selectedFiles.length === 0) return;
    
    selectedFiles = [];
    conversionResults = {};
    updateFilePreviews();
    hidePreviewSection();
    updateDropzoneText();
    showMessage('All files cleared');
}

// ============ UI UPDATE FUNCTIONS ============
function updateFileCount() {
    const fileCount = document.getElementById('fileCount');
    if (fileCount) {
        fileCount.textContent = `(${selectedFiles.length}/${maxFiles})`;
    }
}

function showPreviewSection() {
    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
        previewSection.style.display = 'block';
        previewSection.classList.add('visible');
        setTimeout(() => {
            previewSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 50); // Small delay to ensure the display: block is processed
    }
}

function hidePreviewSection() {
    const previewSection = document.getElementById('previewSection');
    if (previewSection) {
        previewSection.style.display = 'none';
        previewSection.classList.remove('visible');
    }
}

function updateDropzoneText() {
    const dropzone = document.getElementById('dropzone');
    if (!dropzone) return;
    
    const dropzoneText = dropzone.querySelector('.dropzone-text');
    if (dropzoneText) {
        if (selectedFiles.length > 0) {
            dropzoneText.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`;
            dropzoneText.classList.add('has-files');
        } else {
            dropzoneText.textContent = 'Click or drag image to convert';
            dropzoneText.classList.remove('has-files');
        }
    }
}

// ============ HELPER FUNCTIONS ============
function shortenFileName(name, maxLength = 20) {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
}

function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

// ============ MESSAGE/ERROR FUNCTIONS ============
function showMessage(text) {
    createAlert(text, 'success');
}

function showError(text) {
    createAlert(text, 'error');
}

function createAlert(text, type) {
    // Create alert element
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    
    // Set icon based on type
    let icon = 'ℹ️';
    if (type === 'error') icon = '⚠️';
    if (type === 'success') icon = '✅';
    
    alert.innerHTML = `
        <div class="alert-title">
            <span>${icon}</span>
            <span>${type === 'error' ? 'Error' : 'Success'}</span>
        </div>
        <div class="alert-message">${text}</div>
    `;
    
    // Add to container or create one
    let container = document.getElementById('alertContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'alertContainer';
        container.className = 'alert-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(alert);
    
    // Remove after 3 seconds
    setTimeout(function() {
        alert.classList.add('slide-out');
        setTimeout(function() {
            alert.remove();
        }, 300);
    }, 3000);
}


// Collapse/Expand Settings

const collapseBtn = document.getElementById('collapseBtn');
const qualityContainer = document.getElementById('qualityToggleContainer');

// Check if user previously opened settings
const wasExpanded = localStorage.getItem('settingsExpanded') === 'true';

// START HIDDEN - only expand if user previously opened
if (wasExpanded) {
    qualityContainer.classList.remove('collapsed');
    collapseBtn.classList.add('rotated');
} else {
    // Default: HIDDEN
    qualityContainer.classList.add('collapsed');
    collapseBtn.classList.remove('rotated');
}

collapseBtn.addEventListener('click', function() {
    const isCollapsed = qualityContainer.classList.contains('collapsed');
    
    if (isCollapsed) {
        // Expand settings
        qualityContainer.classList.remove('collapsed');
        collapseBtn.classList.add('rotated');
        localStorage.setItem('settingsExpanded', 'true');
    } else {
        // Collapse settings
        qualityContainer.classList.add('collapsed');
        collapseBtn.classList.remove('rotated');
        localStorage.setItem('settingsExpanded', 'false');
    }
});







