"""
Rate limiter and request queue for Groq API
Ensures we stay within Groq's limits: 30 RPM, 6000 TPM
"""

import time
import threading
from collections import deque
from datetime import datetime, timedelta
from typing import Callable, Any
import functools

class RateLimiter:
    """
    Rate limiter for Groq API requests
    Limits: 30 requests per minute, 6000 tokens per minute
    """
    
    def __init__(self, max_requests_per_minute: int = 30, max_tokens_per_minute: int = 6000):
        self.max_rpm = max_requests_per_minute
        self.max_tpm = max_tokens_per_minute
        
        # Track requests in the last minute
        self.request_times = deque()
        self.token_usage = deque()  # (timestamp, token_count) tuples
        
        self.lock = threading.Lock()
        
        print(f"✅ Rate limiter initialized: {max_requests_per_minute} RPM, {max_tokens_per_minute} TPM")
    
    def _clean_old_entries(self):
        """Remove entries older than 1 minute"""
        cutoff_time = datetime.now() - timedelta(minutes=1)
        
        # Clean request times
        while self.request_times and self.request_times[0] < cutoff_time:
            self.request_times.popleft()
        
        # Clean token usage
        while self.token_usage and self.token_usage[0][0] < cutoff_time:
            self.token_usage.popleft()
    
    def get_current_usage(self) -> dict:
        """Get current rate limit usage"""
        with self.lock:
            self._clean_old_entries()
            
            current_requests = len(self.request_times)
            current_tokens = sum(tokens for _, tokens in self.token_usage)
            
            return {
                "requests": current_requests,
                "max_requests": self.max_rpm,
                "tokens": current_tokens,
                "max_tokens": self.max_tpm,
                "requests_available": self.max_rpm - current_requests,
                "tokens_available": self.max_tpm - current_tokens
            }
    
    def wait_if_needed(self, estimated_tokens: int = 500) -> float:
        """
        Wait if we're approaching rate limits
        Returns: seconds waited
        """
        with self.lock:
            self._clean_old_entries()
            
            current_requests = len(self.request_times)
            current_tokens = sum(tokens for _, tokens in self.token_usage)
            
            wait_time = 0.0
            
            # Check if we need to wait for request limit
            if current_requests >= self.max_rpm - 1:
                # Wait until oldest request is > 1 minute old
                if self.request_times:
                    oldest_request = self.request_times[0]
                    time_to_wait = 61 - (datetime.now() - oldest_request).total_seconds()
                    if time_to_wait > 0:
                        print(f"⏳ Rate limit: waiting {time_to_wait:.1f}s (requests: {current_requests}/{self.max_rpm})")
                        time.sleep(time_to_wait)
                        wait_time += time_to_wait
                        self._clean_old_entries()
            
            # Check if we need to wait for token limit
            if current_tokens + estimated_tokens > self.max_tpm:
                # Wait until we have enough token budget
                if self.token_usage:
                    oldest_token_entry = self.token_usage[0][0]
                    time_to_wait = 61 - (datetime.now() - oldest_token_entry).total_seconds()
                    if time_to_wait > 0:
                        print(f"⏳ Token limit: waiting {time_to_wait:.1f}s (tokens: {current_tokens + estimated_tokens}/{self.max_tpm})")
                        time.sleep(time_to_wait)
                        wait_time += time_to_wait
                        self._clean_old_entries()
            
            # Record this request
            now = datetime.now()
            self.request_times.append(now)
            self.token_usage.append((now, estimated_tokens))
            
            return wait_time
    
    def update_token_usage(self, actual_tokens: int):
        """Update the last token usage with actual value"""
        with self.lock:
            if self.token_usage:
                # Update the last entry with actual token count
                timestamp, _ = self.token_usage[-1]
                self.token_usage[-1] = (timestamp, actual_tokens)


# Global rate limiter instance
groq_rate_limiter = RateLimiter(max_requests_per_minute=30, max_tokens_per_minute=6000)


def rate_limited(estimated_tokens: int = 500):
    """
    Decorator to rate limit API calls
    
    Usage:
        @rate_limited(estimated_tokens=1000)
        def call_groq_api():
            # API call here
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Wait if needed
            wait_time = groq_rate_limiter.wait_if_needed(estimated_tokens)
            
            if wait_time > 0:
                print(f"   Waited {wait_time:.1f}s for rate limit")
            
            # Call the function
            result = func(*args, **kwargs)
            
            return result
        return wrapper
    return decorator


class RequestQueue:
    """
    Queue for managing concurrent API requests
    Processes requests sequentially to avoid rate limit issues
    """
    
    def __init__(self):
        self.queue = deque()
        self.lock = threading.Lock()
        self.processing = False
        print("✅ Request queue initialized")
    
    def add_request(self, func: Callable, *args, **kwargs) -> Any:
        """Add a request to the queue and wait for result"""
        result_event = threading.Event()
        result_container = {"value": None, "error": None}
        
        def wrapped_func():
            try:
                result_container["value"] = func(*args, **kwargs)
            except Exception as e:
                result_container["error"] = e
            finally:
                result_event.set()
        
        with self.lock:
            self.queue.append(wrapped_func)
        
        # Start processing if not already running
        self._process_queue()
        
        # Wait for result
        result_event.wait()
        
        if result_container["error"]:
            raise result_container["error"]
        
        return result_container["value"]
    
    def _process_queue(self):
        """Process queued requests"""
        with self.lock:
            if self.processing or not self.queue:
                return
            self.processing = True
        
        def worker():
            while True:
                with self.lock:
                    if not self.queue:
                        self.processing = False
                        break
                    func = self.queue.popleft()
                
                # Execute the function
                func()
        
        # Start worker thread
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()


# Global request queue
request_queue = RequestQueue()


def get_rate_limit_status() -> dict:
    """Get current rate limit status"""
    return groq_rate_limiter.get_current_usage()


if __name__ == "__main__":
    # Test rate limiter
    print("Testing rate limiter...")
    
    @rate_limited(estimated_tokens=100)
    def test_api_call(n):
        print(f"  API call {n}")
        return f"Result {n}"
    
    # Make several test calls
    for i in range(5):
        result = test_api_call(i)
        print(f"  -> {result}")
        time.sleep(0.1)
    
    # Check status
    status = get_rate_limit_status()
    print(f"\nRate limit status: {status}")

