# Game Party Web App

A web-based game party application built with Angular and Node.js, managed with Nx. Players compete to buzz in first and answer trivia questions across multiple phases, with points awarded based on how early they answer.

## Features

### Player Features
- **Name-based Login**: Simple name input stored in browser localStorage
- **Interactive Drawing Canvas**: Tap or click anywhere on screen to create colorful traces that fade after 2 seconds (just for fun!)
- **Buzz Button**: Large, prominent button to signal you're ready to answer
- **First-to-Buzz Ranking**: Server tracks who buzzed first based on server arrival time
- **Answer Submission**: First buzzer gets to submit their answer
- **Real-time Scoreboard**: Live updates every second showing all players and scores
- **Current Round Display**: Shows the item to guess, current phase, and phase hints

### Admin Features
- **Round Management**: Start new rounds with customizable settings
  - Item/category to guess (visible to all players)
  - Secret answer
  - Multiple hints (one revealed per phase)
  - Configurable max phases (1-10)
- **Phase Advancement**: Manually progress through phases to reveal new hints
- **Admin Toggle**: Simple checkbox to show/hide admin controls

### Game Mechanics
- **Phase-based Scoring**: Earlier answers earn more points
  - Phase 1: 10 points
  - Phase 2: 9 points
  - ...
  - Phase 10: 1 point
- **Multi-phase Rounds**: Each round can have up to 10 phases with progressive hints
- **Incorrect Answer Handling**: If first buzzer answers incorrectly, next buzzer gets a chance
- **Round Completion**: Round ends when someone answers correctly

## Architecture

```
game-party/
├── api/                    # Node.js Express backend
│   └── src/
│       └── main.ts        # Game server with all endpoints
├── frontend/              # Angular standalone application
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.ts     # Main component with game logic
│   │   │   ├── app.html   # UI template
│   │   │   └── app.scss   # Styles
│   │   └── index.html
│   └── proxy.conf.json    # Dev proxy config for API
└── package.json           # Nx workspace configuration
```

## Prerequisites

- Node.js (v20 or later recommended)
- npm (comes with Node.js)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd game-party

# Install dependencies
npm install
```

## Running the Application

### Option 1: Run Both Servers (Recommended)

Start both the API and frontend servers in parallel:

```bash
npm run start
```

- **Backend API**: http://localhost:3333
- **Frontend**: http://localhost:4200

### Option 2: Run Servers Separately

In separate terminal windows:

```bash
# Terminal 1: Start the API server
npm run start:api

# Terminal 2: Start the frontend
npm run start:frontend
```

### Option 3: Using Nx Directly

```bash
# Start API on custom port
npx nx serve api --port=3333

# Start frontend on custom port
npx nx serve frontend --port=4201
```

## API Endpoints

### Player Endpoints

#### Join Game (Optional)
```bash
POST /api/join
Content-Type: application/json

{
  "name": "PlayerName"
}
```

#### Buzz In
```bash
POST /api/buzz
Content-Type: application/json

{
  "name": "PlayerName"
}

# Response
{
  "position": 1,        # Your position in buzz order
  "canAnswer": true     # true only if you buzzed first
}
```

#### Submit Answer
```bash
POST /api/answer
Content-Type: application/json

{
  "name": "PlayerName",
  "answer": "Your Answer"
}

# Response (correct)
{
  "correct": true,
  "points": 10,
  "player": {
    "name": "PlayerName",
    "score": 25
  }
}

# Response (incorrect)
{
  "correct": false
}
```

#### Get Scoreboard
```bash
GET /api/scoreboard

# Response
{
  "players": [
    { "name": "Alice", "score": 25 },
    { "name": "Bob", "score": 18 }
  ]
}
```

#### Get Current Round State
```bash
GET /api/state

# Response
{
  "round": {
    "id": "1730751234567",
    "item": "Famous Actor",
    "phase": 2,
    "maxPhases": 5,
    "hints": [
      "He starred in Forrest Gump",
      "He was in Cast Away",
      "Won two Oscars"
    ],
    "finished": false
  }
}
```

### Admin Endpoints

#### Start New Round
```bash
POST /api/start-round
Content-Type: application/json

{
  "item": "Famous Actor",
  "answer": "tom hanks",
  "hints": [
    "He starred in Forrest Gump",
    "He was in Cast Away",
    "Won two Oscars for Best Actor"
  ],
  "maxPhases": 3
}
```

#### Advance to Next Phase
```bash
POST /api/next-phase

# Response
{
  "round": { ... }  # Updated round with incremented phase
}
```

## Example Game Flow

1. **Admin starts a round**:
   - Item: "Hollywood Actor"
   - Answer: "tom hanks"
   - Hints: ["Starred in Forrest Gump", "Cast Away", "Won 2 Oscars"]
   - Max phases: 3

2. **Phase 1 begins** (10 points available):
   - Players see hint: "Starred in Forrest Gump"
   - Alice buzzes first
   - Alice submits answer: "Tom Cruise" (incorrect)
   - Bob buzzes second, now he can answer
   - Bob submits: "Tom Hanks" (correct) → +10 points

3. **Admin starts next round** with a new item

4. **Scoreboard updates** in real-time for all players

## Development

### Build Projects
```bash
# Build API
npx nx build api

# Build frontend
npx nx build frontend

# Build both
npx nx run-many --target=build --projects=api,frontend
```

### Lint Code
```bash
# Lint API
npx nx lint api

# Lint frontend
npx nx lint frontend

# Lint all
npx nx run-many --target=lint --all
```

### Run Tests
```bash
# Test frontend
npx nx test frontend

# Test all
npx nx run-many --target=test --all
```

### Production Build
```bash
npx nx build api --configuration=production
npx nx build frontend --configuration=production
```

Built files will be in:
- API: `dist/api/`
- Frontend: `dist/frontend/`

## Technology Stack

- **Frontend**: Angular 20 (standalone components), TypeScript, SCSS
- **Backend**: Node.js, Express, TypeScript
- **Build Tool**: Nx 22
- **Development**: Webpack, Angular CLI

## Game Design Notes

### Scoring System
Points decrease with each phase to reward players who need fewer hints:
- Phase 1: 10 points (fewest hints needed)
- Phase 2: 9 points
- Phase 3: 8 points
- ...
- Phase 10: 1 point (most hints needed)

### State Management
- **Backend**: In-memory storage (resets on server restart)
  - Current round state
  - Player scores
  - Buzz order per phase
- **Frontend**: Polling-based updates every second
- **Session**: Name stored in localStorage (survives page refresh)

### Network Considerations
- Buzz order determined by server arrival time (not client timestamp)
- Network latency affects who buzzes "first"
- This is intentional - adds excitement and levels the playing field

## Troubleshooting

### Port Already in Use
If port 4200 or 3333 is busy:
```bash
# Use custom ports
npx nx serve frontend --port=4201
npx nx serve api --port=3334

# Update proxy config if changing API port
# Edit frontend/proxy.conf.json
```

### CORS Issues
The API has CORS enabled for all origins in development. For production, update the CORS configuration in `api/src/main.ts`.

### Canvas Not Working
The drawing canvas requires:
- Modern browser with Canvas API support
- Touch events or pointer events support
- No issues in Chrome, Firefox, Safari, Edge

### State Lost on Refresh
- Player names persist (localStorage)
- Game state is server-side only (in-memory)
- Scores persist until server restarts

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and tests
5. Submit a pull request

## Support

For issues or questions, please open an issue on GitHub.
