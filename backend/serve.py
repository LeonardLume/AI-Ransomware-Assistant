from __future__ import annotations

import argparse
import asyncio
import os
import sys

import uvicorn


def configure_windows_event_loop_policy() -> None:
    if sys.platform != "win32":
        return

    selector_policy = getattr(asyncio, "WindowsSelectorEventLoopPolicy", None)
    if selector_policy is not None:
        asyncio.set_event_loop_policy(selector_policy())


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run the ransomware-readiness backend.")
    parser.add_argument("--host", default=os.getenv("BACKEND_HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("BACKEND_PORT", "8000")))
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args(argv)

    configure_windows_event_loop_policy()
    uvicorn.run("backend.main:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
