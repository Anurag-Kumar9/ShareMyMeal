"""
ShareMyMeal — Location Service
=================================
Provides geospatial utilities:
- Geohash-based queries for finding nearby listings in Firestore
- Distance calculation between buyer and seller
- Google Maps Distance Matrix API calls for accurate travel distance
"""

import httpx
from typing import List, Dict, Any, Optional, Tuple
from app.config import settings
from app.utils.geohash import encode, get_neighbors, haversine_distance


class LocationService:
    """Service for location-based operations."""

    def compute_geohash(self, latitude: float, longitude: float, precision: int = 7) -> str:
        """
        Compute a geohash for the given coordinates.
        Default precision 7 gives ~76m accuracy, good for neighborhood-level.
        """
        return encode(latitude, longitude, precision)

    def get_nearby_geohashes(self, latitude: float, longitude: float, precision: int = 5) -> List[str]:
        """
        Get all geohash prefixes that cover the area around the given point.
        Used for Firestore queries — query each geohash prefix separately
        and merge results.

        Precision 5 ≈ ±2.4km coverage per cell, with neighbors ≈ ±7km total.
        """
        center_hash = encode(latitude, longitude, precision)
        return get_neighbors(center_hash)

    def calculate_distance(
        self,
        lat1: float, lng1: float,
        lat2: float, lng2: float,
    ) -> float:
        """
        Calculate straight-line distance between two points in km.
        Uses the Haversine formula (great-circle distance).
        """
        return round(haversine_distance(lat1, lng1, lat2, lng2), 2)

    async def get_travel_distance(
        self,
        origin_lat: float, origin_lng: float,
        dest_lat: float, dest_lng: float,
    ) -> Optional[Dict[str, Any]]:
        """
        Get the actual travel distance and duration using Google Maps
        Distance Matrix API. Falls back to haversine if API is unavailable.

        Returns:
            Dict with distance_text, distance_meters, duration_text, duration_seconds
        """
        api_key = settings.google_maps_api_key

        # Skip API call if using placeholder key
        if api_key == "your_google_maps_api_key_here":
            km = self.calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)
            return {
                "distance_text": f"{km} km",
                "distance_meters": int(km * 1000),
                "duration_text": f"{int(km * 3)} mins",  # Rough estimate: 3 min/km walking
                "duration_seconds": int(km * 180),
                "source": "haversine_estimate",
            }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://maps.googleapis.com/maps/api/distancematrix/json",
                    params={
                        "origins": f"{origin_lat},{origin_lng}",
                        "destinations": f"{dest_lat},{dest_lng}",
                        "mode": "walking",
                        "key": api_key,
                    },
                )

                data = response.json()
                if data["status"] == "OK":
                    element = data["rows"][0]["elements"][0]
                    if element["status"] == "OK":
                        return {
                            "distance_text": element["distance"]["text"],
                            "distance_meters": element["distance"]["value"],
                            "duration_text": element["duration"]["text"],
                            "duration_seconds": element["duration"]["value"],
                            "source": "google_maps",
                        }
        except Exception:
            pass

        # Fallback to haversine
        km = self.calculate_distance(origin_lat, origin_lng, dest_lat, dest_lng)
        return {
            "distance_text": f"{km} km",
            "distance_meters": int(km * 1000),
            "duration_text": f"{int(km * 3)} mins",
            "duration_seconds": int(km * 180),
            "source": "haversine_fallback",
        }


# Singleton instance
location_service = LocationService()
