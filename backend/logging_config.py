import logging
import time
import uuid
from fastapi import Request


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )


def get_logger(name: str):
    return logging.getLogger(name)


async def request_logging_middleware(request: Request, call_next):
    logger = logging.getLogger("api")
    request_id = str(uuid.uuid4())[:8]
    start = time.perf_counter()
    try:
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "[%s] %s %s -> %s (%.2fms)",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception("[%s] %s %s failed (%.2fms)", request_id, request.method, request.url.path, elapsed_ms)
        raise
