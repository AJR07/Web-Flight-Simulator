import "leaflet/dist/leaflet.css";
import { Mesh, MeshStandardMaterial, PlaneGeometry } from "three";

const ELEVATION_SCALE = 1000;
const BOUNDS = { north: 35.397, south: 35.33, east: 138.78, west: 138.69 };
const RESOLUTION = 0.01; // lat degrees between points
const SIZE_X = Math.ceil((BOUNDS.east - BOUNDS.west) / RESOLUTION);
const SIZE_Y = Math.ceil((BOUNDS.north - BOUNDS.south) / RESOLUTION);
console.log(`Terrain size: ${SIZE_X} x ${SIZE_Y}`);

export default class TerrainData {
  ground: Mesh = new Mesh();

  constructor() {}

  async setup() {
    // Get terrain data
    const terrainData = await this.getTerrainData(BOUNDS, RESOLUTION);
    console.log("Terrain data points:", terrainData);

    // Create geometry with segments matching our data points
    const groundGeometry = new PlaneGeometry(SIZE_X, SIZE_Y, SIZE_X, SIZE_Y);

    // Apply elevation data to geometry vertices
    this.applyElevationToGeometry(groundGeometry, terrainData, BOUNDS);
    groundGeometry.computeVertexNormals(); // Recalculate normals for proper lighting

    // Create material
    const groundMaterial = new MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.8,
    });

    // Create ground mesh
    const ground = new Mesh(groundGeometry, groundMaterial);
    ground.receiveShadow = true;

    this.ground = ground;
    return ground;
  }

  private applyElevationToGeometry(
    geometry: PlaneGeometry,
    terrainData: { lat: number; lng: number; elevation: number }[],
    bounds: { north: number; south: number; east: number; west: number }
  ): void {
    const vertices = geometry.attributes.position;
    console.log(vertices.count, terrainData.length)
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i) + SIZE_X / 2;
      const y = vertices.getY(i) + SIZE_Y / 2;
      if (x == SIZE_X || y == SIZE_Y) {
        continue; // Skip last row/column to avoid out-of-bounds
      }
  
      // Set vertex Z position to elevation
      let index = y * SIZE_X + x;
      console.log(`Vertex ${i}: x=${x}, y=${y}, index=${index}, elevation=${terrainData[index]?.elevation}`);
      vertices.setZ(i, terrainData[index]?.elevation / ELEVATION_SCALE);
    }
    vertices.needsUpdate = true;
  }

  async getTerrainData(
    bounds: { north: number; south: number; east: number; west: number },
    resolution: number = 10
  ): Promise<{ lat: number; lng: number; elevation: number }[]> {
    const locations: { latitude: number; longitude: number }[] = [];

    for (let lat = bounds.south; lat <= bounds.north; lat += resolution) {
      for (let lng = bounds.west; lng <= bounds.east; lng += resolution) {
        locations.push({ latitude: lat, longitude: lng });
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
