# Convenience targets for the FastAPI port.
# All targets assume `uv` is on PATH (install: irm https://astral.sh/uv/install.ps1 | iex).

.PHONY: install dev test parity schema-check generate clean

install:
	uv sync

dev:
	uv run uvicorn app.main:app --host 127.0.0.1 --port 5000 --reload

test:
	uv run pytest tests/unit -v

parity:
	@echo "Requires Nest on :4000 and FastAPI on :5000"
	uv run pytest tests/parity/test_parity_runner.py -v

schema-check:
	uv run python scripts/check_schema_parity.py

generate:
	uv run python scripts/generate_sa_models.py

clean:
	rm -rf .venv .pytest_cache .ruff_cache .mypy_cache __pycache__
