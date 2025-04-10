document.addEventListener('DOMContentLoaded', () => {
    const mangaTableBody = document.getElementById('manga-table-body');
    const addMangaForm = document.getElementById('add-manga-form');
    const githubTokenInput = document.getElementById('github-token');
    const mangaDataPath = 'data/manga_chapters.json';
    const tokenErrorMessage = document.getElementById('token-error-message');
    const themeSwitcher = document.getElementById('theme-switcher');
    const accentThemeSwitcher = document.getElementById('accent-theme-switcher');
    const bgThemeSwitcher = document.getElementById('bg-theme-switcher');

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
        const readStatuses = loadReadStatuses(); // Load read statuses from local storage

        if (!mangaData || mangaData.length === 0) {
            mangaTableBody.innerHTML = '<tr><td colspan="4">No manga tracked yet, or data file is empty/invalid. Add one above or run the update script.</td></tr>';
            return;
        }

        mangaData.forEach(manga => {
            const row = document.createElement('tr');
            const isRead = readStatuses[manga.id] || false; // Get read status for this manga ID

            // Add 'is-read' class if manga is read
            if (isRead) {
                row.classList.add('is-read');
            }
            row.dataset.mangaId = manga.id; // Store manga ID on the row

            const chapterText = manga.latest_chapter_text || 'N/A';
            const chapterUrl = manga.latest_chapter_url;
            const sourceUrl = manga.source_url; // Get the source URL
            const lastScraped = manga.last_scraped_at ? new Date(manga.last_scraped_at).toLocaleString() : 'Never';

            row.innerHTML = `
                <td>${manga.name || 'N/A'}</td>
                <td>
                    ${chapterUrl ? 
                        `<a href="${chapterUrl}" target="_blank" rel="noopener noreferrer">${chapterText}</a>` : 
                        chapterText
                    }
                    <br><small>Checked: ${lastScraped}</small>
                </td>
                <td>
                     ${sourceUrl ? 
                        `<a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Source Page</a>` : 
                        'N/A'
                     }
                </td>
                <td>
                    <button class="btn btn-read" data-id="${manga.id}">
                        ${isRead ? 'Mark Unread' : 'Mark Read'}
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

        const token = githubTokenInput.value.trim();
        if (!token) {
            tokenErrorMessage.textContent = 'GitHub token is required to add manga.';
            return;
        }
        if (!name || !url || !selector) {
            tokenErrorMessage.textContent = 'Manga Name, URL, and Selector are required.'; // Use the same error div for general errors
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

        // ** GitHub API Interaction **
        const githubUser = 'PhilippeHo27';
        const githubRepo = 'MangaFetcher';
        const githubFilePath = 'data/manga_sources.json';
        const githubApiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${githubFilePath}`;

        try {
            // 1. Fetch the current file content and SHA
            tokenErrorMessage.textContent = 'Fetching current manga list...';
            const response = await fetch(githubApiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // File doesn't exist yet - handle creation (more complex)
                    tokenErrorMessage.textContent = 'Error: manga_sources.json not found. Initial creation via UI not yet supported.';
                    // TODO: Implement file creation logic if needed
                } else if (response.status === 401) {
                     tokenErrorMessage.textContent = 'Error: Invalid GitHub token or insufficient permissions.';
                } else {
                    tokenErrorMessage.textContent = `Error fetching file: ${response.status} ${response.statusText}`;
                }
                throw new Error(`GitHub API fetch failed: ${response.status}`);
            }

            const fileData = await response.json();
            const currentContentBase64 = fileData.content;
            const currentSha = fileData.sha;

            // 2. Decode, Update, Encode
            tokenErrorMessage.textContent = 'Updating manga list...';
            let currentMangas = [];
            try {
                 // Decode Base64 content
                 const decodedContent = atob(currentContentBase64);
                 currentMangas = JSON.parse(decodedContent);
                 if (!Array.isArray(currentMangas)) { // Basic validation
                     throw new Error('Invalid JSON structure: Expected an array.');
                 }
            } catch (e) {
                tokenErrorMessage.textContent = `Error parsing existing JSON: ${e.message}`;
                console.error("Error decoding/parsing JSON:", e);
                return; // Stop processing
            }

            // Add the new manga
            currentMangas.push(newMangaSource);

            // Encode the updated array back to Base64 JSON
            const updatedContent = JSON.stringify(currentMangas, null, 2); // Pretty print JSON
            const updatedContentBase64 = btoa(updatedContent);

            // 3. Commit the changes
            tokenErrorMessage.textContent = 'Committing changes to GitHub...';
            const commitMessage = `Add manga: ${name}`;

            const commitResponse = await fetch(githubApiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: commitMessage,
                    content: updatedContentBase64,
                    sha: currentSha // IMPORTANT: Provide the SHA of the file being replaced
                })
            });

            if (!commitResponse.ok) {
                 if (commitResponse.status === 401) {
                     tokenErrorMessage.textContent = 'Error: Invalid GitHub token or insufficient permissions for commit.';
                } else if (commitResponse.status === 409) {
                     tokenErrorMessage.textContent = 'Error: Conflict detected. Please refresh and try again.';
                } else {
                     tokenErrorMessage.textContent = `Error committing file: ${commitResponse.status} ${commitResponse.statusText}`;
                }
                throw new Error(`GitHub API commit failed: ${commitResponse.status}`);
            }

            tokenErrorMessage.textContent = 'Manga added successfully to GitHub!';
            console.log('Commit successful:', await commitResponse.json());
            addMangaForm.reset(); // Clear form on success
            // Optionally, trigger a refresh of the displayed list after a short delay
            setTimeout(loadAndRenderManga, 1000); // Refresh list after 1s

        } catch (error) {
            console.error('Error in GitHub interaction:', error);
            // Error message already set in specific catch blocks or will be generic
            if (!tokenErrorMessage.textContent.startsWith('Error:')) {
                 tokenErrorMessage.textContent = 'An unexpected error occurred.';
            }
        }

        addMangaForm.reset(); // Clear the form
        // Potentially refresh list after a short delay, though it won't show the new manga yet
    }

    // Function to save read statuses to localStorage
    function saveReadStatus(mangaId, isRead) {
        const readStatuses = loadReadStatuses();
        readStatuses[mangaId] = isRead;
        localStorage.setItem('readStatuses', JSON.stringify(readStatuses));
        
        // Track changes for later commit
        const pendingChanges = loadPendingChanges();
        pendingChanges[mangaId] = isRead;
        localStorage.setItem('pendingReadChanges', JSON.stringify(pendingChanges));
        
        // Show the update button if we have pending changes
        updatePendingChangesUI();
    }

    // Function to load pending changes
    function loadPendingChanges() {
        const pendingChanges = localStorage.getItem('pendingReadChanges');
        return pendingChanges ? JSON.parse(pendingChanges) : {};
    }
    
    // Function to update UI based on pending changes
    function updatePendingChangesUI() {
        const pendingChanges = loadPendingChanges();
        const pendingCount = Object.keys(pendingChanges).length;
        const updateButton = document.getElementById('update-read-status-button');
        
        if (updateButton) {
            if (pendingCount > 0) {
                updateButton.textContent = `Update List (${pendingCount} change${pendingCount > 1 ? 's' : ''})`;
                updateButton.classList.add('has-changes');
                updateButton.disabled = false;
            } else {
                updateButton.textContent = 'Update List';
                updateButton.classList.remove('has-changes');
                updateButton.disabled = true;
            }
        }
    }

    // Function to handle clicking 'Mark Read/Unread' buttons
    function handleMarkRead(event) {
        if (!event.target.classList.contains('btn-read')) return; // Ignore clicks not on the button

        const button = event.target;
        const mangaId = parseInt(button.dataset.id, 10);
        const row = button.closest('tr');
        const isCurrentlyRead = row.classList.contains('is-read');
        const markAsStatus = !isCurrentlyRead;

        console.log(`Marking manga ID ${mangaId} as ${markAsStatus ? 'read' : 'unread'}`);
        
        // Update UI
        row.classList.toggle('is-read');
        button.textContent = markAsStatus ? 'Mark Unread' : 'Mark Read';
        
        // Save to localStorage and track for later commit
        saveReadStatus(mangaId, markAsStatus);
    }

    // Function to commit pending read status changes to GitHub
    async function commitReadStatusChanges() {
        const pendingChanges = loadPendingChanges();
        if (Object.keys(pendingChanges).length === 0) {
            alert('No changes to commit.');
            return;
        }
        
        const token = githubTokenInput.value.trim();
        if (!token) {
            alert('GitHub token is required to update read statuses.');
            return;
        }
        
        const updateStatusMessage = document.getElementById('update-status-message');
        if (updateStatusMessage) {
            updateStatusMessage.textContent = 'Preparing to commit changes...';
            updateStatusMessage.style.display = 'block';
        }
        
        // GitHub API details
        const githubUser = 'PhilippeHo27';
        const githubRepo = 'MangaFetcher';
        const githubFilePath = 'data/read_status.json';
        const githubApiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${githubFilePath}`;
        
        try {
            // 1. Try to fetch existing file
            let currentSha = '';
            let currentContent = {};
            
            try {
                const response = await fetch(githubApiUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });
                
                if (response.ok) {
                    const fileData = await response.json();
                    currentSha = fileData.sha;
                    
                    // Decode Base64 content
                    const decodedContent = atob(fileData.content);
                    currentContent = JSON.parse(decodedContent);
                } else if (response.status !== 404) {
                    // If error is not 404 (file not found), throw error
                    throw new Error(`GitHub API fetch failed: ${response.status}`);
                }
                // If 404, we'll create a new file
            } catch (error) {
                console.log('File might not exist yet or other error:', error);
                // Continue with empty content if file doesn't exist
            }
            
            // 2. Merge current content with pending changes
            const updatedContent = { ...currentContent, ...pendingChanges };
            
            // 3. Encode and commit
            if (updateStatusMessage) {
                updateStatusMessage.textContent = 'Committing changes to GitHub...';
            }
            
            const updatedContentString = JSON.stringify(updatedContent, null, 2);
            const updatedContentBase64 = btoa(updatedContentString);
            
            const commitMessage = `Update read status for ${Object.keys(pendingChanges).length} manga`;
            
            const commitData = {
                message: commitMessage,
                content: updatedContentBase64
            };
            
            // Add SHA if we're updating an existing file
            if (currentSha) {
                commitData.sha = currentSha;
            }
            
            const commitResponse = await fetch(githubApiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commitData)
            });
            
            if (!commitResponse.ok) {
                throw new Error(`GitHub API commit failed: ${commitResponse.status}`);
            }
            
            // Clear pending changes on success
            localStorage.removeItem('pendingReadChanges');
            updatePendingChangesUI();
            
            if (updateStatusMessage) {
                updateStatusMessage.textContent = 'Read statuses updated successfully!';
                setTimeout(() => {
                    updateStatusMessage.style.display = 'none';
                }, 3000);
            }
            
        } catch (error) {
            console.error('Error committing read status changes:', error);
            if (updateStatusMessage) {
                updateStatusMessage.textContent = `Error: ${error.message}`;
            }
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
    if (addMangaForm) {
        addMangaForm.addEventListener('submit', handleAddManga);
    }
    
    // Add event listener for the Update List button
    const updateButton = document.getElementById('update-read-status-button');
    if (updateButton) {
        updateButton.addEventListener('click', commitReadStatusChanges);
    }

    // Initial Load
    loadAndRenderManga();
    updatePendingChangesUI(); // Update UI based on any pending changes

    // --- Theme Switching Logic ---
    const THEME_STORAGE_KEY = 'mangaFetcherTheme';
    const ACCENT_THEME_STORAGE_KEY = 'mangaFetcherAccentTheme'; // Separate key for accent
    const BG_THEME_STORAGE_KEY = 'mangaFetcherBgTheme'; // Separate key for background

    function applyAccentTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem(ACCENT_THEME_STORAGE_KEY, themeName);
        
        // Update active button state if the switcher exists
        if (accentThemeSwitcher) {
            // Remove active class from all buttons
            const buttons = accentThemeSwitcher.querySelectorAll('.theme-button');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to the selected button
            const activeButton = accentThemeSwitcher.querySelector(`.theme-button[data-theme="${themeName}"]`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
        
        console.log(`Accent theme set to: ${themeName}`);
    }

    function applyBgTheme(themeName) {
        document.documentElement.setAttribute('data-bg-theme', themeName);
        localStorage.setItem(BG_THEME_STORAGE_KEY, themeName);
        
        // Update active button state if the switcher exists
        if (bgThemeSwitcher) {
            // Remove active class from all buttons
            const buttons = bgThemeSwitcher.querySelectorAll('.theme-button');
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to the selected button
            const activeButton = bgThemeSwitcher.querySelector(`.theme-button[data-bg-theme="${themeName}"]`);
            if (activeButton) {
                activeButton.classList.add('active');
            }
        }
        
        console.log(`Background theme set to: ${themeName}`);
    }

    // If accent theme switcher exists, add listeners
    if (accentThemeSwitcher) {
        accentThemeSwitcher.addEventListener('click', (event) => {
            if (event.target.classList.contains('theme-button')) {
                const newTheme = event.target.getAttribute('data-theme');
                if (newTheme) {
                    applyAccentTheme(newTheme);
                }
            }
        });
    }

    // If background theme switcher exists, add listeners
    if (bgThemeSwitcher) {
        bgThemeSwitcher.addEventListener('click', (event) => {
            if (event.target.classList.contains('theme-button')) {
                const newBgTheme = event.target.getAttribute('data-bg-theme');
                if (newBgTheme) {
                    applyBgTheme(newBgTheme);
                }
            }
        });
    }

    // Initial Load: Apply saved themes (check if elements exist before applying)
    const savedAccentTheme = localStorage.getItem(ACCENT_THEME_STORAGE_KEY) || 'default';
    applyAccentTheme(savedAccentTheme);

    const savedBgTheme = localStorage.getItem(BG_THEME_STORAGE_KEY) || 'default';
    applyBgTheme(savedBgTheme);

    // Load token from localStorage on page load
    const savedToken = localStorage.getItem('githubToken');
    if (savedToken && githubTokenInput) {
        githubTokenInput.value = savedToken;
    }
});

// Helper function to load read statuses from localStorage
function loadReadStatuses() {
    const readStatuses = localStorage.getItem('readStatuses');
    return readStatuses ? JSON.parse(readStatuses) : {};
}
