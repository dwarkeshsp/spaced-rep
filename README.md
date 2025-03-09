# Mochi Card Generator

A powerful web application for creating high-quality spaced repetition flashcards and podcast interview questions with Claude 3.7, featuring direct Mochi integration.

## Features

- **Spaced Repetition Cards**
  - Paste text and highlight sections to create flashcards
  - Uses Claude 3.7 to generate effective cards following best practices
  - Cards are automatically categorized into appropriate Mochi decks
  - Edit cards inline before exporting

- **Podcast Interview Questions**
  - Generate thought-provoking, open-ended questions for interviews
  - Questions include topic categorization
  - Export as markdown for easy integration with notes

- **Mochi Integration**
  - Dynamic deck fetching from your Mochi account
  - Direct upload to Mochi without file handling
  - Fallback to file export if API is unavailable
  - Properly handles deck organization (excludes trashed/archived)

- **Modern User Interface**
  - Clean, intuitive design with tabbed navigation
  - Real-time notification system
  - Confirmation modals for destructive actions
  - Resizable split panels for comfortable editing

## Getting Started

### Prerequisites

- Modern web browser
- Claude API key from Anthropic
- (Optional) Mochi API key for direct integration

### Running Locally

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set your API keys as environment variables:
   ```bash
   # Required for card generation
   export ANTHROPIC_API_KEY=your-claude-api-key-here
   
   # Optional for direct Mochi integration
   export MOCHI_API_KEY=your-mochi-api-key-here
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open your browser to `http://localhost:3000`

### Environment Variables

The application uses the following environment variables:

- `ANTHROPIC_API_KEY`: Required for Claude 3.7 API access
- `MOCHI_API_KEY`: Optional for Mochi integration (direct deck fetching and upload)
- `PORT`: Optional server port (defaults to 3000)

## How to Use

### Creating Flashcards

1. Paste text into the input area
2. Highlight a section of text
3. Click "Generate Cards from Selection"
4. Review and edit the generated cards
5. Optionally change the deck for any card
6. Click "Export to Mochi" when finished

### Creating Interview Questions

1. Paste text into the input area
2. Highlight a section of text
3. Click "Generate Questions from Selection"
4. Review and edit the generated questions
5. Click "Export Questions" to download as markdown

## Deployment Options

### Vercel

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add the `ANTHROPIC_API_KEY` and `MOCHI_API_KEY` as environment variables
4. Deploy

### Heroku

1. Create a new Heroku app
2. Push your code to Heroku
3. Set the Config Vars `ANTHROPIC_API_KEY` and `MOCHI_API_KEY`
4. Deploy

## Design Principles

This application follows established principles for effective spaced repetition learning:

- **Atomicity**: Each card tests one specific concept
- **Clarity**: Cards use precise language focused on understanding
- **Connections**: Building relationships between concepts
- **Deep Understanding**: Emphasizing "why" and "how" questions

For interview questions, the application focuses on:

- Open-ended, thought-provoking questions
- Exploring implications and connections
- Questions that elicit detailed, interesting responses
- Contextualized topics for easy organization

## License

MIT