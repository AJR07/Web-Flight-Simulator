import "leaflet/dist/leaflet.css";
import { Mesh, MeshStandardMaterial, PlaneGeometry } from "three";

const KM_PER_LAT_DEGREE = 111;
const SIZE_X = 100;
const SIZE_Y = 100;
const BOUNDS = { north: 35.397, south: 35.33, east: 138.78, west: 138.69 };
const RESOLUTION = 0.005 * KM_PER_LAT_DEGREE; // km between points

export default class TerrainData {
  ground: Mesh = new Mesh();

  constructor() {}

  async setup() {
    // Get terrain data
    const terrainData = await this.getTerrainData(BOUNDS, RESOLUTION);
    console.log(terrainData);

    // Calculate grid dimensions
    const latRange = BOUNDS.north - BOUNDS.south;
    const lngRange = BOUNDS.east - BOUNDS.west;
    const segmentsX = Math.ceil(lngRange / (RESOLUTION / KM_PER_LAT_DEGREE));
    const segmentsY = Math.ceil(latRange / (RESOLUTION / KM_PER_LAT_DEGREE));

    // Create geometry with segments matching our data points
    const groundGeometry = new PlaneGeometry(
      SIZE_X,
      SIZE_Y,
      segmentsX,
      segmentsY
    );

    // Apply elevation data to geometry vertices
    // this.applyElevationToGeometry(groundGeometry, terrainData, bounds);

    // Recalculate normals for proper lighting
    // groundGeometry.computeVertexNormals();

    // Create material
    const groundMaterial = new MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8,
    });

    // Create ground mesh
    const ground = new Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.receiveShadow = true;

    this.ground = ground;
    return ground;
  }

  private applyElevationToGeometry(
    geometry: PlaneGeometry,
    terrainData: { lat: number; lng: number; elevation: number }[],
    bounds: { north: number; south: number; east: number; west: number }
  ): void {
    const position = geometry.attributes.position;
    const latRange = bounds.north - bounds.south;
    const lngRange = bounds.east - bounds.west;

    // Scale factor for elevation (adjust this to exaggerate/flatten terrain)
    const elevationScale = 0.01; // 1 meter elevation = 0.01 units in scene

    // For each vertex in the geometry
    for (let i = 0; i < position.count; i++) {
      // Get vertex position in geometry space (-SIZE_X/2 to SIZE_X/2)
      const x = position.getX(i);
      const y = position.getY(i);

      // Convert to normalized coordinates (0 to 1)
      const normalizedX = x / SIZE_X + 0.5;
      const normalizedY = y / SIZE_Y + 0.5;

      // Convert to lat/lng
      const lng = bounds.west + normalizedX * lngRange;
      const lat = bounds.south + normalizedY * latRange;

      // Find closest terrain data point
      const elevation = this.getClosestElevation(lat, lng, terrainData);

      // Set Z coordinate (height) based on elevation
      position.setZ(i, elevation * elevationScale);
    }

    position.needsUpdate = true;
  }

  private getClosestElevation(
    lat: number,
    lng: number,
    terrainData: { lat: number; lng: number; elevation: number }[]
  ): number {
    if (terrainData.length === 0) return 0;

    let closestPoint = terrainData[0];
    let minDistance = this.getDistance(
      lat,
      lng,
      closestPoint.lat,
      closestPoint.lng
    );

    for (const point of terrainData) {
      const distance = this.getDistance(lat, lng, point.lat, point.lng);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    return closestPoint.elevation;
  }

  private getDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  async getTerrainData(
    bounds: { north: number; south: number; east: number; west: number },
    resolution: number = 10
  ): Promise<{ lat: number; lng: number; elevation: number }[]> {
    const locations: { latitude: number; longitude: number }[] = [];

    for (
      let lat = bounds.south;
      lat <= bounds.north;
      lat += resolution / KM_PER_LAT_DEGREE
    ) {
      for (
        let lng = bounds.west;
        lng <= bounds.east;
        lng +=
          resolution / (KM_PER_LAT_DEGREE * Math.cos((lat * Math.PI) / 180))
      ) {
        locations.push({
          latitude: lat,
          longitude: lng,
        });
      }
    }

    try {
      const response = await fetch(
        "https://api.open-elevation.com/api/v1/lookup",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locations: locations }),
        }
      );
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error("Error fetching terrain data:", error);
      return [];
    }
  }
}
