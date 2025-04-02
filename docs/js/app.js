document.addEventListener('DOMContentLoaded', () => {
    const mangaTableBody = document.getElementById('manga-table-body');
    const addMangaForm = document.getElementById('add-manga-form');
    const githubTokenInput = document.getElementById('github-token');
    const refreshButton = document.getElementById('refresh-button');
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
        // Replace with your actual username and repo name
        const githubUser = 'PhilippeHo27'; // FIXME: Replace with your GitHub username
        const githubRepo = 'MangaFetcher'; // FIXME: Replace with your repo name
        const filePath = 'data/manga_chapters.json';
        const apiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${filePath}`;

        try {
            // 1. Fetch the current file content and SHA
            tokenErrorMessage.textContent = 'Fetching current manga list...';
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    // File doesn't exist yet - handle creation (more complex)
                    tokenErrorMessage.textContent = 'Error: manga_chapters.json not found. Initial creation via UI not yet supported.';
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

            const commitResponse = await fetch(apiUrl, {
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

    // --- Theme Switching Logic ---
    const THEME_STORAGE_KEY = 'mangaFetcherTheme';
    const BG_THEME_STORAGE_KEY = 'mangaFetcherBgTheme';

    function applyTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        // Update active button state
        const currentActive = accentThemeSwitcher.querySelector('.theme-button.active');
        if (currentActive) {
            currentActive.classList.remove('active');
        }
        const newActive = accentThemeSwitcher.querySelector(`.theme-button[data-theme="${themeName}"]`);
        if (newActive) {
            newActive.classList.add('active');
        }
        localStorage.setItem(THEME_STORAGE_KEY, themeName);
        console.log(`Theme set to: ${themeName}`);
    }

    function applyBgTheme(bgThemeName) {
        document.documentElement.setAttribute('data-bg-theme', bgThemeName);
        // Update active button state
        const currentActive = bgThemeSwitcher.querySelector('.theme-button.active');
        if (currentActive) {
            currentActive.classList.remove('active');
        }
        const newActive = bgThemeSwitcher.querySelector(`.theme-button[data-bg-theme="${bgThemeName}"]`);
        if (newActive) {
            newActive.classList.add('active');
        }
        localStorage.setItem(BG_THEME_STORAGE_KEY, bgThemeName);
        console.log(`Background Theme set to: ${bgThemeName}`);
    }

    accentThemeSwitcher.addEventListener('click', (event) => {
        if (event.target.classList.contains('theme-button')) {
            const theme = event.target.dataset.theme;
            if (theme) {
                applyTheme(theme);
            }
        }
    });

    bgThemeSwitcher.addEventListener('click', (event) => {
        if (event.target.classList.contains('theme-button')) {
            const bgTheme = event.target.dataset.bgTheme;
            if (bgTheme) {
                applyBgTheme(bgTheme);
            }
        }
    });

    // Apply saved theme on load or default
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'default'; 
    applyTheme(savedTheme);

    // Apply saved background theme on load or default
    const savedBgTheme = localStorage.getItem(BG_THEME_STORAGE_KEY) || 'default';
    applyBgTheme(savedBgTheme);

    // --- Initial Load ---
    loadAndRenderManga(); 

    // --- GitHub API Interaction (INSECURE - For Demo Only) ---
    async function commitChanges(newMangaDetails) {
        const token = githubTokenInput.value.trim();
        const repo = 'MangaFetcher'; // Deduced from URL
        const owner = 'PhilippeHo27'; // Deduced from URL
        const path = 'data/pending_changes.json'; // The file to update
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
        const commitMessage = `Frontend: Add new manga source - ${newMangaDetails.name}`;

        if (!token) {
            displayTokenError('GitHub token is required.');
            return Promise.reject(new Error('GitHub token is required.')); // Reject the promise
        }

        try {
            // 1. Get current file content and SHA
            let currentSha = null;
            let currentContent = '[]'; // Default to empty array if file doesn't exist
            try {
                clearTokenError(); // Clear previous errors
                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `token ${token}`,
                    }
                });
                if (response.ok) {
                    // Save token on successful fetch (implies token is likely valid)
                    localStorage.setItem('githubToken', token);
                    const data = await response.json();
                    currentSha = data.sha;
                    // Content is base64 encoded
                    currentContent = atob(data.content);
                } else if (response.status === 401) {
                    displayTokenError('Invalid GitHub token.');
                    throw new Error(`GitHub API error (GET): 401 Unauthorized`);
                } else if (response.status === 403) {
                    displayTokenError('Token lacks permissions.');
                    throw new Error(`GitHub API error (GET): 403 Forbidden`);
                } else if (response.status === 404) {
                    // Can be file not found or repo/owner invalid
                    displayTokenError('Repo/File not found or token invalid.');
                    throw new Error(`GitHub API error (GET): 404 Not Found`);
                } else if (response.status !== 404) {
                    // Handle errors other than file not found
                    displayTokenError(`API Error: ${response.status}`);
                    throw new Error(`GitHub API error (GET): ${response.status} ${response.statusText}`);
                }
                // If 404, currentSha remains null, currentContent remains '[]'
                // We allow proceeding to try and create the file
            } catch (fetchError) {
                console.error('Error fetching current pending_changes.json:', fetchError);
                // Decide how to handle - maybe allow creating the file if SHA is null?
                // For now, rethrow or alert user
                // Display specific token error if already set, otherwise generic
                if (!tokenErrorMessage.textContent) {
                    displayTokenError(`Fetch Error: ${fetchError.message}`);
                }
                // Rethrow to stop the commit process and be caught by the outer try/catch
                throw fetchError;
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
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commitPayload)
            });

            if (!putResponse.ok) {
                // Handle specific errors related to token/permissions during PUT
                if (putResponse.status === 401) {
                    displayTokenError('Invalid GitHub token.');
                    throw new Error('GitHub API error (PUT): 401 Unauthorized - Invalid token.');
                } else if (putResponse.status === 403) {
                    displayTokenError('Token lacks permissions.');
                    throw new Error('GitHub API error (PUT): 403 Forbidden - Token lacks permissions.');
                } else if (putResponse.status === 404) {
                    // This might happen if the repo/owner was wrong initially
                    displayTokenError('Repo/Owner not found?');
                    throw new Error('GitHub API error (PUT): 404 Not Found.');
                } else if (putResponse.status === 409) {
                    displayTokenError('Conflict (SHA mismatch?).');
                    throw new Error('GitHub API error (PUT): 409 Conflict - SHA mismatch or branch issue? Try refreshing.');
                } else if (putResponse.status === 422) {
                    displayTokenError('Commit Error (content?).');
                    throw new Error('GitHub API error (PUT): 422 Unprocessable Entity - Invalid content or commit structure?');
                } else {
                    displayTokenError(`API Error: ${putResponse.status}`);
                    throw new Error(`GitHub API error (PUT): ${putResponse.status} ${putResponse.statusText}`);
                }
            }

            console.log('Commit successful:', await putResponse.json());
            // Optionally clear the form or give user feedback
        } catch (error) {
            console.error('Error in commitChanges function:', error);
            // Ensure specific token errors are displayed if not already
            if (!tokenErrorMessage.textContent) {
                displayTokenError(`Commit Error: ${error.message}`);
            }
            throw error;
        }
    }

    function displayError(message) {
        mangaTableBody.innerHTML = `<tr><td colspan="5" class="error">${message}</td></tr>`;
    }

    function displayTokenError(message) {
        if (tokenErrorMessage) {
            tokenErrorMessage.textContent = message;
        } else {
            console.error("Token error message element not found");
        }
    }

    function clearTokenError() {
        if (tokenErrorMessage) {
            tokenErrorMessage.textContent = '';
        }
    }

    // --- Initialization ---
    // Load token from localStorage on page load
    const savedToken = localStorage.getItem('githubToken');
    if (savedToken && githubTokenInput) {
        githubTokenInput.value = savedToken;
    }
});
