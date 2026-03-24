from __future__ import annotations

import os

import uvicorn


def main() -> None:
    uvicorn.run(
        "backend.app.main:app",
        host=os.getenv("BACKEND_HOST", "0.0.0.0"),
        port=int(os.getenv("BACKEND_PORT", "8000")),
        reload=True,
    )


if __name__ == "__main__":
    main()