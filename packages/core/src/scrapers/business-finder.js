import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import geoip from "geoip-lite";
import { publicIp } from "public-ip";
import "../env.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables

// Constants
const DEFAULT_RADIUS = 5000; // meters
const DEFAULT_SEARCH_TERMS = [
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "pub",
  "food",
  "diner",
  "pizzeria",
  "coffee shop",
  "ice cream",
  "fast food",
  "bistro",
  "deli",
  "sandwich shop",
  "sushi",
];

// Google Maps API key
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Helper function to get user's location based on IP address
async function getUserLocation() {
  try {
    const ip = await publicIp.v4();
    const geo = geoip.lookup(ip);

    if (geo) {
      return {
        lat: geo.ll[0],
        lng: geo.ll[1],
        city: geo.city,
        region: geo.region,
        country: geo.country,
      };
    }

    return null;
  } catch (error) {
    throw new Error(`Error detecting location: ${error.message}`);
  }
}

// Function to geocode an address, zip code, town, or county
async function geocodeLocation(location) {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: location,
          key: GOOGLE_MAPS_API_KEY,
        },
      },
    );

    if (response.data.status !== "OK") {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    const result = response.data.results[0];
    const { lat, lng } = result.geometry.location;

    return { lat, lng, address: result.formatted_address };
  } catch (error) {
    throw new Error(`Error geocoding location: ${error.message}`);
  }
}

// Function to search for businesses
async function searchBusinesses(searchTerm, location, radius) {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${location.lat},${location.lng}`,
          radius: radius,
          type: "establishment",
          keyword: searchTerm,
          key: GOOGLE_MAPS_API_KEY,
          ...(options.limit ? { limit: options.limit } : {}),
        },
      },
    );

    if (
      response.data.status !== "OK" &&
      response.data.status !== "ZERO_RESULTS"
    ) {
      throw new Error(`Search failed: ${response.data.status}`);
    }

    const results = response.data.results.map((place) => ({
      place_id: place.place_id,
      name: place.name,
      address: place.vicinity,
      location: place.geometry.location,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      types: place.types,
      distance: calculateDistance(
        location.lat,
        location.lng,
        place.geometry.location.lat,
        place.geometry.location.lng,
      ),
    }));

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);
    return results;
  } catch (error) {
    throw new Error(`Error searching for businesses: ${error.message}`);
  }
}

// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Function to get business details
async function getBusinessDetails(placeId) {
  try {
    const response = await axios.get(
      "https://maps.googleapis.com/maps/api/place/details/json",
      {
        params: {
          place_id: placeId,
          fields:
            "name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,types,price_level,user_ratings_total,url",
          key: GOOGLE_MAPS_API_KEY,
        },
      },
    );

    if (response.data.status !== "OK") {
      throw new Error(
        `Error getting details for place ID ${placeId}: ${response.data.status}`,
      );
    }

    return response.data.result;
  } catch (error) {
    throw new Error(
      `Error getting details for place ID ${placeId}: ${error.message}`,
    );
  }
}

// Function to get details for a batch of businesses
async function getBatchDetails(businesses, batchSize = 5, limit = 999) {
  const results = [];

  for (let i = 0; i < businesses.length || i < limit; i += batchSize) {
    const batch = businesses.slice(i, i + batchSize);
    const batchPromises = batch.map((business) =>
      getBusinessDetails(business.place_id),
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(Boolean));

    // Add a delay to avoid rate limiting
    if (i + batchSize < businesses.length || i + batchSize < limit) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// Main search function
export async function businessFinder(url, options = {}) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error(
      "Google Maps API key is missing. Please set GOOGLE_MAPS_API_KEY in .env file",
    );
  }
  const allResults = options.results || [];
  let searchTerms = options.terms
    ? options.terms.split(",").map((t) => t.trim())
    : DEFAULT_SEARCH_TERMS;
  let location;
  let locationString;

  if (!options.results) {
    // Use provided location or detect user's location
    if (options.location) {
      locationString = options.location;
      location = await geocodeLocation(options.location);
    } else if (options.latitude && options.longitude) {
      location = {
        lat: parseFloat(options.latitude),
        lng: parseFloat(options.longitude),
        address: `${options.latitude}, ${options.longitude}`,
      };
      locationString = `${options.latitude}, ${options.longitude}`;
    } else {
      const userLocation = await getUserLocation();
      if (userLocation) {
        location = {
          lat: userLocation.lat,
          lng: userLocation.lng,
          address: `${userLocation.city}, ${userLocation.region}, ${userLocation.country}`,
        };
        locationString = location.address;
      } else {
        throw new Error(
          "Could not detect your location. Please provide a location.",
        );
      }
    }

    if (!location) {
      throw new Error("Invalid location. Please try again.");
    }

    const radius = options.radius || DEFAULT_RADIUS;

    // Search for each term
    for (const term of searchTerms) {
      const results = await searchBusinesses(term, location, radius);

      // Filter out duplicates by place_id
      const uniqueResults = results.filter(
        (result) =>
          !allResults.some((existing) => existing.place_id === result.place_id),
      );

      allResults.push(...uniqueResults);
    }

    // Sort all results by distance
    allResults.sort((a, b) => a.distance - b.distance);
  }

  // Get detailed information if requested
  if (options.getDetails) {
    const detailedResults = await getBatchDetails(
      allResults,
      options.batchSize,
      options.limit,
    );
    return {
      location: locationString,
      totalResults: allResults.length,
      results: detailedResults,
    };
  }

  return {
    location: locationString,
    totalResults: allResults.length,
    results: allResults,
  };
}
