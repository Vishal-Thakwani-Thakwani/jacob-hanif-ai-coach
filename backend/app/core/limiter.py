from slowapi import Limiter
from fastapi import Request


def _get_real_ip(request: Request) -> str:
    """Read real client IP behind Railway's Envoy proxy."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


limiter = Limiter(key_func=_get_real_ip)
