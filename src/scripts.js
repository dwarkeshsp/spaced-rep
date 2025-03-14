// Import Claude API functions
import { 
    generateCardsWithClaude, 
    generateQuestionsWithClaude,
    analyzeTextWithClaude,
    getStoredApiKeys,
    storeApiKeys,
    clearStoredApiKeys,
    validateAnthropicApiKey,
    hasApiKeys
} from './claude-api.js';

document.addEventListener('DOMContentLoaded', () => {
    // API Key Management
    const apiKeyModal = document.getElementById('apiKeyModal');
    const settingsButton = document.getElementById('settingsButton');
    const anthropicApiKeyInput = document.getElementById('anthropicApiKey');
    const mochiApiKeyInput = document.getElementById('mochiApiKey');
    const storeLocallyCheckbox = document.getElementById('storeLocallyCheckbox');
    const apiKeySaveButton = document.getElementById('apiKeySave');
    const apiKeyCancelButton = document.getElementById('apiKeyCancel');
    const anthropicApiKeyError = document.getElementById('anthropicApiKeyError');
    
    // Check for stored API keys on startup
    const storedKeys = getStoredApiKeys();
    if (storedKeys.anthropicApiKey) {
        // Pre-fill the form with stored keys (masked)
        anthropicApiKeyInput.value = storedKeys.anthropicApiKey;
        if (storedKeys.mochiApiKey) {
            mochiApiKeyInput.value = storedKeys.mochiApiKey;
            // Fetch decks right away if we have a Mochi API key
            fetchDecks()
                .then(() => console.log('Loaded Mochi decks on startup'))
                .catch(error => console.error('Failed to load Mochi decks on startup:', error));
        }
    } else {
        // Show API key modal on startup if no API keys are stored
        showApiKeyModal();
    }
    
    // Settings button opens the API key modal
    settingsButton.addEventListener('click', showApiKeyModal);
    
    // Save button in API key modal
    apiKeySaveButton.addEventListener('click', async () => {
        const anthropicKey = anthropicApiKeyInput.value.trim();
        const mochiKey = mochiApiKeyInput.value.trim();
        const storeLocally = storeLocallyCheckbox.checked;
        
        // Validate the Anthropic API key
        if (!validateAnthropicApiKey(anthropicKey)) {
            anthropicApiKeyError.textContent = 'Please enter a valid Claude API key (starts with sk-ant-)';
            return;
        }
        
        // Store the API keys
        const saveSuccess = storeApiKeys(anthropicKey, mochiKey, storeLocally);
        
        if (saveSuccess) {
            // Close the modal
            apiKeyModal.style.display = 'none';
            
            // Update UI based on available keys
            updateUiForApiKeys();
            
            // Fetch decks if Mochi API key is provided
            if (mochiKey) {
                try {
                    await fetchDecks();
                    console.log('Successfully fetched Mochi decks with user key');
                } catch (error) {
                    console.error('Failed to fetch Mochi decks:', error);
                    showNotification('Failed to connect to Mochi API', 'error');
                }
            }
            
            // Show success notification
            showNotification('API keys saved successfully', 'success');
        } else {
            // Show error notification
            showNotification('Failed to save API keys', 'error');
        }
    });
    
    // Cancel button in API key modal
    apiKeyCancelButton.addEventListener('click', () => {
        // If we have API keys stored, just close the modal
        if (hasApiKeys()) {
            apiKeyModal.style.display = 'none';
        } else {
            // Otherwise, show a warning
            if (confirm('Without an API key, the application cannot function. Are you sure you want to cancel?')) {
                apiKeyModal.style.display = 'none';
            }
        }
    });
    
    function showApiKeyModal() {
        // Reset error message
        anthropicApiKeyError.textContent = '';
        
        // Fill in the form with stored values if available
        const storedKeys = getStoredApiKeys();
        if (storedKeys.anthropicApiKey) {
            anthropicApiKeyInput.value = storedKeys.anthropicApiKey;
        }
        if (storedKeys.mochiApiKey) {
            mochiApiKeyInput.value = storedKeys.mochiApiKey;
        }
        
        // Show the modal
        apiKeyModal.style.display = 'flex';
    }
    
    function updateUiForApiKeys() {
        const keys = getStoredApiKeys();
        
        // Update export button text based on whether we have a Mochi API key
        const exportButton = document.getElementById('exportButton');
        if (keys.mochiApiKey) {
            exportButton.textContent = 'Export to Mochi';
        } else {
            exportButton.textContent = 'Export as Markdown';
        }
    }
    
    // Call this on startup to set up the UI correctly
    updateUiForApiKeys();
    // DOM Elements
    const textInput = document.getElementById('textInput');
    const generateButton = document.getElementById('generateButton');
    const generateQuestionsButton = document.getElementById('generateQuestionsButton');
    const cardsContainer = document.getElementById('cardsContainer');
    const questionsContainer = document.getElementById('questionsContainer');
    const exportButton = document.getElementById('exportButton');
    const exportQuestionsButton = document.getElementById('exportQuestionsButton');
    const clearCardsButton = document.getElementById('clearCardsButton');
    const clearQuestionsButton = document.getElementById('clearQuestionsButton');
    const cardCountElement = document.getElementById('cardCount');
    const questionCountElement = document.getElementById('questionCount');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const cardsControlGroup = document.getElementById('cards-controls');
    const questionsControlGroup = document.getElementById('questions-controls');
    const splitterHandle = document.querySelector('.splitter-handle');
    
    // App State
    const state = {
        cards: [],
        questions: [],
        selectedText: '',
        currentDeck: null,
        decks: {},
        documentContext: '',
        isAnalyzing: false,
        fromPaste: false
    };
    
    // Fetch decks from Mochi API
    async function fetchDecks() {
        try {
            // Check if we have a client-side Mochi API key
            const { mochiApiKey } = getStoredApiKeys();
            
            if (!mochiApiKey) {
                console.warn('Mochi API key not configured. Using fallback decks.');
                state.decks = { "General": "general" };
                state.currentDeck = "General";
                
                // Update export button text
                const exportButton = document.getElementById('exportButton');
                if (exportButton) {
                    exportButton.textContent = 'Export as Markdown';
                }
                
                return;
            }
            
            // First try to use the server endpoint with user's API key
            try {
                // Pass the user's Mochi API key to the server endpoint
                const response = await fetch(`/api/mochi-decks?userMochiKey=${encodeURIComponent(mochiApiKey)}`);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success && data.decks) {
                        // Store the decks in the state
                        state.decks = data.decks;
                        
                        // Set currentDeck to first deck in the list
                        state.currentDeck = Object.keys(data.decks)[0] || "General";
                        console.log(`Loaded ${Object.keys(data.decks).length} active decks from Mochi`);
                        return;
                    }
                }
            } catch (serverError) {
                console.warn('Server-side Mochi API failed:', serverError);
            }
            
            // If server-side fails, try client-side API
            if (mochiApiKey) {
                // Mochi uses HTTP Basic Auth with API key followed by colon
                const authHeader = `Basic ${btoa(`${mochiApiKey}:`)}`;
                
                try {
                    // Directly call Mochi API from the client
                    const response = await fetch('https://app.mochi.cards/api/decks/', {
                        method: 'GET',
                        headers: {
                            'Authorization': authHeader
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Mochi API Error: ${await response.text()}`);
                    }
                    
                    const decksData = await response.json();
                    
                    // Transform data for client use
                    const formattedDecks = {};
                    let activeDecksCount = 0;
                    
                    decksData.docs.forEach(deck => {
                        // Skip decks that are in trash or archived
                        if (deck['trashed?'] || deck['archived?']) {
                            return; // Skip this deck
                        }
                        
                        // Only include active decks
                        activeDecksCount++;
                        
                        // Remove [[ ]] if present in the ID
                        const cleanId = deck.id.replace(/\[\[|\]\]/g, '');
                        formattedDecks[deck.name] = cleanId;
                    });
                    
                    console.log(`Loaded ${activeDecksCount} active decks out of ${decksData.docs.length} total decks from Mochi API`);
                    
                    // Store the decks in the state
                    state.decks = formattedDecks;
                    
                    // Set currentDeck to first deck in the list
                    state.currentDeck = Object.keys(formattedDecks)[0] || "General";
                    
                    // Update export button text
                    const exportButton = document.getElementById('exportButton');
                    if (exportButton) {
                        exportButton.textContent = 'Export to Mochi';
                    }
                    
                    return;
                } catch (clientApiError) {
                    console.error('Error using client-side Mochi API:', clientApiError);
                }
            }
            
            // Create deck selector dropdown
            createDeckSelector();
            
        } catch (error) {
            console.error('Error fetching decks:', error);
            // Fallback to a simple deck structure
            state.decks = { "General": "general" };
            state.currentDeck = "General";
            
            // Create deck selector with fallback
            createDeckSelector();
        }
    }
    
    // Function to show status notifications
    function showNotification(message, type = 'info', duration = 3000) {
        // Remove any existing notification
        const existingNotification = document.querySelector('.status-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `status-notification ${type}`;
        
        // Add icon
        const icon = document.createElement('span');
        icon.className = 'icon';
        notification.appendChild(icon);
        
        // Add message
        const messageEl = document.createElement('span');
        messageEl.textContent = message;
        notification.appendChild(messageEl);
        
        // Add to document
        document.body.appendChild(notification);
        
        // Show notification with animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Hide after duration
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, duration);
        
        return notification;
    }
    
    // Event Listeners
    generateButton.addEventListener('click', generateCardsFromSelection);
    generateQuestionsButton.addEventListener('click', generateQuestionsFromSelection);
    exportButton.addEventListener('click', exportToMochi);
    exportQuestionsButton.addEventListener('click', exportQuestions);
    clearCardsButton.addEventListener('click', clearAllCards);
    clearQuestionsButton.addEventListener('click', clearAllQuestions);
    
    // Tab navigation
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            switchToTab(tabId);
        });
    });
    
    function switchToTab(tabId) {
        // Find the tab button
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (!tabButton) return;
        
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Remove active class from all control groups
        document.querySelectorAll('.tab-control-group').forEach(group => {
            group.classList.remove('active');
        });
        
        // Add active class to current button and content
        tabButton.classList.add('active');
        document.getElementById(tabId).classList.add('active');
        
        // Toggle corresponding control group and update generate button visibility
        if (tabId === 'cards-tab') {
            document.getElementById('cards-controls').classList.add('active');
            generateButton.style.display = 'block';
            generateQuestionsButton.style.display = 'none';
        } else if (tabId === 'questions-tab') {
            document.getElementById('questions-controls').classList.add('active');
            generateButton.style.display = 'none';
            generateQuestionsButton.style.display = 'block';
        }
    }
    
    // Add plain text paste handlers
    textInput.addEventListener('paste', handlePaste);
    
    // Monitor text changes to automatically analyze document
    let textChangeTimeout = null;
    textInput.addEventListener('input', () => {
        // Clear any existing timeout
        if (textChangeTimeout) {
            clearTimeout(textChangeTimeout);
        }
        
        // Set a new timeout to analyze text after typing stops (1.5 second delay)
        textChangeTimeout = setTimeout(() => {
            const fullText = textInput.textContent || '';
            if (fullText.trim().length > 100 && !state.isAnalyzing) {
                analyzeDocumentContext(fullText);
            }
        }, 1500);
    });
    
    // Monitor text selection
    textInput.addEventListener('mouseup', handleTextSelection);
    textInput.addEventListener('keyup', handleTextSelection);
    
    // Periodic check for selections (helps with some edge cases)
    setInterval(handleTextSelection, 500);

    // Enable the button if there's already text in the selection
    handleTextSelection();
    
    // Initialize UI and fetch decks
    updateButtonStates();
    
    // Fetch decks from Mochi API on startup
    fetchDecks().catch(error => {
        console.error('Error initializing decks:', error);
        // Create a fallback deck selector in case of error
        createDeckSelector();
    });
    
    // We no longer need a deck selector in the main UI - we'll only show it when editing a card
    function createDeckSelector() {
        // Simply set the default current deck if none is set yet
        if (!state.currentDeck && Object.keys(state.decks).length > 0) {
            state.currentDeck = Object.keys(state.decks)[0];
        }
        // No UI elements to create here anymore
    }
    
    // Set up the resizable splitter
    let isResizing = false;
    let startY, startHeight;
    
    splitterHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startY = e.clientY;
        const editorPanel = document.querySelector('.editor-panel');
        startHeight = editorPanel.offsetHeight;
        
        document.documentElement.style.cursor = 'row-resize';
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    });
    
    function handleMouseMove(e) {
        if (!isResizing) return;
        
        const editorPanel = document.querySelector('.editor-panel');
        const container = document.querySelector('.splitter-container');
        const deltaY = e.clientY - startY;
        const newHeight = startHeight + deltaY;
        
        // Don't allow editor to be smaller than 100px or larger than 80% of container
        const minHeight = 100;
        const maxHeight = container.offsetHeight * 0.8;
        
        if (newHeight > minHeight && newHeight < maxHeight) {
            editorPanel.style.height = `${newHeight}px`;
        }
    }
    
    function stopResize() {
        if (isResizing) {
            isResizing = false;
            document.documentElement.style.cursor = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResize);
        }
    }
    
    // Prevent scrolling the page when mouse wheel is used over the text input
    textInput.addEventListener('wheel', function(e) {
        const contentHeight = this.scrollHeight;
        const visibleHeight = this.clientHeight;
        const scrollTop = this.scrollTop;
        
        // Check if we're at the top or bottom boundary
        const isAtTop = scrollTop === 0;
        const isAtBottom = scrollTop + visibleHeight >= contentHeight - 1;
        
        // If we're at a boundary and trying to scroll further in that direction, 
        // let the page scroll normally
        if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
            return;
        }
        
        // Otherwise, scroll the text input and prevent page scrolling
        e.preventDefault();
        this.scrollTop += e.deltaY;
    }, { passive: false });
    
    // Functions
    async function handlePaste(e) {
        // Prevent the default paste behavior
        e.preventDefault();
        
        // Get plain text from clipboard
        if (e.clipboardData && e.clipboardData.getData) {
            // Get the plain text
            const text = e.clipboardData.getData('text/plain');
            
            // Insert it at the cursor position using the standard command
            document.execCommand('insertText', false, text);
            
            // Clear any selection state
            clearAllHighlights();
            
            // Update the UI after a short delay
            setTimeout(handleTextSelection, 50);
            
            // If text is long enough, analyze it immediately 
            if (text.length > 100) {
                state.fromPaste = true;
                await analyzeDocumentContext(text);
            }
        }
    }
    
    // Analyze text to extract context summary when text is pasted
    async function analyzeDocumentContext(text) {
        if (!text || text.trim().length < 100 || state.isAnalyzing) {
            return; // Skip short texts or if already analyzing
        }
        
        try {
            // Set analyzing state flag
            state.isAnalyzing = true;
            
            // Update button states to show analyzing
            updateButtonStatesForAnalysis(true);
            
            // Show subtle loading indicator
            const statusElement = document.getElementById('selectionStatus');
            const originalStatus = statusElement.textContent;
            statusElement.textContent = 'Understanding document...';
            
            // Call Claude API to get document context
            const contextSummary = await analyzeTextWithClaude(text);
            
            if (!contextSummary) {
                throw new Error('No context summary returned');
            }
            
            // Store in state for later use
            state.documentContext = contextSummary;
            
            // Show a visual indicator that context is available
            document.body.classList.add('has-document-context');
            
            // Restore original status or show completion
            statusElement.textContent = originalStatus;
            // Only show notification if it's a paste (not from automatic analysis)
            if (state.fromPaste) {
                showNotification('Document understood', 'success', 1500);
                state.fromPaste = false;
            }
            
        } catch (error) {
            console.error('Error analyzing document:', error);
            // Show error notification
            showNotification('Could not fully understand document', 'error', 2000);
        } finally {
            // Reset analyzing state
            state.isAnalyzing = false;
            // Update button states
            updateButtonStatesForAnalysis(false);
        }
    }
    
    // Function to clear all highlights - super simplified approach
    function clearAllHighlights() {
        // Just remove the selection class - no DOM manipulation needed
        textInput.classList.remove('has-selection');
        
        // Clear any selection in the window
        window.getSelection().removeAllRanges();
    }
    
    function handleTextSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        const selectionStatus = document.getElementById('selectionStatus');
        
        // Store selected text in state
        state.selectedText = selectedText;
        
        // Enable/disable buttons based on selection
        const hasSelection = selectedText.length > 0;
        generateButton.disabled = !hasSelection;
        generateQuestionsButton.disabled = !hasSelection;
        
        // Update selection status text
        if (hasSelection) {
            // Update word and character count
            const wordCount = selectedText.split(/\s+/).filter(Boolean).length;
            const charCount = selectedText.length;
            selectionStatus.textContent = `${wordCount} words, ${charCount} chars selected`;
            
            // Show a visual indication of selection
            textInput.classList.add('has-selection');
        } else {
            selectionStatus.textContent = 'No text selected';
            textInput.classList.remove('has-selection');
        }
    }
    
    async function generateCardsFromSelection() {
        const selectedText = state.selectedText;
        console.log("Selected text:", selectedText);
        console.log("Document context:", state.documentContext ? state.documentContext.substring(0, 50) + '...' : 'None');
        
        if (!selectedText) {
            alert('Please select some text first.');
            return;
        }
        
        try {
            // Update UI to show processing state
            generateButton.disabled = true;
            generateButton.textContent = 'Generating...';
            
            // Clear any existing highlights first
            clearAllHighlights();
            
            // Then highlight the selected text
            highlightSelection();
            
            // Get cards from Claude API using available deck options and document context
            const cards = await generateCardsWithClaude(
                selectedText,
                Object.keys(state.decks).join(', '),
                state.documentContext
            );
            
            // Add generated cards to state
            state.cards = [...state.cards, ...cards];
            
            // Render all cards
            renderCards();
            
            // Update buttons state
            updateButtonStates();
            
            // Switch to cards tab
            switchToTab('cards-tab');
            
        } catch (error) {
            console.error('Error generating cards:', error);
            showNotification('Error generating cards: ' + (error.message || 'Please try again.'), 'error');
        } finally {
            generateButton.disabled = false;
            generateButton.textContent = 'Generate Cards';
            
            // No automatic clearing - highlight will remain visible
            // until the user makes another selection or action
        }
    }
    
    async function generateQuestionsFromSelection() {
        const selectedText = state.selectedText;
        
        if (!selectedText) {
            showNotification('Please select some text first.', 'error');
            return;
        }
        
        try {
            // Update UI to show processing state
            generateQuestionsButton.disabled = true;
            generateQuestionsButton.textContent = 'Generating...';
            
            // Clear any existing highlights first
            clearAllHighlights();
            
            // Then highlight the selected text
            highlightSelection();
            
            // Get questions from Claude API with proper error handling
            let questions;
            try {
                questions = await generateQuestionsWithClaude(selectedText, state.documentContext);
                
                if (!questions || !Array.isArray(questions) || questions.length === 0) {
                    throw new Error('No valid questions were generated.');
                }
                
                // Check if we got an error response
                if (questions.length === 1 && questions[0].topic === 'Error') {
                    throw new Error(questions[0].question);
                }
                
            } catch (apiError) {
                console.error('API error generating questions:', apiError);
                showNotification('Error from Claude API. Please try again with a different text selection.', 'error');
                return;
            }
            
            // Add generated questions to state
            state.questions = [...state.questions, ...questions];
            
            // Render all questions
            renderQuestions();
            
            // Update buttons state
            updateButtonStates();
            
            // Switch to questions tab
            switchToTab('questions-tab');
            
            // Show success notification
            showNotification(`${questions.length} questions generated successfully`, 'success');
            
        } catch (error) {
            console.error('Error in question generation process:', error);
            showNotification(error.message || 'Failed to generate questions. Please try again.', 'error');
        } finally {
            generateQuestionsButton.disabled = false;
            generateQuestionsButton.textContent = 'Generate Questions';
            
            // No automatic clearing - highlight will remain visible
            // until the user makes another selection or action
        }
    }
    
    // Chat functions removed
    
    
    // Simple approach: We won't try to modify the DOM for highlighting.
    // Instead, we'll create a new element that overlays the text.
    
    // Variable to track the highlight overlay element
    let highlightOverlay = null;
    
    function highlightSelection() {
        // Clear any existing highlight first
        if (highlightOverlay) {
            highlightOverlay.remove();
            highlightOverlay = null;
        }
        
        try {
            // Get the selected text from state
            const selectedText = state.selectedText;
            if (!selectedText || selectedText.length === 0) return;
            
            // Instead of modifying the DOM, we'll just add a class to the text input
            // to show the user their selection was registered
            textInput.classList.add('has-selection');
            
            // That's it! We'll let the native browser selection handle the highlighting
            // This is much more reliable than trying to manipulate the DOM
            
        } catch (e) {
            console.error('Error in highlighting:', e);
        }
    }
    
    function renderCards() {
        cardsContainer.innerHTML = '';
        
        state.cards.forEach((card, index) => {
            const cardElement = createCardElement(card, index);
            cardsContainer.appendChild(cardElement);
        });
        
        // Update card count
        cardCountElement.textContent = `(${state.cards.length})`;
    }
    
    function renderQuestions() {
        questionsContainer.innerHTML = '';
        
        state.questions.forEach((question, index) => {
            const questionElement = createQuestionElement(question, index);
            questionsContainer.appendChild(questionElement);
        });
        
        // Update question count
        questionCountElement.textContent = `(${state.questions.length})`;
    }
    
    function createCardElement(card, index) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        
        // Sanitize the card data to ensure it's rendered properly
        const sanitizeHtml = (text) => {
            // Create a temporary div
            const tempDiv = document.createElement('div');
            // Set the text content (this escapes HTML)
            tempDiv.textContent = text;
            // Return the sanitized HTML
            return tempDiv.innerHTML;
        };
        
        // Ensure the content is properly formatted strings, not JSON objects
        const front = typeof card.front === 'string' ? sanitizeHtml(card.front) : sanitizeHtml(JSON.stringify(card.front));
        const back = typeof card.back === 'string' ? sanitizeHtml(card.back) : sanitizeHtml(JSON.stringify(card.back));
        const deck = typeof card.deck === 'string' ? sanitizeHtml(card.deck) : sanitizeHtml(JSON.stringify(card.deck));
        
        cardDiv.innerHTML = `
            <div class="card-header">
                <div class="card-header-left">
                    <span class="card-deck">${deck}</span>
                </div>
                <div class="card-header-right">
                    <button class="edit-deck-button">Change Deck</button>
                    <button class="delete-button" data-index="${index}">Delete</button>
                </div>
            </div>
            <div class="card-content">
                <div class="card-front">
                    <div class="card-label">Question:</div>
                    <div class="card-text" contenteditable="true">${front}</div>
                </div>
                <div class="card-back">
                    <div class="card-label">Answer:</div>
                    <div class="card-text" contenteditable="true">${back}</div>
                </div>
            </div>
        `;
        
        // Add event listeners
        const deleteButton = cardDiv.querySelector('.delete-button');
        deleteButton.addEventListener('click', () => deleteCard(index));
        
        const editDeckButton = cardDiv.querySelector('.edit-deck-button');
        editDeckButton.addEventListener('click', () => editCardDeck(index));
        
        // Make card content editable
        const frontText = cardDiv.querySelector('.card-front .card-text');
        const backText = cardDiv.querySelector('.card-back .card-text');
        
        frontText.addEventListener('blur', () => {
            // Get text content instead of innerHTML to avoid HTML injection
            state.cards[index].front = frontText.textContent;
        });
        
        backText.addEventListener('blur', () => {
            // Get text content instead of innerHTML to avoid HTML injection
            state.cards[index].back = backText.textContent;
        });
        
        return cardDiv;
    }
    
    function createQuestionElement(question, index) {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        
        // Sanitize the question data to ensure it's rendered properly
        const sanitizeHtml = (text) => {
            const tempDiv = document.createElement('div');
            tempDiv.textContent = text;
            return tempDiv.innerHTML;
        };
        
        // Ensure content is properly formatted
        const questionText = typeof question.question === 'string' ? 
            sanitizeHtml(question.question) : sanitizeHtml(JSON.stringify(question.question));
            
        const topic = question.topic && typeof question.topic === 'string' ? 
            sanitizeHtml(question.topic) : 'General';
        
        questionDiv.innerHTML = `
            <div class="question-header">
                <div class="question-header-left">
                    <span class="question-topic">${topic}</span>
                </div>
                <div class="question-header-right">
                    <button class="delete-question-button" data-index="${index}">Delete</button>
                </div>
            </div>
            <div class="question-body">
                <div class="question-text" contenteditable="true">${questionText}</div>
            </div>
        `;
        
        // Add event listeners
        const deleteButton = questionDiv.querySelector('.delete-question-button');
        deleteButton.addEventListener('click', () => deleteQuestion(index));
        
        // Make question content editable
        const questionTextElem = questionDiv.querySelector('.question-text');
        questionTextElem.addEventListener('blur', () => {
            state.questions[index].question = questionTextElem.textContent;
        });
        
        return questionDiv;
    }
    
    function deleteCard(index) {
        state.cards.splice(index, 1);
        renderCards();
        updateButtonStates();
    }
    
    function deleteQuestion(index) {
        state.questions.splice(index, 1);
        renderQuestions();
        updateButtonStates();
    }
    
    function editCardDeck(index) {
        const card = state.cards[index];
        const deckNames = Object.keys(state.decks);
        
        if (deckNames.length === 0) {
            showNotification('No decks available. Please check Mochi connection.', 'error');
            return;
        }
        
        // Create an improved modal dialog with a dropdown
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const modalHeader = document.createElement('h3');
        modalHeader.textContent = 'Select Deck';
        
        const modalSubHeader = document.createElement('p');
        modalSubHeader.className = 'modal-subheader';
        modalSubHeader.textContent = 'Choose a deck for this card:';
        
        // Create a styled select element
        const selectContainer = document.createElement('div');
        selectContainer.className = 'modal-select-container';
        
        const deckSelect = document.createElement('select');
        deckSelect.className = 'deck-select';
        
        // Add a refresh button
        const refreshButton = document.createElement('button');
        refreshButton.className = 'modal-refresh-button';
        refreshButton.title = 'Refresh deck list from Mochi';
        refreshButton.innerHTML = '↻';
        refreshButton.addEventListener('click', () => {
            refreshButton.disabled = true;
            
            fetchDecks().then(() => {
                // Update the select options
                deckSelect.innerHTML = '';
                const updatedDeckNames = Object.keys(state.decks).sort((a, b) => 
                    a.localeCompare(b, undefined, { sensitivity: 'base' })
                );
                
                updatedDeckNames.forEach(deckName => {
                    const option = document.createElement('option');
                    option.value = deckName;
                    option.textContent = deckName;
                    if (deckName === card.deck) {
                        option.selected = true;
                    }
                    deckSelect.appendChild(option);
                });
                
                // Show confirmation
                refreshButton.innerHTML = '✓';
                setTimeout(() => {
                    refreshButton.innerHTML = '↻';
                    refreshButton.disabled = false;
                }, 1500);
                
                showNotification(`${updatedDeckNames.length} decks loaded`, 'success');
            }).catch(error => {
                console.error('Error refreshing decks:', error);
                refreshButton.innerHTML = '✗';
                setTimeout(() => {
                    refreshButton.innerHTML = '↻';
                    refreshButton.disabled = false;
                }, 1500);
                
                showNotification('Failed to refresh decks', 'error');
            });
        });
        
        // Get deck names and sort them alphabetically
        const sortedDeckNames = deckNames.sort((a, b) => 
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
        
        // Add options based on available decks
        sortedDeckNames.forEach(deckName => {
            const option = document.createElement('option');
            option.value = deckName;
            option.textContent = deckName;
            if (deckName === card.deck) {
                option.selected = true;
            }
            deckSelect.appendChild(option);
        });
        
        selectContainer.appendChild(deckSelect);
        selectContainer.appendChild(refreshButton);
        
        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'modal-cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });
        
        const saveButton = document.createElement('button');
        saveButton.textContent = 'Update Deck';
        saveButton.className = 'modal-save';
        saveButton.addEventListener('click', () => {
            const oldDeck = card.deck;
            card.deck = deckSelect.value;
            renderCards();
            document.body.removeChild(modalOverlay);
            
            if (oldDeck !== card.deck) {
                showNotification(`Card moved to "${card.deck}" deck`, 'success');
            }
        });
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(saveButton);
        
        // Assemble the modal
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalSubHeader);
        modalContent.appendChild(selectContainer);
        modalContent.appendChild(buttonContainer);
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    }
    
    function updateButtonStates() {
        // Cards buttons
        const hasCards = state.cards.length > 0;
        exportButton.disabled = !hasCards;
        clearCardsButton.disabled = !hasCards;
        
        // Questions buttons
        const hasQuestions = state.questions.length > 0;
        exportQuestionsButton.disabled = !hasQuestions;
        clearQuestionsButton.disabled = !hasQuestions;
    }
    
    function updateButtonStatesForAnalysis(isAnalyzing) {
        // Create overlays if they don't exist
        const analysisStatus = document.getElementById('analysisOverlay');
        if (!analysisStatus) {
            createAnalysisOverlay();
        }
        
        // Get the elements (now they must exist)
        const status = document.getElementById('analysisOverlay');
        const generateButtonOverlay = generateButton.parentElement.querySelector('.button-overlay');
        const questionsButtonOverlay = generateQuestionsButton.parentElement.querySelector('.button-overlay');
        
        if (isAnalyzing) {
            // Show analyzing status and disable buttons
            status.classList.add('active');
            
            // Disable buttons and show overlays
            generateButton.disabled = true;
            generateQuestionsButton.disabled = true;
            
            // Show button overlays
            generateButtonOverlay.classList.add('active');
            questionsButtonOverlay.classList.add('active');
        } else {
            // Hide analyzing status
            status.classList.remove('active');
            
            // Only enable generate buttons if there's selected text
            const hasSelection = state.selectedText.length > 0;
            generateButton.disabled = !hasSelection;
            generateQuestionsButton.disabled = !hasSelection;
            
            // Hide button overlays
            generateButtonOverlay.classList.remove('active');
            questionsButtonOverlay.classList.remove('active');
        }
    }
    
    function createAnalysisOverlay() {
        // Create the analysis status indicator
        const status = document.createElement('div');
        status.id = 'analysisOverlay'; // Keep same ID for existing code
        status.className = 'analysis-status';
        
        // Create spinner
        const spinner = document.createElement('span');
        spinner.className = 'analysis-spinner';
        
        // Add text
        const text = document.createElement('span');
        text.textContent = 'Understanding document...';
        
        // Assemble elements
        status.appendChild(spinner);
        status.appendChild(text);
        
        // Add to editor panel
        const editorPanel = document.querySelector('.editor-panel');
        editorPanel.style.position = 'relative';
        editorPanel.appendChild(status);
        
        // Add button overlays
        // Wrap both generate buttons in containers
        setupButtonOverlay(generateButton);
        setupButtonOverlay(generateQuestionsButton);
    }
    
    function setupButtonOverlay(button) {
        // Create a container for the button if it's not already in one
        if (!button.parentElement.classList.contains('button-container')) {
            const container = document.createElement('div');
            container.className = 'button-container';
            
            // Replace the button with the container
            button.parentNode.insertBefore(container, button);
            container.appendChild(button);
            
            // Add the overlay
            const overlay = document.createElement('div');
            overlay.className = 'button-overlay';
            
            // Create spinner
            const spinner = document.createElement('span');
            spinner.className = 'analysis-spinner';
            overlay.appendChild(spinner);
            
            // Add the overlay to the container
            container.appendChild(overlay);
        }
    }
    
    function clearAllCards() {
        // Create modal confirmation
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const modalHeader = document.createElement('h3');
        modalHeader.textContent = 'Clear all cards?';
        
        const modalText = document.createElement('p');
        modalText.textContent = 'This action cannot be undone.';
        modalText.style.margin = '10px 0';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'modal-cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });
        
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Clear All';
        confirmButton.className = 'modal-confirm';
        confirmButton.style.backgroundColor = '#ea4335';
        confirmButton.style.color = 'white';
        confirmButton.style.borderColor = '#d93025';
        
        confirmButton.addEventListener('click', () => {
            state.cards = [];
            renderCards();
            updateButtonStates();
            document.body.removeChild(modalOverlay);
            showNotification('All cards cleared', 'info');
        });
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalText);
        modalContent.appendChild(buttonContainer);
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    }
    
    function clearAllQuestions() {
        // Create modal confirmation
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        
        const modalHeader = document.createElement('h3');
        modalHeader.textContent = 'Clear all questions?';
        
        const modalText = document.createElement('p');
        modalText.textContent = 'This action cannot be undone.';
        modalText.style.margin = '10px 0';
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'modal-buttons';
        
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'modal-cancel';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
        });
        
        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Clear All';
        confirmButton.className = 'modal-confirm';
        confirmButton.style.backgroundColor = '#ea4335';
        confirmButton.style.color = 'white';
        confirmButton.style.borderColor = '#d93025';
        
        confirmButton.addEventListener('click', () => {
            state.questions = [];
            renderQuestions();
            updateButtonStates();
            document.body.removeChild(modalOverlay);
            showNotification('All questions cleared', 'info');
        });
        
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        
        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalText);
        modalContent.appendChild(buttonContainer);
        
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    }
    
    
    async function exportToMochi() {
        try {
            // Check if we have any cards to export
            if (state.cards.length === 0) {
                showNotification('No cards to export', 'info');
                return;
            }
            
            // Get the stored API keys
            const { mochiApiKey } = getStoredApiKeys();
            
            // If no Mochi API key, export as markdown instead
            if (!mochiApiKey) {
                exportAsMarkdown();
                return;
            }
            
            // If we have a Mochi API key, prepare the cards for Mochi
            const mochiData = formatCardsForMochi();
            const cards = JSON.parse(mochiData).cards;
            
            // Show loading indicator
            exportButton.disabled = true;
            exportButton.textContent = 'Uploading...';
            
            // Use the server endpoint to handle Mochi uploads, passing the user's API key
            const response = await fetch('/api/upload-to-mochi', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    cards,
                    userMochiKey: mochiApiKey // Pass the user's Mochi API key to the server
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to upload to Mochi');
            }
            
            const result = await response.json();
            
            // Success notification
            showNotification(`${result.totalSuccess} of ${result.totalCards} cards uploaded to Mochi successfully!`, 'success');
            
        } catch (error) {
            console.error('Error uploading to Mochi API:', error);
            showNotification('Error uploading to Mochi. Exporting as markdown instead.', 'error');
            
            // Fall back to markdown export
            exportAsMarkdown();
        } finally {
            // Reset button state
            exportButton.disabled = false;
            
            // Update button text based on whether we have a Mochi API key
            const { mochiApiKey } = getStoredApiKeys();
            exportButton.textContent = mochiApiKey ? 'Export to Mochi' : 'Export as Markdown';
        }
    }
    
    function exportAsMarkdown() {
        if (state.cards.length === 0) {
            showNotification('No cards to export', 'info');
            return;
        }
        
        // Format cards as markdown
        let markdown = `# Flashcards - ${new Date().toLocaleDateString()}\n\n`;
        
        // Group cards by deck
        const deckGroups = {};
        
        state.cards.forEach(card => {
            const deckName = card.deck || 'General';
            if (!deckGroups[deckName]) {
                deckGroups[deckName] = [];
            }
            deckGroups[deckName].push(card);
        });
        
        // Add each deck's cards to the markdown
        for (const [deckName, cards] of Object.entries(deckGroups)) {
            markdown += `## ${deckName}\n\n`;
            
            cards.forEach((card, index) => {
                markdown += `### Card ${index + 1}\n\n`;
                markdown += `**Question:** ${card.front}\n\n`;
                markdown += `**Answer:** ${card.back}\n\n`;
                markdown += `---\n\n`;
            });
        }
        
        try {
            // Download the markdown file
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `flashcards-${new Date().toISOString().slice(0, 10)}.md`;
            a.style.display = 'none'; // Hide the element
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            showNotification(`${state.cards.length} cards exported as markdown`, 'success');
        } catch (error) {
            console.error('Error exporting markdown:', error);
            
            // Alternative method for environments where the download might be blocked
            const textarea = document.createElement('textarea');
            textarea.value = markdown;
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                showNotification('Export copied to clipboard instead (download failed)', 'warning');
            } catch (clipboardError) {
                console.error('Clipboard copy failed:', clipboardError);
                showNotification('Export failed. Check console for markdown content', 'error');
                console.log('MARKDOWN CONTENT:');
                console.log(markdown);
            }
            
            document.body.removeChild(textarea);
        }
    }
    
    function exportQuestions() {
        // Format questions as bullet point markdown
        if (state.questions.length === 0) {
            showNotification('No questions to export', 'info');
            return;
        }
        
        let questionsMarkdown = '';
        
        state.questions.forEach(q => {
            questionsMarkdown += `- ${q.question}\n\n`;
        });
        
        try {
            // Download as markdown
            const blob = new Blob([questionsMarkdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `interview-questions-${new Date().toISOString().slice(0, 10)}.md`;
            a.style.display = 'none'; // Hide the element
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
            showNotification(`${state.questions.length} questions exported successfully`, 'success');
        } catch (error) {
            console.error('Error exporting questions:', error);
            
            // Alternative method for environments where the download might be blocked
            const textarea = document.createElement('textarea');
            textarea.value = questionsMarkdown;
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                showNotification('Questions copied to clipboard instead (download failed)', 'warning');
            } catch (clipboardError) {
                console.error('Clipboard copy failed:', clipboardError);
                showNotification('Export failed. Check console for questions content', 'error');
                console.log('QUESTIONS CONTENT:');
                console.log(questionsMarkdown);
            }
            
            document.body.removeChild(textarea);
        }
    }
    
    function formatCardsForMochi() {
        // Group cards by deck
        const deckMap = {};
        
        state.cards.forEach(card => {
            const deckName = card.deck;
            const deckId = state.decks[deckName];
            
            if (!deckId) {
                console.warn(`No deck ID found for deck: ${deckName}`);
                return; // Skip this card
            }
            
            if (!deckMap[deckId]) {
                deckMap[deckId] = [];
            }
            
            // Use the exact Mochi format: front \n---\n back (single newlines)
            deckMap[deckId].push({
                content: `${card.front}\n---\n${card.back}`
            });
        });
        
        // Format according to Mochi's JSON format
        const data = {
            version: 2,
            cards: []
        };
        
        // Add cards with their deck IDs
        for (const [deckId, cards] of Object.entries(deckMap)) {
            cards.forEach(card => {
                data.cards.push({
                    ...card,
                    'deck-id': deckId
                });
            });
        }
        
        console.log('Formatted cards for Mochi:', data);
        return JSON.stringify(data, null, 2);
    }
    
    function downloadExport(data, filename) {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }
});