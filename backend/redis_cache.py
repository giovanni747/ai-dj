"""
Redis caching module for AI DJ application
Provides caching for user profiles and API responses to reduce token usage and improve speed
"""

import os
import json
import redis
from functools import wraps
from datetime import timedelta
from typing import Optional, Any, Callable
import hashlib

# Initialize Redis client (with fallback to no caching if Redis unavailable)
try:
    redis_client = redis.Redis(
        host=os.getenv('REDIS_HOST', 'localhost'),
        port=int(os.getenv('REDIS_PORT', 6379)),
        db=int(os.getenv('REDIS_DB', 0)),
        password=os.getenv('REDIS_PASSWORD', None),
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2
    )
    # Test connection
    redis_client.ping()
    REDIS_AVAILABLE = True
    print("✅ Redis cache connected successfully")
except Exception as e:
    redis_client = None
    REDIS_AVAILABLE = False
    print(f"⚠️  Redis cache not available: {e}")
    print("   Continuing without caching (will use API for each request)")


class CacheManager:
    """Manages caching operations with automatic fallback if Redis unavailable"""
    
    # Cache TTL settings (in seconds)
    USER_PROFILE_TTL = 300  # 5 minutes
    LYRICS_EXPLANATION_TTL = 3600  # 1 hour
    SPOTIFY_DATA_TTL = 600  # 10 minutes
    
    @staticmethod
    def get(key: str) -> Optional[Any]:
        """Get value from cache"""
        if not REDIS_AVAILABLE:
            return None
        
        try:
            value = redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Cache get error: {e}")
            return None
    
    @staticmethod
    def set(key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL"""
        if not REDIS_AVAILABLE:
            return False
        
        try:
            serialized = json.dumps(value, default=str)
            redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    @staticmethod
    def delete(key: str) -> bool:
        """Delete key from cache"""
        if not REDIS_AVAILABLE:
            return False
        
        try:
            redis_client.delete(key)
            return True
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False
    
    @staticmethod
    def invalidate_pattern(pattern: str) -> int:
        """Delete all keys matching pattern"""
        if not REDIS_AVAILABLE:
            return 0
        
        try:
            keys = redis_client.keys(pattern)
            if keys:
                return redis_client.delete(*keys)
            return 0
        except Exception as e:
            print(f"Cache invalidate error: {e}")
            return 0
    
    @staticmethod
    def get_cache_key(prefix: str, *args, **kwargs) -> str:
        """Generate a cache key from prefix and arguments"""
        # Create a unique hash from arguments
        key_data = f"{prefix}:{str(args)}:{str(sorted(kwargs.items()))}"
        key_hash = hashlib.md5(key_data.encode()).hexdigest()
        return f"{prefix}:{key_hash}"


def cached(ttl: int = 300, prefix: str = "cache"):
    """
    Decorator for caching function results
    
    Usage:
        @cached(ttl=300, prefix="user_profile")
        def get_user_profile(user_id):
            # Expensive operation
            return profile_data
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = CacheManager.get_cache_key(prefix, *args, **kwargs)
            
            # Try to get from cache
            cached_value = CacheManager.get(cache_key)
            if cached_value is not None:
                print(f"✅ Cache HIT: {func.__name__}")
                return cached_value
            
            # Cache miss - call the function
            print(f"❌ Cache MISS: {func.__name__} (fetching...)")
            result = func(*args, **kwargs)
            
            # Store in cache
            CacheManager.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


# Specific cache functions for common operations

def cache_user_profile(clerk_id: str, profile_data: dict) -> bool:
    """Cache user's Spotify profile"""
    key = f"user_profile:{clerk_id}"
    return CacheManager.set(key, profile_data, CacheManager.USER_PROFILE_TTL)


def get_cached_user_profile(clerk_id: str) -> Optional[dict]:
    """Get cached user profile"""
    key = f"user_profile:{clerk_id}"
    return CacheManager.get(key)


def invalidate_user_profile(clerk_id: str) -> bool:
    """Invalidate user profile cache (e.g., when user reconnects Spotify)"""
    key = f"user_profile:{clerk_id}"
    return CacheManager.delete(key)


def cache_lyrics_explanation(track_id: str, user_prompt: str, explanation: str, highlighted_terms: list) -> bool:
    """Cache lyrics explanation and highlighted terms"""
    # Create a hash from user prompt to avoid collisions
    prompt_hash = hashlib.md5(user_prompt.encode()).hexdigest()[:8]
    key = f"lyrics_exp:{track_id}:{prompt_hash}"
    data = {
        "explanation": explanation,
        "highlighted_terms": highlighted_terms
    }
    return CacheManager.set(key, data, CacheManager.LYRICS_EXPLANATION_TTL)


def get_cached_lyrics_explanation(track_id: str, user_prompt: str) -> Optional[tuple]:
    """Get cached lyrics explanation"""
    prompt_hash = hashlib.md5(user_prompt.encode()).hexdigest()[:8]
    key = f"lyrics_exp:{track_id}:{prompt_hash}"
    data = CacheManager.get(key)
    if data:
        return data.get("explanation"), data.get("highlighted_terms", [])
    return None


def get_cache_stats() -> dict:
    """Get cache statistics"""
    if not REDIS_AVAILABLE:
        return {"available": False}
    
    try:
        info = redis_client.info()
        return {
            "available": True,
            "connected_clients": info.get("connected_clients", 0),
            "used_memory_human": info.get("used_memory_human", "0"),
            "total_keys": redis_client.dbsize()
        }
    except Exception as e:
        return {"available": False, "error": str(e)}


if __name__ == "__main__":
    # Test the cache
    print("Testing Redis cache...")
    print(f"Redis available: {REDIS_AVAILABLE}")
    
    if REDIS_AVAILABLE:
        # Test basic operations
        CacheManager.set("test_key", {"hello": "world"}, 60)
        result = CacheManager.get("test_key")
        print(f"Test result: {result}")
        
        # Test cache stats
        stats = get_cache_stats()
        print(f"Cache stats: {stats}")

