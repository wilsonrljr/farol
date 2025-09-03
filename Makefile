.PHONY: dev up down prod logs rebuild prune prod-down

# Start dev (live reload) environment
dev:
	docker compose up --build

# Detached dev
up:
	docker compose up -d

# Stop dev
down:
	docker compose down

# Production stack
prod:
	docker compose -f docker-compose.prod.yml up --build -d

# Stop production stack
prod-down:
	docker compose -f docker-compose.prod.yml down

# Tail logs
logs:
	docker compose logs -f

# Rebuild without cache
rebuild:
	docker compose build --no-cache

# Prune dangling images/volumes (CAREFUL)
prune:
	docker system prune -f
