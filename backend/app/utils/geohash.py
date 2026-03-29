"""
ShareMyMeal — Geohash Utilities
==================================
Provides geohash encoding, decoding, and neighbor calculation for
efficient geospatial queries in Firestore.

Geohashing converts lat/lng into a string. Nearby points share common
prefixes, enabling range queries: WHERE geohash >= "tdr1" AND geohash <= "tdr~"
"""

import math
from typing import List, Tuple

# Base32 character set used in standard geohash encoding
BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"


def encode(latitude: float, longitude: float, precision: int = 7) -> str:
    """
    Encode latitude/longitude into a geohash string.

    Args:
        latitude: Latitude in degrees (-90 to 90)
        longitude: Longitude in degrees (-180 to 180)
        precision: Length of the resulting geohash (5 ≈ ±2.4km, 7 ≈ ±76m)

    Returns:
        Geohash string of specified precision
    """
    lat_range = (-90.0, 90.0)
    lng_range = (-180.0, 180.0)
    geohash = []
    bit = 0
    ch = 0
    is_longitude = True  # Start with longitude

    while len(geohash) < precision:
        if is_longitude:
            mid = (lng_range[0] + lng_range[1]) / 2
            if longitude >= mid:
                ch |= (1 << (4 - bit))
                lng_range = (mid, lng_range[1])
            else:
                lng_range = (lng_range[0], mid)
        else:
            mid = (lat_range[0] + lat_range[1]) / 2
            if latitude >= mid:
                ch |= (1 << (4 - bit))
                lat_range = (mid, lat_range[1])
            else:
                lat_range = (lat_range[0], mid)

        is_longitude = not is_longitude
        bit += 1

        if bit == 5:
            geohash.append(BASE32[ch])
            bit = 0
            ch = 0

    return "".join(geohash)


def decode(geohash: str) -> Tuple[float, float]:
    """
    Decode a geohash string back to approximate lat/lng coordinates.

    Returns:
        Tuple of (latitude, longitude) at the center of the geohash cell
    """
    lat_range = (-90.0, 90.0)
    lng_range = (-180.0, 180.0)
    is_longitude = True

    for char in geohash:
        idx = BASE32.index(char)
        for bit in range(4, -1, -1):
            if is_longitude:
                mid = (lng_range[0] + lng_range[1]) / 2
                if idx & (1 << bit):
                    lng_range = (mid, lng_range[1])
                else:
                    lng_range = (lng_range[0], mid)
            else:
                mid = (lat_range[0] + lat_range[1]) / 2
                if idx & (1 << bit):
                    lat_range = (mid, lat_range[1])
                else:
                    lat_range = (lat_range[0], mid)
            is_longitude = not is_longitude

    latitude = (lat_range[0] + lat_range[1]) / 2
    longitude = (lng_range[0] + lng_range[1]) / 2
    return (latitude, longitude)


def get_neighbors(geohash: str) -> List[str]:
    """
    Get the 8 neighboring geohash cells surrounding the given geohash.
    Used to query all nearby listings without missing edge cases.

    Returns:
        List of 9 geohash strings (center + 8 neighbors)
    """
    lat, lng = decode(geohash)
    precision = len(geohash)

    # Approximate cell size in degrees for given precision
    # These are rough approximations
    lat_err = 180.0 / (2 ** (precision * 5 // 2))
    lng_err = 360.0 / (2 ** ((precision * 5 + 1) // 2))

    neighbors = []
    for dlat in [-lat_err, 0, lat_err]:
        for dlng in [-lng_err, 0, lng_err]:
            neighbor_lat = lat + dlat
            neighbor_lng = lng + dlng
            # Clamp to valid ranges
            neighbor_lat = max(-90.0, min(90.0, neighbor_lat))
            neighbor_lng = max(-180.0, min(180.0, neighbor_lng))
            neighbors.append(encode(neighbor_lat, neighbor_lng, precision))

    return list(set(neighbors))  # Remove duplicates at edges


def geohash_range_for_radius(latitude: float, longitude: float, radius_km: float) -> Tuple[str, str]:
    """
    Calculate the geohash precision and range for a given radius.
    Used for Firestore range queries.

    Returns:
        Tuple of (lower_bound_geohash, upper_bound_geohash) for range query
    """
    # Choose precision based on radius
    # Precision 4 ≈ ±20km, 5 ≈ ±2.4km, 6 ≈ ±610m, 7 ≈ ±76m
    if radius_km >= 20:
        precision = 3
    elif radius_km >= 5:
        precision = 4
    elif radius_km >= 1:
        precision = 5
    else:
        precision = 6

    center_hash = encode(latitude, longitude, precision)

    # Lower bound: geohash prefix
    lower = center_hash
    # Upper bound: geohash prefix + '~' (highest ASCII char after Base32)
    upper = center_hash[:-1] + chr(ord(center_hash[-1]) + 1)

    return (lower, upper)


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth
    using the Haversine formula.

    Returns:
        Distance in kilometers
    """
    R = 6371.0  # Earth's radius in km

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)

    a = (math.sin(dlat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c
