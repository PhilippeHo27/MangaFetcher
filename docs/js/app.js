document.addEventListener('DOMContentLoaded', () => {
    const mangaTableBody = document.getElementById('manga-table-body');
    const addMangaForm = document.getElementById('add-manga-form');
    const refreshButton = document.getElementById('refresh-button');
    const mangaDataPath = 'data/manga_chapters.json';

    // --- Functions ---

    // Function to fetch manga data from JSON
    async function fetchMangaData() {
        try {
            // Add a cache-busting query parameter
            const response = await fetch(`${mangaDataPath}?v=${Date.now()}`);
            if (!response.ok) {
                 // If file not found (404), it might just be empty initially
                if (response.status === 404) {
                    console.warn(`${mangaDataPath} not found. Assuming empty list.`);
                    return []; // Return empty array
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Check if response is empty
            const text = await response.text();
            if (!text) {
                console.warn(`${mangaDataPath} is empty.`);
                return []; // Return empty array if file is empty
            }
            return JSON.parse(text); // Parse text if not empty
        } catch (error) {
            console.error('Error fetching manga data:', error);
            mangaTableBody.innerHTML = `<tr><td colspan="4">Error loading manga data. Check console or try refreshing. Ensure ${mangaDataPath} exists and is valid JSON.</td></tr>`;
            return []; // Return empty array on error
        }
    }

    // Function to render manga data in the table
    function renderMangaTable(mangaData) {
        mangaTableBody.innerHTML = ''; // Clear existing rows

        if (!mangaData || mangaData.length === 0) {
            mangaTableBody.innerHTML = '<tr><td colspan="4">No manga tracked yet, or data file is empty/invalid. Add one above or run the update script.</td></tr>';
            return;
        }

        mangaData.forEach(manga => {
            const row = document.createElement('tr');
             // Add 'is-read' class if manga is read
            if (manga.isRead) {
                row.classList.add('is-read');
            }
            row.dataset.mangaId = manga.id; // Store manga ID on the row

            const latestChapter = manga.latestChapter || {}; // Handle cases where latestChapter might be null/undefined
            const chapterText = latestChapter.text || 'N/A';
            const chapterUrl = latestChapter.url;

            row.innerHTML = `
                <td>${manga.title || 'N/A'}</td>
                <td>
                    ${chapterUrl ? 
                        `<a href="${chapterUrl}" target="_blank" rel="noopener noreferrer">${chapterText}</a>` : 
                        chapterText
                    }
                     ${manga.lastUpdated ? `<br><small>Checked: ${new Date(manga.lastUpdated).toLocaleString()}</small>` : ''}
                </td>
                <td>${manga.isRead ? 'Read' : 'Unread'}</td>
                <td>
                    <button class="btn btn-read" data-id="${manga.id}">
                        ${manga.isRead ? 'Mark Unread' : 'Mark Read'}
                    </button>
                </td>
            `;
            mangaTableBody.appendChild(row);
        });

        // Add event listeners to the new 'Mark Read/Unread' buttons
        addReadButtonListeners();
    }

    // Function to handle form submission (simulated add)
    async function handleAddManga(event) {
        event.preventDefault();
        const name = document.getElementById('manga-name').value.trim();
        const url = document.getElementById('manga-url').value.trim();
        const selector = document.getElementById('manga-selector').value.trim();
        const selectorTypeInput = document.querySelector('input[name="selector-type"]:checked');

        if (!selectorTypeInput) {
            console.error("No selector type (CSS/XPath) is checked.");
            alert("Please select a selector type (CSS or XPath).");
            return; // Stop execution if no type is selected
        }
        const selectorType = selectorTypeInput.value;

        if (!name || !url || !selector) {
            alert('Please fill in all fields.');
            return;
        }

        const newMangaSource = {
            // id will be assigned by the backend script
            name: name,
            url: url,
            selector: selector,
            use_xpath: selectorType === 'xpath',
            isActive: true
        };

        console.log('Attempting to add (UI only):', newMangaSource);
        alert(`Manga "${name}" added to UI (temporary). Run 'python backend/MangaScraper.py add --name "${name}" --url "${url}" --selector "${selector}" ${selectorType === 'xpath' ? '--xpath' : ''}' to save permanently.`);

        // --- Simulation --- 
        // In a real app, you'd POST this to a backend endpoint.
        // Here, we just log it and maybe add a placeholder to the table 
        // or just remind the user to run the script.
        // For now, we won't add visually to avoid confusion with non-persisted data.
        
        addMangaForm.reset(); // Clear the form
        // Potentially refresh list after a short delay, though it won't show the new manga yet
        // setTimeout(loadAndRenderManga, 500); 
    }

    // Function to handle clicking 'Mark Read/Unread' buttons (simulated)
    function handleMarkRead(event) {
        if (!event.target.classList.contains('btn-read')) return; // Ignore clicks not on the button

        const button = event.target;
        const mangaId = parseInt(button.dataset.id, 10);
        const row = button.closest('tr');
        const isCurrentlyRead = row.classList.contains('is-read');
        const markAsAction = isCurrentlyRead ? 'unread' : 'read'; // Determine the script action
        const markAsStatus = !isCurrentlyRead;


        console.log(`Simulating Mark as ${markAsAction} for ID:`, mangaId);
        alert(`UI updated to '${markAsAction}'. Run 'python backend/MangaScraper.py mark --id ${mangaId}${isCurrentlyRead ? ' --unread' : ''}' to save permanently.`);

        // --- Simulation --- 
        // In a real app, you'd send a request (PUT/POST) to a backend endpoint.
        // Here, we just update the UI directly.
        row.classList.toggle('is-read');
        button.textContent = markAsStatus ? 'Mark Unread' : 'Mark Read';
        // Update the status cell text
        const statusCell = row.cells[2]; 
        if (statusCell) {
            statusCell.textContent = markAsStatus ? 'Read' : 'Unread';
        }
    }

    // Function to add event listeners to 'Mark Read/Unread' buttons
    function addReadButtonListeners() {
        const readButtons = mangaTableBody.querySelectorAll('.btn-read');
        readButtons.forEach(button => {
            // Remove existing listener to prevent duplicates if re-rendering
            button.removeEventListener('click', handleMarkRead);
            // Add the listener
            button.addEventListener('click', handleMarkRead);
        });
    }

    // Initial load function
    async function loadAndRenderManga() {
        mangaTableBody.innerHTML = '<tr><td colspan="4">Loading manga data...</td></tr>'; // Show loading state
        const mangaData = await fetchMangaData();
        renderMangaTable(mangaData);
    }

    // --- Event Listeners ---
    addMangaForm.addEventListener('submit', handleAddManga);
    refreshButton.addEventListener('click', loadAndRenderManga);

    // --- Initial Load ---
    loadAndRenderManga(); 

    // --- GitHub API Interaction (INSECURE - For Demo Only) ---
    async function commitChanges(newMangaDetails) {
        // !!! SECURITY WARNING: Hardcoding tokens is highly insecure !!!
        // Replace placeholders with your actual token, repo, and owner
        const token = 'YOUR_GITHUB_TOKEN'; // USE A TOKEN WITH repo SCOPE ONLY
        const repo = 'YOUR_REPO_NAME';      // e.g., 'MangaFetcher'
        const owner = 'YOUR_GITHUB_USERNAME';// e.g., 'YourGitHubUser'
        const path = 'data/pending_changes.json'; // The file to update
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const commitMessage = `Frontend: Add new manga source - ${newMangaDetails.name}`;

        try {
            // 1. Get current file content and SHA
            let currentSha = null;
            let currentContent = '[]'; // Default to empty array if file doesn't exist
            try {
                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    currentSha = data.sha;
                    // Content is base64 encoded
                    currentContent = atob(data.content);
                } else if (response.status !== 404) {
                     // Handle errors other than file not found
                    throw new Error(`GitHub API error (GET): ${response.status} ${response.statusText}`);
                }
                // If 404, currentSha remains null, currentContent remains '[]'
            } catch (fetchError) {
                 console.error('Error fetching current pending_changes.json:', fetchError);
                 // Decide how to handle - maybe allow creating the file if SHA is null?
                 // For now, rethrow or alert user
                 alert(`Error fetching existing changes: ${fetchError.message}. Cannot save new manga.`);
                 return; // Stop the commit process
            }

            // 2. Prepare new content
            let changes = [];
            try {
                 changes = JSON.parse(currentContent);
                 if (!Array.isArray(changes)) changes = []; // Ensure it's an array
            } catch (parseError) {
                 console.error('Error parsing existing pending_changes.json content:', parseError);
                 alert('Warning: Could not parse existing changes file. Starting fresh for this commit.');
                 changes = []; // Reset if parsing fails
            }

            changes.push(newMangaDetails); // Add the new manga details
            const newContentBase64 = btoa(JSON.stringify(changes, null, 2)); // Encode to base64, pretty print JSON

            // 3. Commit new content (Create or Update)
            const commitPayload = {
                message: commitMessage,
                content: newContentBase64,
            };
            // Include SHA only if updating an existing file
            if (currentSha) {
                commitPayload.sha = currentSha;
            }

            const putResponse = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commitPayload)
            });

            if (!putResponse.ok) {
                const errorData = await putResponse.json();
                throw new Error(`GitHub API error (PUT): ${putResponse.status} ${putResponse.statusText} - ${errorData.message}`);
            }

            console.log('Successfully submitted new manga to pending_changes.json');
            // Optional: Show success message to user
            // alert('New manga submitted for processing!');

        } catch (error) {
            console.error('Error committing changes via GitHub API:', error);
            alert(`Failed to submit manga: ${error.message}`);
            // Potentially revert UI change if commit fails?
        }
    }

    // --- Data Fetching ---
    async function fetchMangaData() {
        // Use cache-busting query parameter to try and get fresh data
        const timestamp = new Date().getTime();
        try {
            // Assuming chapters file is correctly placed relative to docs/index.html
            const response = await fetch(`data/manga_chapters.json?v=${timestamp}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            // Sort data? Maybe sort by title initially?
            data.sort((a, b) => a.title.localeCompare(b.title));
            return data;
        } catch (error) {
            console.error('Error fetching manga data:', error);
            mangaTableBody.innerHTML = '<tr><td colspan="5">Error loading manga data. Please try refreshing.</td></tr>';
            return []; // Return empty array on error
        }
    }

    // --- Rendering Logic ---
    function renderMangaTable(mangaList) {
        mangaTableBody.innerHTML = ''; // Clear existing rows

        if (!mangaList || mangaList.length === 0) {
            mangaTableBody.innerHTML = '<tr><td colspan="5">No manga tracked yet. Add one above!</td></tr>';
            return;
        }

        mangaList.forEach(manga => {
            const row = document.createElement('tr');
            row.dataset.mangaId = manga.id; // Store manga ID on the row

            const titleCell = document.createElement('td');
            titleCell.textContent = manga.title;

            const sourceCell = document.createElement('td');
            const sourceLink = document.createElement('a');
            if (manga.sourceUrl) {
                sourceLink.href = manga.sourceUrl;
                sourceLink.textContent = new URL(manga.sourceUrl).hostname; // Display domain name
                sourceLink.target = '_blank';
                sourceLink.rel = 'noopener noreferrer';
            } else {
                sourceLink.textContent = 'N/A';
            }
            sourceCell.appendChild(sourceLink);

            const chaptersCell = document.createElement('td');
            chaptersCell.innerHTML = ''; // Clear potential template content
            if (manga.status === 'Pending' || manga.status === 'Pending First Scrape') {
                chaptersCell.textContent = 'Pending...';
            } else if (manga.chapters && manga.chapters.length > 0) {
                // Display multiple chapters (e.g., latest 3)
                const chaptersToShow = manga.chapters.slice(-3); // Get last 3
                chaptersToShow.reverse().forEach((chap, index) => {
                    if (chap.text && chap.text !== 'Unknown' && chap.text !== 'Error') {
                        const chapterElement = document.createElement(chap.url ? 'a' : 'span');
                        chapterElement.textContent = chap.text;
                        if (chap.url) {
                            chapterElement.href = chap.url;
                            chapterElement.target = '_blank';
                            chapterElement.rel = 'noopener noreferrer';
                        }
                        // Add scraped date?
                        // const dateStr = chap.scrapedAt ? new Date(chap.scrapedAt).toLocaleDateString() : '';
                        // chapterElement.title = `Scraped: ${dateStr}`;

                        chaptersCell.appendChild(chapterElement);
                        // Add a separator if not the last item
                        if (index < chaptersToShow.length - 1) {
                           chaptersCell.appendChild(document.createElement('br'));
                        }
                    }
                });
                 if (manga.chapters.length > chaptersToShow.length) {
                    chaptersCell.appendChild(document.createElement('br'));
                    const moreSpan = document.createElement('span');
                    moreSpan.textContent = `(... and ${manga.chapters.length - chaptersToShow.length} older)`;
                    moreSpan.style.fontSize = '0.8em';
                    moreSpan.style.opacity = '0.7';
                    chaptersCell.appendChild(moreSpan);
                 }
            } else {
                chaptersCell.textContent = 'None Found';
            }

            const statusCell = document.createElement('td');
            statusCell.textContent = manga.isRead ? 'Read' : 'Unread';
            if (manga.status === 'Pending') {
                statusCell.textContent = 'Pending'; // Override read/unread for pending
            }
            row.classList.toggle('read', manga.isRead && manga.status !== 'Pending');

            const actionsCell = document.createElement('td');
            const markReadButton = document.createElement('button');
            markReadButton.textContent = manga.isRead ? 'Mark Unread' : 'Mark Read';
            markReadButton.classList.add('btn-mark-read');
            markReadButton.disabled = (manga.status === 'Pending');
            actionsCell.appendChild(markReadButton);

            const clearButton = document.createElement('button');
            clearButton.textContent = 'Clear Old Chapters';
            clearButton.classList.add('btn-clear');
            const canClear = manga.chapters && manga.chapters.length > 1;
            clearButton.style.display = canClear ? 'inline-block' : 'none';
            clearButton.disabled = (manga.status === 'Pending');
            actionsCell.appendChild(clearButton);

            row.appendChild(titleCell);
            row.appendChild(sourceCell);
            row.appendChild(chaptersCell);
            row.appendChild(statusCell);
            row.appendChild(actionsCell);

            mangaTableBody.appendChild(row);
        });

        // Remove old event listeners if we were attaching directly (now using delegation)
        // setupActionListeners();
    }

    // --- Event Handlers (using Event Delegation) ---
    function handleTableActions(event) {
        const targetButton = event.target.closest('button');
        if (!targetButton) return; // Click wasn't on a button

        const row = targetButton.closest('tr');
        const mangaId = parseInt(row.dataset.mangaId, 10);

        if (targetButton.classList.contains('btn-mark-read')) {
            handleMarkRead(mangaId, row);
        } else if (targetButton.classList.contains('btn-clear')) {
            handleClearOld(mangaId, row);
        }
    }

    function handleMarkRead(mangaId, tableRow) {
        // Find the manga in the cache
        const mangaIndex = mangaDataCache.findIndex(m => m.id === mangaId);
        if (mangaIndex === -1 || mangaDataCache[mangaIndex].status === 'Pending') {
             console.warn(`Manga ID ${mangaId} not found in cache or is pending.`);
             return; // Ignore if pending or not found
        }

        // Toggle the read status in the cache
        mangaDataCache[mangaIndex].isRead = !mangaDataCache[mangaIndex].isRead;
        const isNowRead = mangaDataCache[mangaIndex].isRead;

        // Update the button text and row style directly
        const button = tableRow.querySelector('.btn-mark-read');
        button.textContent = isNowRead ? 'Mark Unread' : 'Mark Read';
        tableRow.classList.toggle('read', isNowRead);
        tableRow.querySelector('.manga-status').textContent = isNowRead ? 'Read' : 'Unread';

        console.log(`Manga ID ${mangaId} marked as ${isNowRead ? 'read' : 'unread'} (UI only).`);
        // In a real application, you'd likely call a backend endpoint here
        // to persist the change and potentially trigger the chapter clearing.
        // Example: await updateReadStatusOnBackend(mangaId, isNowRead);
    }

    function handleClearOld(mangaId, tableRow) {
         // Find the manga in the cache
        const mangaIndex = mangaDataCache.findIndex(m => m.id === mangaId);
         if (mangaIndex === -1 || mangaDataCache[mangaIndex].status === 'Pending') {
             console.warn(`Manga ID ${mangaId} not found in cache or is pending.`);
             return; // Ignore if pending or not found
         }

        const manga = mangaDataCache[mangaIndex];

        if (manga.chapters && manga.chapters.length > 1) {
            // Keep only the latest chapter in the cache
            const latestChapter = manga.chapters[manga.chapters.length - 1];
            manga.chapters = [latestChapter];

            // Re-render just the chapters cell and hide the clear button
            const chaptersCell = tableRow.querySelector('.manga-chapters');
            chaptersCell.innerHTML = ''; // Clear
            const chapterElement = document.createElement(latestChapter.url ? 'a' : 'span');
            chapterElement.textContent = latestChapter.text;
            if (latestChapter.url) {
                chapterElement.href = latestChapter.url;
                chapterElement.target = '_blank';
                chapterElement.rel = 'noopener noreferrer';
            }
            chaptersCell.appendChild(chapterElement);

            const clearButton = tableRow.querySelector('.btn-clear');
            clearButton.style.display = 'none';

            console.log(`Cleared old chapters for Manga ID ${mangaId} (UI only).`);
            // In a real application, call backend: await clearChaptersOnBackend(mangaId);
        }
    }

    async function handleAddManga(event) {
        event.preventDefault();
        const name = document.getElementById('manga-name').value.trim();
        const url = document.getElementById('manga-url').value.trim();
        const selector = document.getElementById('manga-selector').value.trim();
        const selectorTypeInput = document.querySelector('input[name="selector-type"]:checked');

        if (!selectorTypeInput) {
            console.error("No selector type (CSS/XPath) is checked.");
            alert("Please select a selector type (CSS or XPath).");
            return; // Stop execution if no type is selected
        }
        const selectorType = selectorTypeInput.value;

        if (!name || !url || !selector) {
            alert('Please fill in all fields.');
            return;
        }

        // Basic URL validation
        try {
             new URL(url);
        } catch (_) {
             alert('Please enter a valid URL.');
             return;
        }

        // Prepare details for commit
        const newMangaDetails = {
            name: name,
            url: url,
            selector: selector,
            use_xpath: selectorType === 'xpath',
            timestamp: new Date().toISOString() // Add timestamp for tracking
        };

        // Prepare placeholder for immediate UI update
        const placeholderManga = {
            id: -1, // Temporary ID for UI
            title: name,
            sourceUrl: url,
            chapters: [], // Start with empty chapters
            isRead: false,
            status: 'Pending', // Special status for UI
            lastUpdated: new Date().toISOString()
        };

        // Add placeholder to the beginning of the cache
        mangaDataCache.unshift(placeholderManga);

        // Re-render the table immediately
        renderMangaTable(mangaDataCache);

        // Reset the form
        addMangaForm.reset();

        // Submit changes to GitHub (ASYNC - runs in background)
        // !!! REMINDER: INSECURE METHOD !!!
        await commitChanges(newMangaDetails);
        // Note: The 'Pending' status will remain until the next full refresh
        // fetches updated data processed by the backend/action.
    }

    // Initial load function
    async function loadAndRenderManga() {
        mangaTableBody.innerHTML = '<tr><td colspan="5">Loading manga data...</td></tr>'; // Updated colspan
        const freshMangaData = await fetchMangaData();
        // Filter out any leftover placeholders from previous failed commits if necessary
        // mangaDataCache = mangaDataCache.filter(m => m.id !== -1);
        renderMangaTable(freshMangaData);
    }

    // --- Event Listeners ---
    addMangaForm.addEventListener('submit', handleAddManga);
    refreshButton.addEventListener('click', loadAndRenderManga);
    // Use event delegation for table actions
    mangaTableBody.addEventListener('click', handleTableActions);

    // --- Initial Load ---
    loadAndRenderManga();

    // Store manga data globally within this scope for easy updates
    let mangaDataCache = [];

});
