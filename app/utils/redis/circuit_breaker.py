import time
import logging
from enum import Enum
from typing import Callable, Any, Dict, Optional
import functools

logger = logging.getLogger(__name__)


class CircuitBreakerState(Enum):
    """States for the circuit breaker"""
    CLOSED = "closed"  # Normal operation, requests go through
    OPEN = "open"  # Failure threshold reached, requests fail fast
    HALF_OPEN = "half_open"  # Testing if service is back up


class CircuitBreaker:
    """
    Implements the circuit breaker pattern to prevent repeated calls to a failing service.
    """

    def __init__(
            self,
            name: str,
            failure_threshold: int = 5,
            recovery_timeout: int = 30,
            half_open_max_calls: int = 1
    ):
        """
        Initialize a new circuit breaker.

        Args:
            name: Name of this circuit breaker (for logging)
            failure_threshold: Number of failures before opening the circuit
            recovery_timeout: Seconds to wait before attempting recovery
            half_open_max_calls: Max number of calls in half-open state
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time = 0
        self.half_open_calls = 0

    def __call__(self, func):
        """Decorator for circuit breaking a function"""

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            return self.call(func, *args, **kwargs)

        return wrapper

    def call(self, func: Callable, *args, **kwargs) -> Any:
        """
        Call the function with circuit breaker protection.

        Args:
            func: Function to call
            args: Arguments to pass to the function
            kwargs: Keyword arguments to pass to the function

        Returns:
            The result of the function call

        Raises:
            CircuitBreakerError: If the circuit is open
        """
        if self.state == CircuitBreakerState.OPEN:
            if time.time() > self.last_failure_time + self.recovery_timeout:
                logger.info(f"Circuit breaker '{self.name}' entering half-open state")
                self.state = CircuitBreakerState.HALF_OPEN
                self.half_open_calls = 0
            else:
                raise CircuitBreakerError(
                    f"Circuit breaker '{self.name}' is open - failing fast",
                    self.last_failure_time + self.recovery_timeout - time.time()
                )

        if self.state == CircuitBreakerState.HALF_OPEN and self.half_open_calls >= self.half_open_max_calls:
            raise CircuitBreakerError(
                f"Circuit breaker '{self.name}' is half-open and at max calls",
                self.last_failure_time + self.recovery_timeout - time.time()
            )

        if self.state == CircuitBreakerState.HALF_OPEN:
            self.half_open_calls += 1

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure(e)
            raise

    def _on_success(self):
        """Handle successful call"""
        if self.state == CircuitBreakerState.HALF_OPEN:
            logger.info(f"Circuit breaker '{self.name}' closing - service appears to be healthy")
            self.state = CircuitBreakerState.CLOSED
            self.failure_count = 0
        elif self.state == CircuitBreakerState.CLOSED:
            self.failure_count = 0

    def _on_failure(self, exception):
        """Handle failed call"""
        self.last_failure_time = time.time()

        if self.state == CircuitBreakerState.CLOSED:
            self.failure_count += 1
            if self.failure_count >= self.failure_threshold:
                logger.warning(
                    f"Circuit breaker '{self.name}' opening after {self.failure_count} failures. "
                    f"Last error: {str(exception)}"
                )
                self.state = CircuitBreakerState.OPEN

        elif self.state == CircuitBreakerState.HALF_OPEN:
            logger.warning(
                f"Circuit breaker '{self.name}' reopening - service still appears to be unhealthy. "
                f"Error: {str(exception)}"
            )
            self.state = CircuitBreakerState.OPEN

    @property
    def is_closed(self) -> bool:
        """Check if the circuit is closed (normal operation)"""
        return self.state == CircuitBreakerState.CLOSED

    @property
    def is_open(self) -> bool:
        """Check if the circuit is open (failing fast)"""
        return self.state == CircuitBreakerState.OPEN

    @property
    def is_half_open(self) -> bool:
        """Check if the circuit is half-open (testing recovery)"""
        return self.state == CircuitBreakerState.HALF_OPEN

    def get_status(self) -> Dict[str, Any]:
        """Get the status of this circuit breaker"""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": self.last_failure_time,
            "recovery_timeout": self.recovery_timeout,
            "time_remaining": max(0,
                                  self.last_failure_time + self.recovery_timeout - time.time()) if self.state == CircuitBreakerState.OPEN else 0,
            "half_open_calls": self.half_open_calls,
            "half_open_max_calls": self.half_open_max_calls
        }


class CircuitBreakerError(Exception):
    """Exception raised when a circuit is open"""

    def __init__(self, message: str, time_remaining: float = 0):
        self.message = message
        self.time_remaining = time_remaining
        super().__init__(self.message)


# Create a circuit breaker for Redis operations
redis_circuit = CircuitBreaker(
    name="redis",
    failure_threshold=5,  # Open after 5 failures
    recovery_timeout=30,  # Wait 30s before trying again
    half_open_max_calls=1  # Allow 1 call in half-open state
)

# Usage example for Redis get method:
# @redis_circuit
# def get_from_redis(key):
#     return redis_manager.get(key)