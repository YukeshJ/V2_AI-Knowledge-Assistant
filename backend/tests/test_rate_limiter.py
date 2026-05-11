import time
from rate_limiter import InMemoryRateLimiter


def test_rate_limiter_blocks_after_threshold():
    limiter = InMemoryRateLimiter(window_seconds=60, max_requests=2)
    assert limiter.allow("k1")
    assert limiter.allow("k1")
    assert not limiter.allow("k1")


def test_rate_limiter_resets_after_window():
    limiter = InMemoryRateLimiter(window_seconds=1, max_requests=1)
    assert limiter.allow("k2")
    assert not limiter.allow("k2")
    time.sleep(1.1)
    assert limiter.allow("k2")
