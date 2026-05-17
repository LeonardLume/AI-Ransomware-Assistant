from __future__ import annotations

import threading
import time
from collections import deque
from collections.abc import Iterable

from fastapi import Request


class RequestRateLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: dict[str, deque[float]] = {}

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()

    def check(self, key: str, limit: int, window_seconds: int = 60) -> int | None:
        if limit <= 0:
            return None

        now = time.time()
        with self._lock:
            bucket = self._buckets.setdefault(key, deque())
            cutoff = now - window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry_after = max(1, int(bucket[0] + window_seconds - now))
                return retry_after
            bucket.append(now)
        return None


RATE_LIMITER = RequestRateLimiter()


def resolve_client_ip(request: Request, trust_proxy_headers: bool = False) -> str:
    if trust_proxy_headers:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        if forwarded_for.strip():
            return forwarded_for.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip", "").strip()
        if real_ip:
            return real_ip
    client = request.client
    return client.host if client else "unknown"


def extract_api_token(request: Request) -> str:
    auth_header = request.headers.get("authorization", "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return request.headers.get("x-api-key", "").strip()


def is_request_authorized(request: Request, expected_token: str) -> bool:
    if not expected_token:
        return True
    return extract_api_token(request) == expected_token


def is_public_path(path: str, public_paths: Iterable[str]) -> bool:
    return any(path == item or path.startswith(f"{item}/") for item in public_paths)
