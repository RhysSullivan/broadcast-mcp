default:
    bunx concurrently "cd client && bun run dev" "cd server && bun run dev"

install:
    bunx concurrently "cd client && bun install" "cd server && bun install" 
