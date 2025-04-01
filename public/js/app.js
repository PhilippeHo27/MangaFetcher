document.addEventListener('DOMContentLoaded', () => {
    const mangaTableBody = document.getElementById('manga-table-body');
    const addMangaForm = document.getElementById('add-manga-form');
    const refreshButton = document.getElementById('refresh-button');
    const mangaDataPath = '../data/manga_chapters.json'; // Relative path from index.html
    const mangaSourcesPath = '../data/manga_sources.json'; // Path to sources

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
        const isXpath = document.getElementById('selector-xpath').checked;

        if (!name || !url || !selector) {
            alert('Please fill in all fields.');
            return;
        }

        const newMangaSource = {
            // id will be assigned by the backend script
            name: name,
            url: url,
            selector: selector,
            use_xpath: isXpath,
            isActive: true
        };

        console.log('Attempting to add (UI only):', newMangaSource);
        alert(`Manga "${name}" added to UI (temporary). Run 'python backend/MangaScraper.py add --name "${name}" --url "${url}" --selector "${selector}" ${isXpath ? '--xpath' : ''}' to save permanently.`);

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

});
